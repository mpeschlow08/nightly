"use server";

import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

import { writeAuditLog } from "@/app/lib/audit-log";
import { db } from "@/db";
import {
  bookingMessages,
  bookingPricing,
  bookings,
  venueAddons,
  venueBottlePackages,
  venueServers,
  venueTables,
} from "@/db/schema";
import { assertTableAvailability, getVenueTableOperationsSnapshot, selectBestAvailableServer, transitionBookingLifecycleStatus } from "@/lib/bookings/operations";
import { createBookingWithinTransaction } from "@/lib/bookings/booking-creation";
import { acquireAdvisoryLock, RESERVATION_LOCK_SCOPE, stableIntHash } from "@/lib/bookings/reservation-locks";
import { buildReservationPaymentSummary, type ReservationPaymentOption } from "@/lib/bookings/payment-summary";
import { assertSplitShareTotalMatches } from "@/lib/bookings/split-shares";
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

function parseJsonRecord(value: FormDataEntryValue | null | undefined) {
  if (typeof value !== "string" || !value.trim()) {
    return {} as Record<string, unknown>;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {} as Record<string, unknown>;
  }
}

function parseJsonArray(value: FormDataEntryValue | null | undefined) {
  if (typeof value !== "string" || !value.trim()) {
    return [] as unknown[];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as unknown[];
  }
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
  const tableId = toNumber(formData.get("tableId"));
  const serverId = toNumber(formData.get("serverId"));
  const reservationName = toStringValue(formData.get("reservationName"));
  const minimumSpendInputCents = Math.max(toNumber(formData.get("minimumSpendCents")) ?? 0, 0);
  const bottlePackageIds = toIdList(formData.get("bottlePackageIds"));
  const addonIds = toIdList(formData.get("addonIds"));
  const reservationConfig = parseJsonRecord(formData.get("reservationConfigJson"));
  const bottleSelectionsInput = parseJsonArray(formData.get("bottleSelectionsJson"));
  const addonSelectionsInput = parseJsonArray(formData.get("addonSelectionsJson"));
  const splitSharesInput = parseJsonArray(formData.get("splitSharesJson"));
  const paymentOption = (toStringValue(formData.get("paymentOption")) || "deposit_only") as ReservationPaymentOption;
  const bookingRequestKey = toStringValue(formData.get("idempotencyKey"));

  if (!bookingRequestKey) {
    throw new Error("Missing reservation request key.");
  }

  let splitLines = parseSplitLines(toStringValue(formData.get("splitBillLines")), budgetCents);

  const selectedBottleIds = bottleSelectionsInput
    .map((entry) => (entry && typeof entry === "object" ? Number((entry as Record<string, unknown>).id) : NaN))
    .filter((id) => Number.isFinite(id) && id > 0);
  const selectedAddonIds = addonSelectionsInput
    .map((entry) => (entry && typeof entry === "object" ? Number((entry as Record<string, unknown>).id) : NaN))
    .filter((id) => Number.isFinite(id) && id > 0);
  const effectiveBottleIds = selectedBottleIds.length > 0 ? selectedBottleIds : bottlePackageIds;
  const effectiveAddonIds = selectedAddonIds.length > 0 ? selectedAddonIds : addonIds;

  let resolvedTableId = tableId;
  let createdBookingId = 0;
  let successMessage = status === "draft" ? "Draft saved." : "Booking request submitted.";

  await db.transaction(async (tx) => {
    const db = tx;

    await acquireAdvisoryLock(db, RESERVATION_LOCK_SCOPE.bookingRequest, stableIntHash(bookingRequestKey));

    const existingBooking = await db
      .select({ id: bookings.id, lifecycleStatus: bookings.lifecycleStatus })
      .from(bookings)
      .where(eq(bookings.idempotencyKey, bookingRequestKey))
      .limit(1);

    if (existingBooking[0]) {
      createdBookingId = existingBooking[0].id;
      successMessage = status === "draft" ? "Draft saved." : "Booking request submitted.";
      return;
    }

    const bookingNumber = bookingNumberForNow(now);

  const [initialTableRow, serverRow] = await Promise.all([
    resolvedTableId
      ? db.query.venueTables.findFirst({ where: eq(venueTables.id, resolvedTableId) })
      : Promise.resolve(null),
    serverId
      ? db.query.venueServers.findFirst({ where: eq(venueServers.id, serverId) })
      : Promise.resolve(null),
  ]);
  let tableRow = initialTableRow;
  const [bottleRows, addonRows] = await Promise.all([
    effectiveBottleIds.length > 0
      ? db.select().from(venueBottlePackages).where(inArray(venueBottlePackages.id, effectiveBottleIds))
      : Promise.resolve([]),
    effectiveAddonIds.length > 0
      ? db.select().from(venueAddons).where(inArray(venueAddons.id, effectiveAddonIds))
      : Promise.resolve([]),
  ]);

  let effectiveServer = serverRow;
  let serverMetadata = effectiveServer ? parseJsonRecord(effectiveServer.metadataJson) : {};
  let serverSectionAssignment = typeof serverMetadata.sectionAssignment === "string" ? serverMetadata.sectionAssignment : null;
  if (venueId && effectiveServer && serverSectionAssignment && (!tableRow || tableRow.sectionName !== serverSectionAssignment)) {
    const snapshot = await getVenueTableOperationsSnapshot(venueId, db);
    const matchedTable = snapshot.find((row) => row.liveStatus === "available" && row.sectionName === serverSectionAssignment);
    if (matchedTable) {
      resolvedTableId = matchedTable.id;
      tableRow = await db.query.venueTables.findFirst({ where: eq(venueTables.id, matchedTable.id) });
    }
  }

  const requestedExperienceType = typeof reservationConfig.experienceType === "string" ? reservationConfig.experienceType : null;
  const selectedBottles = bottleRows
    .filter((row) => effectiveBottleIds.includes(row.id))
    .map((row) => {
      const input = bottleSelectionsInput.find((entry) => entry && typeof entry === "object" && Number((entry as Record<string, unknown>).id) === row.id) as Record<string, unknown> | undefined;
      return { ...row, quantity: Math.max(Number(input?.quantity ?? 1), 1) };
    });
  const selectedAddons = addonRows
    .filter((row) => effectiveAddonIds.includes(row.id))
    .map((row) => {
      const input = addonSelectionsInput.find((entry) => entry && typeof entry === "object" && Number((entry as Record<string, unknown>).id) === row.id) as Record<string, unknown> | undefined;
      return { ...row, quantity: Math.max(Number(input?.quantity ?? 1), 1) };
    });

  if (requestedExperienceType && requestedExperienceType !== "table_only" && selectedBottles.length === 0) {
    throw new Error("Bottle selections are required for this reservation experience.");
  }

  if (venueId && resolvedTableId) {
    await assertTableAvailability({
      venueId,
      venueTableId: resolvedTableId,
      requestedStartAt,
      requestedEndAt,
    }, db)
  }

  const tableMetadata = tableRow ? parseJsonRecord(tableRow.metadataJson) : {};
  if (venueId && tableRow) {
    effectiveServer = await selectBestAvailableServer({
      venueId,
      requestedStartAt,
      requestedEndAt,
      sectionName: tableRow.sectionName,
      partySize: Math.max(guestCount, 1),
      preferredServerId: effectiveServer?.id ?? null,
    }, db)
    serverMetadata = effectiveServer ? parseJsonRecord(effectiveServer.metadataJson) : {};
    serverSectionAssignment = typeof serverMetadata.sectionAssignment === "string" ? serverMetadata.sectionAssignment : null;
  }

  const catalogBottleTotalCents = selectedBottles.reduce((sum, row) => sum + row.priceCents * row.quantity, 0);
  const catalogAddonTotalCents = selectedAddons.reduce((sum, row) => sum + row.unitPriceCents * row.quantity, 0);
  const minimumSpendCents = Math.max(minimumSpendInputCents, tableRow?.minimumSpendCents ?? 0);
  const reservationFeeCents = Number(tableMetadata.reservationFeeCents ?? 0) || 0;
  const bottleMinimumCents = Number(tableMetadata.bottleMinimumCents ?? 0) || 0;
  const paymentSummary = buildReservationPaymentSummary({
    minimumSpendCents,
    bottleMinimumCents,
    reservationFeeCents,
    bottleSubtotalCents: catalogBottleTotalCents,
    addonSubtotalCents: catalogAddonTotalCents,
    depositPercent: Math.min(Math.max(tableRow?.depositPercent ?? 20, 0), 100),
    paymentOption,
  });
  const totalCents = Math.max(paymentSummary.totalCents, 0);
  const depositRequiredCents = Math.max(paymentSummary.depositCents, 0);
  const platformFeeCents = Math.round(totalCents * 0.12);
  const payoutCents = Math.max(totalCents - platformFeeCents, 0);

  if (splitSharesInput.length > 0) {
    splitLines = splitSharesInput
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => {
        const candidate = entry as Record<string, unknown>;
        const amountCents = Math.max(Number(candidate.amountCents ?? 0), 0);
        return {
          name: typeof candidate.displayName === "string" ? candidate.displayName : "Guest",
          email: typeof candidate.handle === "string" ? `${candidate.handle}@nightly.social` : null,
          amountCents,
          splitPercent: totalCents > 0 ? Number(((amountCents / totalCents) * 100).toFixed(2)) : null,
        };
      })
      .filter((entry) => entry.amountCents > 0);
  }

  assertSplitShareTotalMatches(splitLines, totalCents);

  const tableBookingPayload = tableRow
    ? {
        venueId: tableRow.venueId,
        venueTableId: tableRow.id,
        serverId: effectiveServer?.id ?? null,
        bookingCategory: requestedExperienceType || (bookingType === "bottle_service_reservation" ? "bottle_service" : "vip_table"),
        reservationName: reservationName || null,
        partySize: Math.max(guestCount, 1),
        reservationStartAt: requestedStartAt,
        reservationEndAt: requestedEndAt,
        status: status === "draft" ? "draft" : "pending",
        minimumSpendCents,
        depositAmountCents: depositRequiredCents,
        notes: notes || null,
        metadataJson: JSON.stringify({
          floorObjectId: Number(reservationConfig.floorObjectId ?? tableRow.floorObjectId ?? 0) || tableRow.floorObjectId,
          sectionName: tableRow.sectionName,
          paymentOption,
          reservationFeeCents,
          bottleMinimumCents,
          assignedServerSection: serverSectionAssignment,
          experienceType: requestedExperienceType,
        }),
        createdAt: now,
        updatedAt: now,
      }
    : null;
  const created = await createBookingWithinTransaction({
    bookingValues: {
      bookingNumber,
      bookingType,
      lifecycleStatus: status,
      idempotencyKey: bookingRequestKey,
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
    },
    contractValues: {
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
        paymentOption,
        requestedStartAt: requestedStartAt.toISOString(),
        requestedEndAt: requestedEndAt.toISOString(),
        timezone,
      }),
      generatedAt: now,
      sentAt: status === "draft" ? null : now,
    },
    contractVersionValues: {
      versionNumber: 1,
      contentJson: JSON.stringify({
        title: `Nightly booking ${bookingNumber}`,
        requestedStartAt: requestedStartAt.toISOString(),
        requestedEndAt: requestedEndAt.toISOString(),
        notes,
        specialRequests,
      }),
      createdByClerkUserId: actor.clerkUserId,
    },
    tableBookingValues: tableBookingPayload,
    participantValues: [
      {
        participantRole: "consumer",
        clerkUserId: actor.clerkUserId,
        displayName: "Consumer",
        isPrimary: true,
        responseStatus: "confirmed",
      },
      ...(djProfileId
        ? [
            {
              participantRole: "dj" as const,
              clerkUserId: `dj-profile-${djProfileId}`,
              djProfileId,
              displayName: "DJ",
              isPrimary: false,
              responseStatus: "invited",
            },
          ]
        : []),
      ...(venueId
        ? [
            {
              participantRole: "venue" as const,
              clerkUserId: `venue-${venueId}`,
              venueId,
              displayName: "Venue",
              isPrimary: false,
              responseStatus: "invited",
            },
          ]
        : []),
      ...splitSharesInput
        .filter((entry) => entry && typeof entry === "object")
        .flatMap((entry) => {
          const candidate = entry as Record<string, unknown>;
          const clerkUserId = typeof candidate.clerkUserId === "string" ? candidate.clerkUserId : null;
          const displayName = typeof candidate.displayName === "string" ? candidate.displayName : "Guest";
          const isHost = Boolean(candidate.isHost);
          if (!clerkUserId || isHost || clerkUserId === actor.clerkUserId) {
            return [];
          }

          return [{
            participantRole: "consumer" as const,
            clerkUserId,
            displayName,
            isPrimary: false,
            responseStatus: "invited",
          }];
        }),
    ],
    pricingValues: {
      pricingKind: "quote",
      quoteVersion: 1,
      baseAmountCents: paymentSummary.spendTargetCents + reservationFeeCents,
      depositAmountCents: depositRequiredCents,
      serviceFeeCents: paymentSummary.serviceFeeCents,
      taxCents: paymentSummary.taxCents,
      platformFeeCents,
      travelFeeCents: 0,
      surgeFeeCents: 0,
      discountCents: 0,
      totalAmountCents: totalCents,
      currency: "USD",
      quoteNotes: `Initial consumer request quote (${paymentOption}).`,
    },
    paymentValues: [
      {
        provider: "nightly_manual",
        status: "due",
        amountCents: paymentSummary.dueNowCents,
        currency: "USD",
        platformFeeCents,
        payoutCents,
        paymentMethod: paymentOption,
        dueAt: now,
      },
      ...(paymentSummary.remainingBalanceCents > 0
        ? [{
            provider: "nightly_manual_balance",
            status: "pending" as const,
            amountCents: paymentSummary.remainingBalanceCents,
            currency: "USD",
            platformFeeCents: 0,
            payoutCents: paymentSummary.remainingBalanceCents,
            paymentMethod: "venue_settlement",
            dueAt: requestedStartAt,
          }]
        : []),
    ],
    itemValues: [
      {
        itemType: "reservation_base",
        referenceId: tableRow?.id ?? null,
        label: requestedExperienceType ? requestedExperienceType.replace(/_/g, " ") : bookingType === "bottle_service_reservation" ? "Bottle Service Reservation" : "VIP Table Reservation",
        quantity: 1,
        unitPriceCents: paymentSummary.spendTargetCents + reservationFeeCents,
        totalPriceCents: paymentSummary.spendTargetCents + reservationFeeCents,
        metadataJson: JSON.stringify({ bookingType, experienceType: requestedExperienceType, paymentOption }),
      },
      ...selectedBottles.map((bottle) => ({
        itemType: "bottle_package",
        referenceId: bottle.id,
        label: bottle.name,
        quantity: bottle.quantity,
        unitPriceCents: bottle.priceCents,
        totalPriceCents: bottle.priceCents * bottle.quantity,
        metadataJson: JSON.stringify({ description: bottle.description }),
      })),
      ...selectedAddons.map((addon) => ({
        itemType: "addon",
        referenceId: addon.id,
        label: addon.name,
        quantity: addon.quantity,
        unitPriceCents: addon.unitPriceCents,
        totalPriceCents: addon.unitPriceCents * addon.quantity,
        metadataJson: JSON.stringify({ category: addon.category }),
      })),
    ],
    bottleValues: selectedBottles.map((bottle) => ({
      bottlePackageId: bottle.id,
      label: bottle.name,
      quantity: bottle.quantity,
      unitPriceCents: bottle.priceCents,
      mixersJson: bottle.mixersJson,
      notes: bottle.description,
    })),
    addonValues: selectedAddons.map((addon) => ({
      venueAddonId: addon.id,
      label: addon.name,
      quantity: addon.quantity,
      unitPriceCents: addon.unitPriceCents,
      totalPriceCents: addon.unitPriceCents * addon.quantity,
      notes: addon.description,
    })),
    splitValues: splitLines.map((split) => ({
      payerClerkUserId: null,
      payerDisplayName: split.name,
      payerEmail: split.email,
      splitPercent: split.splitPercent,
      amountCents: split.amountCents,
      status: "pending",
      inviteToken: randomUUID(),
      invitedAt: now,
      metadataJson: JSON.stringify({ source: "consumer_request" }),
    })),
    requirementValues: [notes, specialRequests]
      .filter((value): value is string => Boolean(value))
      .map((value, index) => ({
        requirementType: index === 0 ? "booking_notes" : "special_requests",
        title: index === 0 ? "Booking notes" : "Special requests",
        details: value,
        isRequired: index === 1,
        isMet: false,
        status: "open",
      })),
    checkinValues: {
      status: "pending",
    },
    messageValues: {
      senderRole: "system",
      senderClerkUserId: "system",
      messageType: "timeline",
      body: status === "draft" ? "A draft booking was created." : "A booking request was submitted.",
      isSystem: true,
    },
    activityValues: {
      actorClerkUserId: actor.clerkUserId,
      actorRole: actor.role,
      activityType: "booking_created",
      details: status === "draft" ? "Draft booking created with VIP preferences." : "Booking request submitted with VIP preferences.",
      metadataJson: JSON.stringify({
        tableId: tableRow?.id ?? null,
        serverId: effectiveServer?.id ?? null,
        bottlePackageIds: effectiveBottleIds,
        addonIds: effectiveAddonIds,
        splitCount: splitLines.length,
        paymentOption,
        experienceType: requestedExperienceType,
      }),
    },
    notificationValues: {
      recipientClerkUserId: actor.clerkUserId,
      notificationType: status === "draft" ? "booking_created" : "booking_requested",
      payloadJson: JSON.stringify({ bookingNumber, bookingType }),
      status: "queued",
      scheduledAt: now,
    },
    historyValues: {
      fromStatus: null,
      toStatus: status,
      actorClerkUserId: actor.clerkUserId,
      actorRole: actor.role,
      note: status === "draft" ? "Booking draft created." : "Booking request submitted.",
      metadata: { bookingType, venueId, djProfileId, durationMinutes, guestCount },
    },
  }, db);

  createdBookingId = created.bookingId;

  if (created.created) {
    await writeAuditLog({
      actorClerkUserId: actor.clerkUserId,
      actorRole: actor.role,
      entityType: "booking",
      entityId: created.bookingId,
      action: status === "draft" ? "booking_draft_created" : "booking_requested",
      metadata: { bookingNumber, bookingType, venueId, djProfileId },
    }, db);
  }

    successMessage = status === "draft" ? "Draft saved." : "Booking request submitted.";
  });

  revalidateTag("bookings:consumer", "max");
  revalidateTag("bookings:admin", "max");
  revalidateTag("bookings:dashboard", "max");

  redirect(`/bookings/${createdBookingId}?success=${encodeURIComponent(successMessage)}`);
}

