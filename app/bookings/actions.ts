"use server";

import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

import { writeAuditLog } from "@/app/lib/audit-log";
import { db } from "@/db";
import {
  bookingAuditLog,
  bookingActivity,
  bookingAddons,
  bookingBottles,
  bookingContracts,
  bookingContractVersions,
  bookingMessages,
  bookingNotifications,
  bookingParticipants,
  bookingPayments,
  bookingPricing,
  bookingCheckins,
  bookingItems,
  bookingRequirements,
  bookingStatusHistory,
  billSplits,
  bookings,
  tableBookings,
  venueAddons,
  venueBottlePackages,
  venueServers,
  venueTables,
} from "@/db/schema";
import { getAllowedBookingTransitions, bookingNotificationTypeForStatus } from "@/lib/bookings/lifecycle";
import { requireConsumerBookingActor, getBookingActor } from "./lib/auth";
import { getBookingById } from "./lib/data";
import type { BookingLifecycleStatus } from "@/lib/bookings/types";
import { BOOKING_TYPES } from "@/lib/bookings/types";

function toNumber(value: FormDataEntryValue | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStringValue(value: FormDataEntryValue | null | undefined) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function toDateAtTime(dateValue: string, timeValue: string) {
  if (!dateValue || !timeValue) {
    return null;
  }

  const candidate = new Date(`${dateValue}T${timeValue}:00`);
  if (Number.isNaN(candidate.getTime())) {
    return null;
  }

  return candidate;
}

function toIdList(value: FormDataEntryValue | null | undefined) {
  if (typeof value !== "string") {
    return [] as number[];
  }

  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
}

function parseSplitLines(raw: string, fallbackTotalCents: number) {
  if (!raw.trim()) {
    return [] as Array<{ name: string; email: string | null; amountCents: number; splitPercent: number | null }>;
  }

  const parsed = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [nameRaw, emailRaw, amountRaw] = line.split("|").map((part) => part?.trim() ?? "");
      const amountCents = Math.max(Number(amountRaw) || 0, 0);
      return {
        name: nameRaw || "Guest",
        email: emailRaw || null,
        amountCents,
      };
    })
    .filter((row) => row.amountCents > 0);

  const splitTotal = parsed.reduce((sum, row) => sum + row.amountCents, 0);
  return parsed.map((row) => ({
    name: row.name,
    email: row.email,
    amountCents: row.amountCents,
    splitPercent: splitTotal > 0 ? Number(((row.amountCents / splitTotal) * 100).toFixed(2)) : fallbackTotalCents > 0 ? Number(((row.amountCents / fallbackTotalCents) * 100).toFixed(2)) : null,
  }));
}

function buildStatusPatch(status: BookingLifecycleStatus, now: Date) {
  switch (status) {
    case "draft":
      return { draftAt: now };
    case "requested":
      return { requestedAt: now, pendingReviewAt: now };
    case "pending_review":
      return { pendingReviewAt: now };
    case "counter_offered":
      return { counterOfferedAt: now };
    case "accepted":
      return { acceptedAt: now };
    case "deposit_required":
      return { depositRequiredAt: now };
    case "deposit_paid":
      return { depositPaidAt: now };
    case "confirmed":
      return { confirmedAt: now };
    case "checked_in":
      return { checkedInAt: now };
    case "completed":
      return { completedAt: now };
    case "cancelled_by_consumer":
    case "cancelled_by_venue":
    case "cancelled_by_dj":
      return { cancelledAt: now };
    case "expired":
      return { expiredAt: now };
    case "refund_pending":
      return { refundPendingAt: now };
    case "refunded":
      return { refundedAt: now };
    case "disputed":
      return { disputedAt: now };
    case "closed":
      return { closedAt: now };
    default:
      return {};
  }
}

