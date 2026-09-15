import assert from "node:assert/strict";
import test from "node:test";
test("db-backed same-table contention yields one winner", { skip: process.env.NIGHTLY_DB_CONCURRENCY_TESTS !== "true" }, async () => {
  const [{ eq, like }, { db }, { createBookingWithinTransaction }, { assertTableAvailability }, { bookings, tableBookings, venueTables }] = await Promise.all([
    import("drizzle-orm"),
    import("@/db"),
    import("@/lib/bookings/booking-creation"),
    import("@/lib/bookings/operations"),
    import("@/db/schema"),
  ]);

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
        requesterClerkUserId: "db-test-user",
        consumerClerkUserId: "db-test-user",
        venueId: input.venueId,
        city: null,
        timezone: "America/New_York",
        requestedForAt: input.startAt,
        requestedStartAt: input.startAt,
        requestedEndAt: input.endAt,
        durationMinutes: 90,
        guestCount: 2,
        budgetCents: 100000,
        notes: "db concurrency test",
        inspirationText: null,
        specialRequests: null,
        source: "db_concurrency_test",
        depositRequiredCents: 20000,
        totalCents: 100000,
        platformFeeCents: 12000,
        payoutCents: 88000,
        confirmedAt: new Date(),
      },
      contractValues: {
        versionNumber: 1,
        status: "sent",
        title: `Nightly booking ${input.bookingNumber}`,
        termsJson: "{}",
        generatedAt: new Date(),
        sentAt: new Date(),
      },
      contractVersionValues: {
        versionNumber: 1,
        contentJson: "{}",
        createdByClerkUserId: "db-test-user",
      },
      tableBookingValues: {
        venueId: input.venueId,
        venueTableId: input.tableId,
        serverId: null,
        bookingCategory: "vip_table",
        reservationName: "DB Concurrency",
        partySize: 2,
        reservationStartAt: input.startAt,
        reservationEndAt: input.endAt,
        status: "confirmed",
        minimumSpendCents: 0,
        depositAmountCents: 20000,
        notes: "db concurrency test",
        metadataJson: "{}",
      },
      participantValues: [
        {
          participantRole: "consumer",
          clerkUserId: "db-test-user",
          displayName: "DB Test User",
          isPrimary: true,
          responseStatus: "confirmed",
        },
      ],
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
        quoteNotes: "db test",
      },
      paymentValues: [
        {
          provider: "nightly_manual",
          status: "due",
          amountCents: 20000,
          currency: "USD",
          platformFeeCents: 12000,
          payoutCents: 88000,
          paymentMethod: "deposit_only",
          dueAt: new Date(),
        },
      ],
      itemValues: [
        {
          itemType: "reservation_base",
          referenceId: input.tableId,
          label: "DB test booking",
          quantity: 1,
          unitPriceCents: 100000,
          totalPriceCents: 100000,
          metadataJson: "{}",
        },
      ],
      checkinValues: {
        status: "pending",
      },
      messageValues: {
        senderRole: "system",
        senderClerkUserId: "system",
        messageType: "timeline",
        body: "DB booking created",
        isSystem: true,
      },
      activityValues: {
        actorClerkUserId: "db-test-user",
        actorRole: "system",
        activityType: "booking_created",
        details: "DB concurrency booking created",
        metadataJson: "{}",
      },
      notificationValues: {
        recipientClerkUserId: "db-test-user",
        notificationType: "booking_created",
        payloadJson: "{}",
        status: "queued",
        scheduledAt: new Date(),
      },
      historyValues: {
        fromStatus: null,
        toStatus: "confirmed",
        actorClerkUserId: "db-test-user",
        actorRole: "system",
        note: "db test",
        metadata: {},
      },
      }, tx);

      return created.bookingId;
    });
  }

  const marker = `db-lock-${Date.now()}`;
  const [table] = await db
    .select({ id: venueTables.id, venueId: venueTables.venueId })
    .from(venueTables)
    .limit(1);

  assert.ok(table, "No venue tables available for DB contention test.");

  const startAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const endAt = new Date(startAt.getTime() + 90 * 60 * 1000);

  const runA = createMinimalBookingForTable({
    idempotencyKey: `${marker}-a`,
    bookingNumber: `DBA-${Date.now()}`,
    venueId: table.venueId,
    tableId: table.id,
    startAt,
    endAt,
  });

  const runB = createMinimalBookingForTable({
    idempotencyKey: `${marker}-b`,
    bookingNumber: `DBB-${Date.now()}`,
    venueId: table.venueId,
    tableId: table.id,
    startAt,
    endAt,
  });

  const results = await Promise.allSettled([runA, runB]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);

  const createdRows = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(like(bookings.idempotencyKey, `${marker}%`));

  const createdBookingIds = createdRows.map((row) => row.id);

  for (const bookingId of createdBookingIds) {
    await db.delete(tableBookings).where(eq(tableBookings.bookingId, bookingId));
    await db.delete(bookings).where(eq(bookings.id, bookingId));
  }
});
