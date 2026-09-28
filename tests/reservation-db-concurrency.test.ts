import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { config } from "dotenv";

if (process.env.NIGHTLY_DB_CONCURRENCY_TESTS === "true") {
  config({ path: ".env.local", override: true, quiet: true });
}

test(
  "db-backed same-table contention yields one winner",
  { skip: process.env.NIGHTLY_DB_CONCURRENCY_TESTS !== "true" },
  async () => {
    const [drizzleOrm, database, bookingCreation, bookingOperations, schema] = await Promise.all([
      import("drizzle-orm"),
      import("@/db"),
      import("@/lib/bookings/booking-creation"),
      import("@/lib/bookings/operations"),
      import("@/db/schema"),
    ]);
    const { eq, like, asc } = drizzleOrm;
    const { db } = database;
    const { createBookingWithinTransaction } = bookingCreation;
    const { assertTableAvailability } = bookingOperations;
    const { bookings, tableBookings, venueTables, venues } = schema;
    const marker = `nightly-cert-reservation-${randomUUID()}`;

    async function createMinimalBookingForTable(input: {
      idempotencyKey: string;
      bookingNumber: string;
      venueId: number;
      tableId: number;
      startAt: Date;
      endAt: Date;
    }) {
      return db.transaction(async (tx) => {
        await assertTableAvailability({
          venueId: input.venueId,
          venueTableId: input.tableId,
          requestedStartAt: input.startAt,
          requestedEndAt: input.endAt,
        }, tx);

        const created = await createBookingWithinTransaction({
          bookingValues: {
            bookingNumber: input.bookingNumber,
            bookingType: "vip_table_reservation",
            lifecycleStatus: "confirmed",
            idempotencyKey: input.idempotencyKey,
            requesterClerkUserId: "nightly-cert-reservation",
            consumerClerkUserId: "nightly-cert-reservation",
            venueId: input.venueId,
            city: null,
            timezone: "America/New_York",
            requestedForAt: input.startAt,
            requestedStartAt: input.startAt,
            requestedEndAt: input.endAt,
            durationMinutes: 90,
            guestCount: 2,
            budgetCents: 100000,
            notes: "Nightly Sprint 1 DB reservation concurrency fixture",
            inspirationText: null,
            specialRequests: null,
            source: "nightly_certification",
            depositRequiredCents: 20000,
            totalCents: 100000,
            platformFeeCents: 12000,
            payoutCents: 88000,
            confirmedAt: new Date(),
          },
          contractValues: {
            versionNumber: 1,
            status: "sent",
            title: `Nightly certification ${input.bookingNumber}`,
            termsJson: "{}",
            generatedAt: new Date(),
            sentAt: new Date(),
          },
          contractVersionValues: {
            versionNumber: 1,
            contentJson: "{}",
            createdByClerkUserId: "nightly-cert-reservation",
          },
          tableBookingValues: {
            venueId: input.venueId,
            venueTableId: input.tableId,
            serverId: null,
            bookingCategory: "vip_table",
            reservationName: "Nightly certification reservation",
            partySize: 2,
            reservationStartAt: input.startAt,
            reservationEndAt: input.endAt,
            status: "confirmed",
            minimumSpendCents: 0,
            depositAmountCents: 20000,
            notes: "Nightly Sprint 1 DB reservation concurrency fixture",
            metadataJson: "{}",
          },
          participantValues: [{
            participantRole: "consumer",
            clerkUserId: "nightly-cert-reservation",
            displayName: "Nightly Certification",
            isPrimary: true,
            responseStatus: "confirmed",
          }],
          pricingValues: {
            pricingKind: "quote",
            quoteVersion: 1,
            baseAmountCents: 100000,
            depositAmountCents: 20000,
            serviceFeeCents: 0,
            taxCents: 0,
            platformFeeCents: 12000,
            travelFeeCents: 0,
            surgeFeeCents: 0,
            discountCents: 0,
            totalAmountCents: 100000,
            currency: "USD",
            quoteNotes: "Nightly DB concurrency certification",
          },
          paymentValues: [{
            provider: "nightly_manual",
            status: "due",
            amountCents: 20000,
            currency: "USD",
            platformFeeCents: 12000,
            payoutCents: 88000,
            paymentMethod: "deposit_only",
            dueAt: new Date(),
          }],
          itemValues: [{
            itemType: "reservation_base",
            referenceId: input.tableId,
            label: "Nightly certification reservation",
            quantity: 1,
            unitPriceCents: 100000,
            totalPriceCents: 100000,
            metadataJson: "{}",
          }],
          checkinValues: { status: "pending" },
          messageValues: {
            senderRole: "system",
            senderClerkUserId: "system",
            messageType: "timeline",
            body: "Nightly certification booking created",
            isSystem: true,
          },
          activityValues: {
            actorClerkUserId: "nightly-cert-reservation",
            actorRole: "system",
            activityType: "booking_created",
            details: "Nightly DB concurrency certification",
            metadataJson: "{}",
          },
          notificationValues: {
            recipientClerkUserId: "nightly-cert-reservation",
            notificationType: "booking_created",
            payloadJson: "{}",
            status: "queued",
            scheduledAt: new Date(),
          },
          historyValues: {
            fromStatus: null,
            toStatus: "confirmed",
            actorClerkUserId: "nightly-cert-reservation",
            actorRole: "system",
            note: "Nightly DB concurrency certification",
            metadata: {},
          },
        }, tx);

        return created.bookingId;
      });
    }

    const [venue] = await db.select({ id: venues.id }).from(venues).orderBy(asc(venues.id)).limit(1);
    assert.ok(venue, "No venue available for DB contention fixture.");
    const [table] = await db.insert(venueTables).values({
      venueId: venue.id,
      tableCode: marker,
      name: "Nightly Sprint 1 reservation concurrency fixture",
      metadataJson: "{}",
    }).returning({ id: venueTables.id, venueId: venueTables.venueId });
    assert.ok(table, "Could not create DB contention fixture table.");

    try {
      const startAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      const endAt = new Date(startAt.getTime() + 90 * 60 * 1000);
      const results = await Promise.allSettled([
        createMinimalBookingForTable({
          idempotencyKey: `${marker}-a`,
          bookingNumber: `CERT-A-${randomUUID().slice(0, 8)}`,
          venueId: table.venueId,
          tableId: table.id,
          startAt,
          endAt,
        }),
        createMinimalBookingForTable({
          idempotencyKey: `${marker}-b`,
          bookingNumber: `CERT-B-${randomUUID().slice(0, 8)}`,
          venueId: table.venueId,
          tableId: table.id,
          startAt,
          endAt,
        }),
      ]);

      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    } finally {
      const createdRows = await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(like(bookings.idempotencyKey, `${marker}%`));

      for (const row of createdRows) {
        await db.delete(tableBookings).where(eq(tableBookings.bookingId, row.id));
        await db.delete(bookings).where(eq(bookings.id, row.id));
      }
      await db.delete(venueTables).where(eq(venueTables.id, table.id));
    }
  }
);