async function addBookingHistory(input: {
  bookingId: number;
  fromStatus: BookingLifecycleStatus | null;
  toStatus: BookingLifecycleStatus;
  actorClerkUserId: string;
  actorRole: string | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const payload = {
    bookingId: input.bookingId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    actorClerkUserId: input.actorClerkUserId,
    actorRole: input.actorRole,
    note: input.note ?? null,
    metadataJson: JSON.stringify(input.metadata ?? {}),
  };

  await Promise.all([
    db.insert(bookingStatusHistory).values(payload),
    db.insert(bookingAuditLog).values({
      bookingId: input.bookingId,
      actorClerkUserId: input.actorClerkUserId,
      actorRole: input.actorRole,
      action: `status:${input.toStatus}`,
      previousValuesJson: JSON.stringify({ status: input.fromStatus }),
      nextValuesJson: JSON.stringify({ status: input.toStatus }),
      metadataJson: JSON.stringify(input.metadata ?? {}),
    }),
  ]);
}

async function queueBookingNotification(input: {
  bookingId: number;
  notificationType: string;
  recipientClerkUserId?: string | null;
  payload: Record<string, unknown>;
}) {
  await db.insert(bookingNotifications).values({
    bookingId: input.bookingId,
    recipientClerkUserId: input.recipientClerkUserId ?? null,
    notificationType: input.notificationType,
    payloadJson: JSON.stringify(input.payload),
    channel: "in_app",
  });
}

function bookingNumberForNow(now: Date) {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `BK-${datePart}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function createBookingRequestAction(formData: FormData) {
  const actor = await requireConsumerBookingActor();
  const now = new Date();
  const submissionMode = toStringValue(formData.get("submissionMode"));
  const status: BookingLifecycleStatus = submissionMode === "draft" ? "draft" : "requested";
  const bookingType = toStringValue(formData.get("bookingType"));

  if (!BOOKING_TYPES.includes(bookingType as (typeof BOOKING_TYPES)[number])) {
    throw new Error("Select a supported booking type.");
  }

  const venueId = toNumber(formData.get("venueId"));
  const djProfileId = toNumber(formData.get("djProfileId"));
  const guestCount = Math.max(toNumber(formData.get("guestCount")) ?? 0, 0);
  const budgetCents = Math.max(toNumber(formData.get("budgetCents")) ?? 0, 0);
  const durationMinutes = Math.max(toNumber(formData.get("durationMinutes")) ?? 60, 15);
  const dateValue = toStringValue(formData.get("requestedDate"));
  const timeValue = toStringValue(formData.get("requestedTime"));
  const timezone = toStringValue(formData.get("timezone")) || "America/New_York";
  const requestedStartAt = toDateAtTime(dateValue, timeValue);

  if (!requestedStartAt) {
    throw new Error("Select a valid date and time.");
  }

  const requestedEndAt = new Date(requestedStartAt.getTime() + durationMinutes * 60 * 1000);
  const notes = toStringValue(formData.get("notes"));
  const inspirationText = toStringValue(formData.get("inspirationText"));
  const specialRequests = toStringValue(formData.get("specialRequests"));
  const city = toStringValue(formData.get("city"));
  const bookingNumber = bookingNumberForNow(now);
  const tableId = toNumber(formData.get("tableId"));
  const serverId = toNumber(formData.get("serverId"));
  const reservationName = toStringValue(formData.get("reservationName"));
  const minimumSpendInputCents = Math.max(toNumber(formData.get("minimumSpendCents")) ?? 0, 0);
  const bottlePackageIds = toIdList(formData.get("bottlePackageIds"));
  const addonIds = toIdList(formData.get("addonIds"));
  const splitLines = parseSplitLines(toStringValue(formData.get("splitBillLines")), budgetCents);

  const [tableRow, serverRow, bottleRows, addonRows] = await Promise.all([
    tableId
      ? db.query.venueTables.findFirst({ where: eq(venueTables.id, tableId) })
      : Promise.resolve(null),
    serverId
      ? db.query.venueServers.findFirst({ where: eq(venueServers.id, serverId) })
      : Promise.resolve(null),
    bottlePackageIds.length > 0
      ? db.select().from(venueBottlePackages).where(inArray(venueBottlePackages.id, bottlePackageIds))
      : Promise.resolve([]),
    addonIds.length > 0
      ? db.select().from(venueAddons).where(inArray(venueAddons.id, addonIds))
      : Promise.resolve([]),
  ]);

  const selectedBottles = bottleRows.filter((row) => bottlePackageIds.includes(row.id));
  const selectedAddons = addonRows.filter((row) => addonIds.includes(row.id));
  const catalogBottleTotalCents = selectedBottles.reduce((sum, row) => sum + row.priceCents, 0);
  const catalogAddonTotalCents = selectedAddons.reduce((sum, row) => sum + row.unitPriceCents, 0);
  const minimumSpendCents = Math.max(minimumSpendInputCents, tableRow?.minimumSpendCents ?? 0);
  const computedVipTotalCents = minimumSpendCents + catalogBottleTotalCents + catalogAddonTotalCents;
  const totalCents = Math.max(budgetCents, computedVipTotalCents, 0);
  const depositPercent = Math.min(Math.max(tableRow?.depositPercent ?? 20, 0), 100);
  const depositRequiredCents = Math.max(Math.round(totalCents * (depositPercent / 100)), 0);
  const platformFeeCents = Math.round(totalCents * 0.12);
  const payoutCents = Math.max(totalCents - platformFeeCents - depositRequiredCents, 0);

  const [booking] = await db
    .insert(bookings)
    .values({
      bookingNumber,
      bookingType,
      lifecycleStatus: status,
      requesterClerkUserId: actor.clerkUserId,
      consumerClerkUserId: actor.clerkUserId,
      djProfileId: djProfileId || null,
      venueId: venueId || null,
      city: city || null,
      timezone,
      requestedForAt: requestedStartAt,
      requestedStartAt,
      requestedEndAt,
      durationMinutes,
      guestCount,
      budgetCents,
      notes: notes || null,
      inspirationText: inspirationText || null,
      specialRequests: specialRequests || null,
      source: "consumer_portal",
      depositRequiredCents,
      totalCents,
      platformFeeCents,
      payoutCents,
      ...buildStatusPatch(status, now),
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!booking) {
    throw new Error("Failed to create booking.");
  }

  const [bookingContract] = await db
    .insert(bookingContracts)
    .values({
      bookingId: booking.id,
      versionNumber: 1,
      status: status === "draft" ? "draft" : "sent",
      title: `Nightly booking ${bookingNumber}`,
      termsJson: JSON.stringify({
        bookingNumber,
        bookingType,
        depositRequiredCents,
        totalCents,
        platformFeeCents,
        payoutCents,
        requestedStartAt: requestedStartAt.toISOString(),
        requestedEndAt: requestedEndAt.toISOString(),
        timezone,
      }),
      generatedAt: now,
      sentAt: status === "draft" ? null : now,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: bookingContracts.id });

  if (!bookingContract) {
    throw new Error("Failed to create booking contract.");
  }

  const tableBookingPayload = tableRow
    ? {
        bookingId: booking.id,
        venueId: tableRow.venueId,
        venueTableId: tableRow.id,
        serverId: serverRow?.id ?? null,
        bookingCategory: bookingType === "bottle_service_reservation" ? "bottle_service" : "vip_table",
        reservationName: reservationName || null,
        partySize: Math.max(guestCount, 1),
        reservationStartAt: requestedStartAt,
        reservationEndAt: requestedEndAt,
        status: status === "draft" ? "draft" : "pending",
        minimumSpendCents,
        depositAmountCents: depositRequiredCents,
        notes: notes || null,
        metadataJson: JSON.stringify({ floorObjectId: tableRow.floorObjectId, sectionName: tableRow.sectionName }),
        createdAt: now,
        updatedAt: now,
      }
    : null;

  await Promise.all([
    addBookingHistory({
      bookingId: booking.id,
      fromStatus: null,
      toStatus: status,
      actorClerkUserId: actor.clerkUserId,
      actorRole: actor.role,
      note: status === "draft" ? "Booking draft created." : "Booking request submitted.",
      metadata: { bookingType, venueId, djProfileId, durationMinutes, guestCount },
    }),
    db.insert(bookingParticipants).values([
      {
        bookingId: booking.id,
        participantRole: "consumer",
        clerkUserId: actor.clerkUserId,
        displayName: "Consumer",
        isPrimary: true,
        responseStatus: "confirmed",
        createdAt: now,
        updatedAt: now,
      },
      ...(djProfileId
        ? [
            {
              bookingId: booking.id,
              participantRole: "dj" as const,
              clerkUserId: `dj-profile-${djProfileId}`,
              djProfileId,
              displayName: "DJ",
              isPrimary: false,
              responseStatus: "invited",
              createdAt: now,
              updatedAt: now,
            },
          ]
        : []),
      ...(venueId
        ? [
            {
              bookingId: booking.id,
              participantRole: "venue" as const,
              clerkUserId: `venue-${venueId}`,
              venueId,
              displayName: "Venue",
              isPrimary: false,
              responseStatus: "invited",
              createdAt: now,
              updatedAt: now,
            },
          ]
        : []),
    ]),
    db.insert(bookingPricing).values({
      bookingId: booking.id,
      pricingKind: "quote",
      quoteVersion: 1,
      baseAmountCents: totalCents,
      depositAmountCents: depositRequiredCents,
      serviceFeeCents: Math.round(totalCents * 0.08),
      taxCents: Math.round(totalCents * 0.07),
      platformFeeCents,
      travelFeeCents: 0,
      surgeFeeCents: 0,
      discountCents: 0,
      totalAmountCents: totalCents,
      currency: "USD",
      quoteNotes: "Initial consumer request quote.",
      createdAt: now,
      updatedAt: now,
    }),
    ...(tableBookingPayload ? [db.insert(tableBookings).values(tableBookingPayload)] : []),
    db.insert(bookingItems).values([
      {
        bookingId: booking.id,
        itemType: "reservation_base",
        referenceId: tableRow?.id ?? null,
        label: bookingType === "bottle_service_reservation" ? "Bottle Service Reservation" : "VIP Table Reservation",
        quantity: 1,
        unitPriceCents: minimumSpendCents > 0 ? minimumSpendCents : totalCents,
        totalPriceCents: minimumSpendCents > 0 ? minimumSpendCents : totalCents,
        metadataJson: JSON.stringify({ bookingType }),
        createdAt: now,
      },
      ...selectedBottles.map((bottle) => ({
        bookingId: booking.id,
        itemType: "bottle_package",
        referenceId: bottle.id,
        label: bottle.name,
        quantity: 1,
        unitPriceCents: bottle.priceCents,
        totalPriceCents: bottle.priceCents,
        metadataJson: JSON.stringify({ description: bottle.description }),
        createdAt: now,
      })),
      ...selectedAddons.map((addon) => ({
        bookingId: booking.id,
        itemType: "addon",
        referenceId: addon.id,
        label: addon.name,
        quantity: 1,
        unitPriceCents: addon.unitPriceCents,
        totalPriceCents: addon.unitPriceCents,
        metadataJson: JSON.stringify({ category: addon.category }),
        createdAt: now,
      })),
    ]),
    ...(selectedBottles.length > 0
      ? [
          db.insert(bookingBottles).values(
            selectedBottles.map((bottle) => ({
              bookingId: booking.id,
              bottlePackageId: bottle.id,
              label: bottle.name,
              quantity: 1,
              unitPriceCents: bottle.priceCents,
              mixersJson: bottle.mixersJson,
              notes: bottle.description,
              createdAt: now,
              updatedAt: now,
            }))
          ),
        ]
      : []),
    ...(selectedAddons.length > 0
      ? [
          db.insert(bookingAddons).values(
            selectedAddons.map((addon) => ({
              bookingId: booking.id,
              venueAddonId: addon.id,
              label: addon.name,
              quantity: 1,
              unitPriceCents: addon.unitPriceCents,
              totalPriceCents: addon.unitPriceCents,
              notes: addon.description,
              createdAt: now,
              updatedAt: now,
            }))
          ),
        ]
      : []),
    ...(splitLines.length > 0
      ? [
          db.insert(billSplits).values(
            splitLines.map((split) => ({
              bookingId: booking.id,
              payerDisplayName: split.name,
              payerEmail: split.email,
              splitPercent: split.splitPercent,
              amountCents: split.amountCents,
              status: "pending",
              inviteToken: randomUUID(),
              invitedAt: now,
              metadataJson: JSON.stringify({ source: "consumer_request" }),
              createdAt: now,
              updatedAt: now,
            }))
          ),
        ]
      : []),
    db.insert(bookingActivity).values({
      bookingId: booking.id,
      actorClerkUserId: actor.clerkUserId,
      actorRole: actor.role,
      activityType: "booking_created",
      details: status === "draft" ? "Draft booking created with VIP preferences." : "Booking request submitted with VIP preferences.",
      metadataJson: JSON.stringify({
        tableId: tableRow?.id ?? null,
        serverId: serverRow?.id ?? null,
        bottlePackageIds,
        addonIds,
        splitCount: splitLines.length,
      }),
      createdAt: now,
    }),
    db.insert(bookingContractVersions).values({
      bookingContractId: bookingContract.id,
      versionNumber: 1,
      contentJson: JSON.stringify({
        title: `Nightly booking ${bookingNumber}`,
        requestedStartAt: requestedStartAt.toISOString(),
        requestedEndAt: requestedEndAt.toISOString(),
        notes,
        specialRequests,
      }),
      createdByClerkUserId: actor.clerkUserId,
      createdAt: now,
    }),
    db.insert(bookingRequirements).values(
      [notes, specialRequests]
        .filter((value): value is string => Boolean(value))
        .map((value, index) => ({
          bookingId: booking.id,
          requirementType: index === 0 ? "booking_notes" : "special_requests",
          title: index === 0 ? "Booking notes" : "Special requests",
          details: value,
          isRequired: index === 1,
          isMet: false,
          status: "open",
          createdAt: now,
          updatedAt: now,
        }))
    ),
    db.insert(bookingMessages).values({
      bookingId: booking.id,
      senderRole: "system",
      senderClerkUserId: "system",
      messageType: "timeline",
      body: status === "draft" ? "A draft booking was created." : "A booking request was submitted.",
      isSystem: true,
      createdAt: now,
    }),
    db.insert(bookingCheckins).values({
      bookingId: booking.id,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(bookingNotifications).values({
      bookingId: booking.id,
      recipientClerkUserId: actor.clerkUserId,
      notificationType: status === "draft" ? "booking_created" : "booking_requested",
      payloadJson: JSON.stringify({ bookingId: booking.id, bookingNumber, bookingType }),
      status: "queued",
      scheduledAt: now,
      createdAt: now,
      updatedAt: now,
    }),
    writeAuditLog({
      actorClerkUserId: actor.clerkUserId,
      actorRole: actor.role,
      entityType: "booking",
      entityId: booking.id,
      action: status === "draft" ? "booking_draft_created" : "booking_requested",
      metadata: { bookingNumber, bookingType, venueId, djProfileId },
    }),
  ]);

  revalidateTag("bookings:consumer", "max");
  revalidateTag("bookings:admin", "max");
  revalidateTag("bookings:dashboard", "max");

  redirect(`/bookings/${booking.id}?success=${encodeURIComponent(status === "draft" ? "Draft saved." : "Booking request submitted.")}`);
}

export async function submitBookingCounterOfferAction(formData: FormData) {
  const actor = await getBookingActor();
  const bookingId = Number(formData.get("bookingId"));
  const booking = await getBookingById(bookingId, actor);

  if (!booking.booking) {
    throw new Error("Booking not found or inaccessible.");
  }

  if (actor.role === "consumer") {
    throw new Error("Only vendors can submit counter offers.");
  }

  const now = new Date();
  const nextPrice = Math.max(toNumber(formData.get("counterOfferAmountCents")) ?? booking.booking.totalCents, 0);
  const nextDeposit = Math.max(toNumber(formData.get("counterOfferDepositCents")) ?? Math.round(nextPrice * 0.2), 0);
  const baseDuration =
    booking.booking.requestedStartAt && booking.booking.requestedEndAt
      ? Math.max(Math.round((booking.booking.requestedEndAt.getTime() - booking.booking.requestedStartAt.getTime()) / 60000), 30)
      : 60;
  const nextDuration = Math.max(toNumber(formData.get("counterOfferDurationMinutes")) ?? baseDuration, 15);
  const counterNote = toStringValue(formData.get("note")) || "A counter offer was submitted.";
  const expirationHours = Math.max(toNumber(formData.get("counterOfferExpirationHours")) ?? 24, 1);
  const startAt = booking.booking.requestedStartAt ?? null;
  const endAt = booking.booking.requestedEndAt ?? null;

  await db
    .update(bookings)
    .set({
      lifecycleStatus: "counter_offered",
      counterOfferAmountCents: nextPrice,
      counterOfferDepositCents: nextDeposit,
      counterOfferDurationMinutes: nextDuration,
      counterOfferPackage: toStringValue(formData.get("counterOfferPackage")) || null,
      counterOfferStartAt: startAt,
      counterOfferEndAt: endAt,
      counterOfferRequirementsJson: toStringValue(formData.get("counterOfferRequirementsJson")) || null,
      counterOfferExpiresAt: new Date(now.getTime() + expirationHours * 60 * 60 * 1000),
      ...buildStatusPatch("counter_offered", now),
      updatedAt: now,
    })
    .where(eq(bookings.id, bookingId));

  await Promise.all([
    addBookingHistory({
      bookingId,
      fromStatus: booking.booking.lifecycleStatus,
      toStatus: "counter_offered",
      actorClerkUserId: actor.clerkUserId,
      actorRole: actor.role,
      note: counterNote,
      metadata: {
        nextPrice,
        nextDeposit,
        nextDuration,
      },
    }),
    db.insert(bookingPricing).values({
      bookingId,
      pricingKind: "counter_offer",
      quoteVersion: booking.pricing.length + 1,
      baseAmountCents: nextPrice,
      depositAmountCents: nextDeposit,
      serviceFeeCents: booking.pricing[0]?.serviceFeeCents ?? 0,
      taxCents: booking.pricing[0]?.taxCents ?? 0,
      platformFeeCents: booking.pricing[0]?.platformFeeCents ?? 0,
      travelFeeCents: booking.pricing[0]?.travelFeeCents ?? 0,
      surgeFeeCents: 0,
      discountCents: 0,
      totalAmountCents: nextPrice,
      currency: booking.pricing[0]?.currency ?? "USD",
      quoteExpiresAt: new Date(now.getTime() + expirationHours * 60 * 60 * 1000),
      quoteNotes: counterNote,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(bookingMessages).values({
      bookingId,
      senderRole: actor.role === "owner" ? "venue" : actor.role === "dj" ? "dj" : "admin",
      senderClerkUserId: actor.clerkUserId,
      messageType: "counter_offer",
      body: counterNote,
      isSystem: false,
      createdAt: now,
    }),
    db.insert(bookingActivity).values({
      bookingId,
      actorClerkUserId: actor.clerkUserId,
      actorRole: actor.role,
      activityType: "counter_offer",
      details: counterNote,
      metadataJson: JSON.stringify({ nextPrice, nextDeposit, nextDuration }),
      createdAt: now,
    }),
    queueBookingNotification({
      bookingId,
      notificationType: "booking_countered",
      recipientClerkUserId: booking.booking.consumerClerkUserId,
      payload: { bookingId, nextPrice, nextDeposit },
    }),
    writeAuditLog({
      actorClerkUserId: actor.clerkUserId,
      actorRole: actor.role,
      entityType: "booking",
      entityId: bookingId,
      action: "booking_counter_offered",
      metadata: { nextPrice, nextDeposit, nextDuration },
    }),
  ]);

  revalidateTag("bookings:consumer", "max");
  revalidateTag("bookings:dashboard", "max");
  redirect(`/bookings/${bookingId}?success=${encodeURIComponent("Counter offer sent.")}`);
}

export async function transitionBookingStatusAction(formData: FormData) {
  const actor = await getBookingActor();
  const bookingId = Number(formData.get("bookingId"));
  const nextStatus = toStringValue(formData.get("nextStatus")) as BookingLifecycleStatus;
  const note = toStringValue(formData.get("note")) || null;
  const booking = await getBookingById(bookingId, actor);

  if (!booking.booking) {
    throw new Error("Booking not found or inaccessible.");
  }

  const allowed = getAllowedBookingTransitions(booking.booking.lifecycleStatus);
  if (!allowed.includes(nextStatus)) {
    throw new Error("That booking transition is not allowed.");
  }

  const now = new Date();
  await db
    .update(bookings)
    .set({
      lifecycleStatus: nextStatus,
      cancellationReason: nextStatus.startsWith("cancelled") ? note : booking.booking.cancellationReason,
      refundReason: nextStatus === "refund_pending" ? note : booking.booking.refundReason,
      disputeReason: nextStatus === "disputed" ? note : booking.booking.disputeReason,
      ...buildStatusPatch(nextStatus, now),
      updatedAt: now,
    })
    .where(eq(bookings.id, bookingId));

  await addBookingHistory({
    bookingId,
    fromStatus: booking.booking.lifecycleStatus,
    toStatus: nextStatus,
    actorClerkUserId: actor.clerkUserId,
    actorRole: actor.role,
    note,
    metadata: { nextStatus },
  });

  await db.insert(bookingActivity).values({
    bookingId,
    actorClerkUserId: actor.clerkUserId,
    actorRole: actor.role,
    activityType: "status_transition",
    details: note,
    metadataJson: JSON.stringify({ fromStatus: booking.booking.lifecycleStatus, toStatus: nextStatus }),
    createdAt: now,
  });

  const notificationType = bookingNotificationTypeForStatus(nextStatus);
  if (notificationType) {
    await queueBookingNotification({
      bookingId,
      notificationType,
      recipientClerkUserId: booking.booking.consumerClerkUserId,
      payload: { bookingId, nextStatus },
    });
  }

  if (nextStatus === "deposit_required" && booking.booking.totalCents > 0) {
    await db.insert(bookingPayments).values({
      bookingId,
      provider: "stripe",
      status: "due",
      amountCents: booking.booking.counterOfferDepositCents ?? Math.round(booking.booking.totalCents * 0.2),
      currency: "USD",
      platformFeeCents: Math.round(booking.booking.totalCents * 0.12),
      payoutCents: booking.booking.payoutCents,
      dueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    });
  }

  if (nextStatus === "accepted") {
    await db.update(bookingContracts).set({ status: "sent", sentAt: now, updatedAt: now }).where(eq(bookingContracts.bookingId, bookingId));
  }

  await writeAuditLog({
    actorClerkUserId: actor.clerkUserId,
    actorRole: actor.role,
    entityType: "booking",
    entityId: bookingId,
    action: `booking_status_${nextStatus}`,
    metadata: { nextStatus, note },
  });

  revalidateTag("bookings:consumer", "max");
  revalidateTag("bookings:dashboard", "max");
  redirect(`/bookings/${bookingId}?success=${encodeURIComponent(`Booking moved to ${nextStatus.replace(/_/g, " ")}.`)}`);
}