export async function submitBookingCounterOfferAction(formData: FormData) {
  const actor = await getBookingActor();
  const bookingId = Number(formData.get("bookingId"));
  const booking = await getBookingById(bookingId, actor);

  if (!booking.booking) {
    throw new Error("Booking not found or inaccessible.");
  }

  const bookingRecord = booking.booking;

  if (actor.role === "consumer") {
    throw new Error("Only vendors can submit counter offers.");
  }

  const now = new Date();
  const nextPrice = Math.max(toNumber(formData.get("counterOfferAmountCents")) ?? bookingRecord.totalCents, 0);
  const nextDeposit = Math.max(toNumber(formData.get("counterOfferDepositCents")) ?? Math.round(nextPrice * 0.2), 0);
  const baseDuration =
    bookingRecord.requestedStartAt && bookingRecord.requestedEndAt
      ? Math.max(Math.round((bookingRecord.requestedEndAt.getTime() - bookingRecord.requestedStartAt.getTime()) / 60000), 30)
      : 60;
  const nextDuration = Math.max(toNumber(formData.get("counterOfferDurationMinutes")) ?? baseDuration, 15);
  const counterNote = toStringValue(formData.get("note")) || "A counter offer was submitted.";
  const expirationHours = Math.max(toNumber(formData.get("counterOfferExpirationHours")) ?? 24, 1);
  const startAt = bookingRecord.requestedStartAt ?? null;
  const endAt = bookingRecord.requestedEndAt ?? null;

  await db.transaction(async (tx) => {
    await acquireAdvisoryLock(tx, RESERVATION_LOCK_SCOPE.booking, bookingId);

    const [currentBooking] = await tx
      .select({ lifecycleStatus: bookings.lifecycleStatus, consumerClerkUserId: bookings.consumerClerkUserId, totalCents: bookings.totalCents, venueId: bookings.venueId })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!currentBooking) {
      throw new Error("Booking not found or inaccessible.");
    }

    if (currentBooking.lifecycleStatus === "counter_offered") {
      return;
    }

    await tx
      .update(bookings)
      .set({
        counterOfferAmountCents: nextPrice,
        counterOfferDepositCents: nextDeposit,
        counterOfferDurationMinutes: nextDuration,
        counterOfferPackage: toStringValue(formData.get("counterOfferPackage")) || null,
        counterOfferStartAt: startAt,
        counterOfferEndAt: endAt,
        counterOfferRequirementsJson: toStringValue(formData.get("counterOfferRequirementsJson")) || null,
        counterOfferExpiresAt: new Date(now.getTime() + expirationHours * 60 * 60 * 1000),
        updatedAt: now,
      })
      .where(eq(bookings.id, bookingId));

    await transitionBookingLifecycleStatus({
      bookingId,
      actorClerkUserId: actor.clerkUserId,
      actorRole: actor.role,
      nextStatus: "counter_offered",
      note: counterNote,
    }, tx);

    await Promise.all([
      tx.insert(bookingPricing).values({
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
      tx.insert(bookingMessages).values({
        bookingId,
        senderRole: actor.role === "owner" ? "venue" : actor.role === "dj" ? "dj" : "admin",
        senderClerkUserId: actor.clerkUserId,
        messageType: "counter_offer",
        body: counterNote,
        isSystem: false,
        createdAt: now,
      }),
      writeAuditLog({
        actorClerkUserId: actor.clerkUserId,
        actorRole: actor.role,
        entityType: "booking",
        entityId: bookingId,
        action: "booking_counter_offered",
        metadata: { nextPrice, nextDeposit, nextDuration },
      }, tx),
    ]);
  });

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

  await transitionBookingLifecycleStatus({
    bookingId,
    actorClerkUserId: actor.clerkUserId,
    actorRole: actor.role,
    nextStatus,
    note,
  });

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
