import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  arrivalLog,
  billSplits,
  bookingActivity,
  bookingAddons,
  bookingBottles,
  bookingCheckins,
  bookingItems,
  bookings,
  checkInLog,
  reservationHistory,
  reservationNotifications,
  reservationStatusLog,
  serverAssignments,
  tableBookings,
  tableStatusLog,
  venueAddons,
  venueBottlePackages,
  venueServers,
  venueTables,
  waitlistEntries,
} from "@/db/schema";
import { canTransitionLiveTableStatus, canTransitionReservationStatus, canTransitionWaitlistStatus, mapCustomerStatusToBookingLifecycle, mapLifecycleToCustomerStatus } from "@/lib/bookings/lifecycle";
import { createReservationPassToken, parseReservationPassToken } from "@/lib/bookings/pass-token";
import type { BookingLifecycleStatus, CustomerReservationStatus, LiveTableStatus, WaitlistStatus } from "@/lib/bookings/types";

export const CUSTOMER_TIMELINE_ORDER: CustomerReservationStatus[] = [
  "pending",
  "deposit_required",
  "deposit_paid",
  "confirmed",
  "checked_in",
  "seated",
  "bottle_service_active",
  "completed",
  "cancelled",
  "refunded",
];

export type ReservationTimelineEntry = {
  id: number;
  status: CustomerReservationStatus;
  createdAt: Date;
  note: string | null;
  actorRole: string | null;
};

export async function getReservationTimeline(bookingId: number) {
  const [booking] = await db
    .select({
      id: bookings.id,
      lifecycleStatus: bookings.lifecycleStatus,
      createdAt: bookings.createdAt,
    })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!booking) {
    return null;
  }

  const statusLogRows = await db
    .select({
      id: reservationStatusLog.id,
      toStatus: reservationStatusLog.toStatus,
      createdAt: reservationStatusLog.createdAt,
      note: reservationStatusLog.note,
      actorRole: reservationStatusLog.actorRole,
    })
    .from(reservationStatusLog)
    .where(eq(reservationStatusLog.bookingId, bookingId))
    .orderBy(asc(reservationStatusLog.createdAt), asc(reservationStatusLog.id));

  const entries: ReservationTimelineEntry[] = [
    {
      id: 0,
      status: "pending",
      createdAt: booking.createdAt,
      note: "Reservation created.",
      actorRole: "system",
    },
    ...statusLogRows
      .map((row) => ({
        id: row.id,
        status: row.toStatus as CustomerReservationStatus,
        createdAt: row.createdAt,
        note: row.note,
        actorRole: row.actorRole,
      }))
      .filter((row) => CUSTOMER_TIMELINE_ORDER.includes(row.status)),
  ];

  const currentStatus = mapLifecycleToCustomerStatus(booking.lifecycleStatus as BookingLifecycleStatus);

  if (!entries.some((entry) => entry.status === currentStatus)) {
    entries.push({
      id: Number.MAX_SAFE_INTEGER,
      status: currentStatus,
      createdAt: new Date(),
      note: "Current booking status.",
      actorRole: "system",
    });
  }

  const seen = new Set<string>();
  const normalized = entries
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .filter((entry) => {
      const key = `${entry.status}:${entry.createdAt.toISOString()}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

  return {
    bookingId: booking.id,
    currentStatus,
    entries: normalized,
    progressIndex: Math.max(CUSTOMER_TIMELINE_ORDER.indexOf(currentStatus), 0),
    order: CUSTOMER_TIMELINE_ORDER,
  };
}

export async function getOrCreateReservationPass(bookingId: number, venueId: number) {
  const [existing] = await db
    .select({
      checkInToken: checkInLog.checkInToken,
      bookingId: checkInLog.bookingId,
      venueId: checkInLog.venueId,
    })
    .from(checkInLog)
    .where(and(eq(checkInLog.bookingId, bookingId), eq(checkInLog.venueId, venueId), eq(checkInLog.decision, "issued")))
    .orderBy(desc(checkInLog.createdAt))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [booking] = await db
    .select({
      id: bookings.id,
      venueId: bookings.venueId,
      requestedStartAt: bookings.requestedStartAt,
    })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!booking || booking.venueId !== venueId) {
    throw new Error("Booking not found for reservation pass.");
  }

  const now = Date.now();
  const fallbackExpiryMs = now + 24 * 60 * 60 * 1000;
  const scheduledExpiryMs = booking.requestedStartAt
    ? booking.requestedStartAt.getTime() + 12 * 60 * 60 * 1000
    : fallbackExpiryMs;
  const exp = Math.floor(Math.max(fallbackExpiryMs, scheduledExpiryMs) / 1000);

  const token = createReservationPassToken({
    bid: bookingId,
    vid: venueId,
    iat: Math.floor(now / 1000),
    exp,
    ver: 1,
  });
  const scanNonce = randomUUID();

  const [created] = await db
    .insert(checkInLog)
    .values({
      bookingId,
      venueId,
      checkInToken: token,
      scanNonce,
      scannedByRole: "system",
      scanMethod: "qr",
      decision: "issued",
      reason: "Dynamic reservation pass issued.",
      scannedAt: new Date(),
      createdAt: new Date(),
    })
    .returning({
      checkInToken: checkInLog.checkInToken,
      bookingId: checkInLog.bookingId,
      venueId: checkInLog.venueId,
    });

  return created;
}

export async function scanReservationPass(input: {
  checkInToken: string;
  scanNonce: string;
  venueId: number;
  actorClerkUserId: string;
  actorRole: string;
  method?: string;
}) {
  const token = input.checkInToken.trim();
  if (!token) {
    return { decision: "invalid_pass", reason: "Missing reservation token." } as const;
  }

  const claims = parseReservationPassToken(token);
  if (!claims) {
    return { decision: "invalid_pass", reason: "Reservation pass signature is invalid." } as const;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (claims.exp <= nowSeconds) {
    return { decision: "expired", reason: "Reservation pass is expired." } as const;
  }

  if (claims.vid !== input.venueId) {
    return { decision: "wrong_venue", reason: "Reservation pass does not belong to this venue." } as const;
  }

  const [issued] = await db
    .select({
      bookingId: checkInLog.bookingId,
      venueId: checkInLog.venueId,
      tableBookingId: checkInLog.tableBookingId,
    })
    .from(checkInLog)
    .where(and(eq(checkInLog.checkInToken, token), eq(checkInLog.decision, "issued")))
    .orderBy(desc(checkInLog.createdAt))
    .limit(1);

  if (!issued) {
    return { decision: "invalid_pass", reason: "Reservation pass was not issued by Nightly." } as const;
  }

  if (issued.venueId !== input.venueId) {
    return { decision: "wrong_venue", reason: "Reservation pass does not belong to this venue." } as const;
  }

  const [booking] = await db
    .select({
      id: bookings.id,
      venueId: bookings.venueId,
      lifecycleStatus: bookings.lifecycleStatus,
    })
    .from(bookings)
    .where(eq(bookings.id, issued.bookingId))
    .limit(1);

  if (!booking || booking.venueId !== input.venueId || booking.id !== claims.bid) {
    return { decision: "invalid_pass", reason: "Reservation pass is not valid for this booking." } as const;
  }

  const lifecycle = booking.lifecycleStatus as BookingLifecycleStatus;
  if (["cancelled_by_consumer", "cancelled_by_venue", "cancelled_by_dj", "expired"].includes(lifecycle)) {
    return { decision: "cancelled", reason: "Reservation has been cancelled." } as const;
  }

  if (["refund_pending", "refunded"].includes(lifecycle)) {
    return { decision: "refunded", reason: "Reservation has been refunded." } as const;
  }

  if (lifecycle === "completed" || lifecycle === "closed") {
    return { decision: "invalid_pass", reason: "Reservation is no longer active." } as const;
  }

  const [alreadyAccepted] = await db
    .select({ id: checkInLog.id })
    .from(checkInLog)
    .where(and(eq(checkInLog.bookingId, issued.bookingId), eq(checkInLog.decision, "accepted")))
    .limit(1);

  const now = new Date();

  if (alreadyAccepted) {
    await db.insert(checkInLog).values({
      bookingId: issued.bookingId,
      venueId: issued.venueId,
      tableBookingId: issued.tableBookingId,
      checkInToken: token,
      scanNonce: input.scanNonce,
      scannedByClerkUserId: input.actorClerkUserId,
      scannedByRole: input.actorRole,
      scanMethod: input.method ?? "qr",
      decision: "replay_blocked",
      reason: "Duplicate check-in attempt blocked.",
      scannedAt: now,
      createdAt: now,
    });

    return { decision: "already_checked_in", reason: "Reservation was already checked in.", bookingId: issued.bookingId } as const;
  }

  await db.transaction(async (tx) => {
    await tx.insert(checkInLog).values({
      bookingId: issued.bookingId,
      venueId: issued.venueId,
      tableBookingId: issued.tableBookingId,
      checkInToken: token,
      scanNonce: input.scanNonce,
      scannedByClerkUserId: input.actorClerkUserId,
      scannedByRole: input.actorRole,
      scanMethod: input.method ?? "qr",
      decision: "accepted",
      reason: "Reservation successfully checked in.",
      scannedAt: now,
      createdAt: now,
    });

    await tx
      .update(bookings)
      .set({
        lifecycleStatus: "checked_in",
        checkedInAt: now,
        updatedAt: now,
      })
      .where(eq(bookings.id, issued.bookingId));

    await tx
      .update(bookingCheckins)
      .set({
        status: "checked_in",
        checkedInAt: now,
        checkedInByClerkUserId: input.actorClerkUserId,
        method: input.method ?? "qr",
        updatedAt: now,
      })
      .where(eq(bookingCheckins.bookingId, issued.bookingId));

    await tx.insert(reservationStatusLog).values({
      bookingId: issued.bookingId,
      tableBookingId: issued.tableBookingId,
      fromStatus: "confirmed",
      toStatus: "checked_in",
      actorClerkUserId: input.actorClerkUserId,
      actorRole: input.actorRole,
      note: "Checked in via reservation pass.",
      metadataJson: JSON.stringify({ method: input.method ?? "qr" }),
      createdAt: now,
    });

    await tx.insert(arrivalLog).values({
      bookingId: issued.bookingId,
      tableBookingId: issued.tableBookingId,
      venueId: issued.venueId,
      arrivedAt: now,
      recordedByClerkUserId: input.actorClerkUserId,
      note: "Guest checked in at door.",
      metadataJson: JSON.stringify({ method: input.method ?? "qr" }),
      createdAt: now,
    });

    await tx.insert(bookingActivity).values({
      bookingId: issued.bookingId,
      actorClerkUserId: input.actorClerkUserId,
      actorRole: input.actorRole,
      activityType: "door_check_in",
      details: "Reservation checked in at door.",
      metadataJson: JSON.stringify({ method: input.method ?? "qr" }),
      createdAt: now,
    });
  });

  return { decision: "accepted", reason: "Reservation checked in.", bookingId: issued.bookingId } as const;
}

export async function setReservationStatus(input: {
  bookingId: number;
  actorClerkUserId: string;
  actorRole: string;
  status: CustomerReservationStatus;
  note?: string | null;
}) {
  const [booking] = await db
    .select({
      id: bookings.id,
      lifecycleStatus: bookings.lifecycleStatus,
      depositPaidAt: bookings.depositPaidAt,
      venueId: bookings.venueId,
    })
    .from(bookings)
    .where(eq(bookings.id, input.bookingId))
    .limit(1);

  if (!booking) {
    throw new Error("Booking not found.");
  }

  const currentReservationStatus = mapLifecycleToCustomerStatus(booking.lifecycleStatus as BookingLifecycleStatus);
  const transitionCheck = canTransitionReservationStatus(
    currentReservationStatus,
    input.status,
    (input.actorRole as "consumer" | "owner" | "admin" | "door_staff" | "server" | "system"),
    {
      depositSatisfied:
        booking.depositPaidAt != null ||
        ["deposit_paid", "confirmed", "checked_in", "completed", "closed"].includes(booking.lifecycleStatus),
      hasPaymentIssue: ["refund_pending", "refunded", "disputed"].includes(booking.lifecycleStatus),
    }
  );

  if (!transitionCheck.allowed) {
    throw new Error(transitionCheck.reason);
  }

  const [tableBooking] = await db
    .select({
      id: tableBookings.id,
      bookingId: tableBookings.bookingId,
      venueId: tableBookings.venueId,
      previousStatus: tableBookings.status,
      venueTableId: tableBookings.venueTableId,
      reservationName: tableBookings.reservationName,
    })
    .from(tableBookings)
    .where(eq(tableBookings.bookingId, input.bookingId))
    .limit(1);

  const now = new Date();

  if (tableBooking) {
    await db
      .update(tableBookings)
      .set({
        status: input.status,
        updatedAt: now,
      })
      .where(eq(tableBookings.id, tableBooking.id));
  }

  const nextLifecycleStatus = mapCustomerStatusToBookingLifecycle(input.status, booking.lifecycleStatus as BookingLifecycleStatus);
  const lifecyclePatch: Record<string, Date | string> = {
    lifecycleStatus: nextLifecycleStatus,
    updatedAt: now,
  };

  if (input.status === "completed") lifecyclePatch.completedAt = now;
  if (input.status === "cancelled") lifecyclePatch.cancelledAt = now;
  if (input.status === "refunded") lifecyclePatch.refundedAt = now;
  if (input.status === "checked_in") lifecyclePatch.checkedInAt = now;
  if (input.status === "confirmed") lifecyclePatch.confirmedAt = now;

  await db.update(bookings).set(lifecyclePatch).where(eq(bookings.id, input.bookingId));

  if (input.status === "seated") {
    if (tableBooking?.venueId) {
      await db.insert(arrivalLog).values({
        bookingId: input.bookingId,
        tableBookingId: tableBooking.id,
        venueId: tableBooking.venueId,
        seatedAt: now,
        recordedByClerkUserId: input.actorClerkUserId,
        note: input.note ?? "Party seated.",
        metadataJson: JSON.stringify({ source: "server_dashboard" }),
        createdAt: now,
      });
    }
  }

  await db.insert(reservationStatusLog).values({
    bookingId: input.bookingId,
    tableBookingId: tableBooking?.id ?? null,
    fromStatus: currentReservationStatus,
    toStatus: input.status,
    actorClerkUserId: input.actorClerkUserId,
    actorRole: input.actorRole,
    note: input.note ?? null,
    metadataJson: JSON.stringify({}),
    createdAt: now,
  });

  await db.insert(bookingActivity).values({
    bookingId: input.bookingId,
    actorClerkUserId: input.actorClerkUserId,
    actorRole: input.actorRole,
    activityType: "reservation_status_update",
    details: input.note ?? `Status updated to ${input.status}`,
    metadataJson: JSON.stringify({ status: input.status }),
    createdAt: now,
  });

  if (tableBooking?.venueId) {
    await db.insert(reservationNotifications).values({
      bookingId: input.bookingId,
      venueId: tableBooking.venueId,
      recipientClerkUserId: input.actorClerkUserId,
      notificationType: input.status === "cancelled" ? "reservation_cancelled" : "reservation_modified",
      channel: "in_app",
      status: "queued",
      payloadJson: JSON.stringify({ status: input.status, bookingId: input.bookingId }),
      scheduledAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (tableBooking?.venueId && tableBooking.venueTableId) {
    if (input.status === "seated" || input.status === "bottle_service_active") {
      await updateLiveTableStatus({
        venueId: tableBooking.venueId,
        venueTableId: tableBooking.venueTableId,
        status: "occupied",
        actorClerkUserId: input.actorClerkUserId,
        actorRole: input.actorRole,
        note: input.note ?? "Guest seated and service active.",
      });
    }

    if (input.status === "completed") {
      await updateLiveTableStatus({
        venueId: tableBooking.venueId,
        venueTableId: tableBooking.venueTableId,
        status: "cleaning",
        actorClerkUserId: input.actorClerkUserId,
        actorRole: input.actorRole,
        note: input.note ?? "Reservation completed, table ready for cleaning.",
      });
    }

    if (input.status === "cancelled" || input.status === "refunded") {
      await updateLiveTableStatus({
        venueId: tableBooking.venueId,
        venueTableId: tableBooking.venueTableId,
        status: "available",
        actorClerkUserId: input.actorClerkUserId,
        actorRole: input.actorRole,
        note: input.note ?? "Reservation released.",
      });
    }
  }

  if (input.status === "completed") {
    await db.insert(reservationHistory).values({
      bookingId: input.bookingId,
      venueId: tableBooking?.venueId ?? null,
      summaryType: "completed_reservation",
      summaryJson: JSON.stringify({ status: input.status, completedAt: now.toISOString() }),
      createdAt: now,
    });
  }
}

export async function assignServerToReservation(input: {
  bookingId: number;
  venueId: number;
  serverId: number;
  actorClerkUserId: string;
  actorRole: string;
  note?: string | null;
}) {
  const now = new Date();
  const [tableBooking] = await db
    .select({ id: tableBookings.id })
    .from(tableBookings)
    .where(eq(tableBookings.bookingId, input.bookingId))
    .limit(1);

  await db.insert(serverAssignments).values({
    bookingId: input.bookingId,
    tableBookingId: tableBooking?.id ?? null,
    venueId: input.venueId,
    serverId: input.serverId,
    assignedByClerkUserId: input.actorClerkUserId,
    assignmentStatus: "assigned",
    notes: input.note ?? null,
    createdAt: now,
    updatedAt: now,
  });

  await db
    .update(tableBookings)
    .set({
      serverId: input.serverId,
      status: "confirmed",
      updatedAt: now,
    })
    .where(eq(tableBookings.bookingId, input.bookingId));

  await db.insert(reservationNotifications).values({
    bookingId: input.bookingId,
    venueId: input.venueId,
    notificationType: "server_assigned",
    channel: "in_app",
    status: "queued",
    payloadJson: JSON.stringify({ serverId: input.serverId, bookingId: input.bookingId }),
    scheduledAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateLiveTableStatus(input: {
  venueId: number;
  venueTableId: number;
  status: LiveTableStatus;
  actorClerkUserId: string;
  actorRole: string;
  note?: string | null;
}) {
  const now = new Date();

  const [current] = await db
    .select({
      id: venueTables.id,
      metadataJson: venueTables.metadataJson,
    })
    .from(venueTables)
    .where(and(eq(venueTables.id, input.venueTableId), eq(venueTables.venueId, input.venueId)))
    .limit(1);

  if (!current) {
    throw new Error("Table not found.");
  }

  let previousStatus: string | null = null;
  let existingMetadata: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(current.metadataJson) as Record<string, unknown>;
    existingMetadata = parsed;
    previousStatus = typeof parsed.liveStatus === "string" ? parsed.liveStatus : null;
  } catch {
    previousStatus = null;
    existingMetadata = {};
  }

  const normalizedPrevious = (previousStatus ?? "available") as LiveTableStatus;
  if (!canTransitionLiveTableStatus(normalizedPrevious, input.status)) {
    throw new Error(`Illegal table status transition ${normalizedPrevious} -> ${input.status}.`);
  }

  await db
    .update(venueTables)
    .set({
      metadataJson: JSON.stringify({
        ...existingMetadata,
        liveStatus: input.status,
        liveStatusUpdatedAt: now.toISOString(),
      }),
      updatedAt: now,
    })
    .where(eq(venueTables.id, current.id));

  await db.insert(tableStatusLog).values({
    venueId: input.venueId,
    venueTableId: input.venueTableId,
    fromStatus: previousStatus,
    toStatus: input.status,
    actorClerkUserId: input.actorClerkUserId,
    actorRole: input.actorRole,
    note: input.note ?? null,
    createdAt: now,
  });

  if (input.status === "available") {
    const [waiting] = await db
      .select()
      .from(waitlistEntries)
      .where(and(eq(waitlistEntries.venueId, input.venueId), eq(waitlistEntries.status, "waiting")))
      .orderBy(asc(waitlistEntries.createdAt))
      .limit(1);

    if (waiting) {
      await db
        .update(waitlistEntries)
        .set({
          status: "offered",
          notifiedAt: now,
          expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
          updatedAt: now,
        })
        .where(eq(waitlistEntries.id, waiting.id));

      if (waiting.bookingId) {
        await db.insert(reservationNotifications).values({
          bookingId: waiting.bookingId,
          venueId: input.venueId,
          recipientClerkUserId: waiting.clerkUserId,
          notificationType: "waitlist_available",
          channel: "in_app",
          status: "queued",
          payloadJson: JSON.stringify({ waitlistEntryId: waiting.id, venueTableId: input.venueTableId }),
          scheduledAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }
}

export async function getVenueTableOperationsSnapshot(venueId: number) {
  const tables = await db
    .select({
      id: venueTables.id,
      tableCode: venueTables.tableCode,
      name: venueTables.name,
      sectionName: venueTables.sectionName,
      metadataJson: venueTables.metadataJson,
      minimumSpendCents: venueTables.minimumSpendCents,
      updatedAt: venueTables.updatedAt,
    })
    .from(venueTables)
    .where(eq(venueTables.venueId, venueId))
    .orderBy(asc(venueTables.sectionName), asc(venueTables.name));

  const rows = await Promise.all(
    tables.map(async (table) => {
      const [occupying, nextBooking] = await Promise.all([
        db
          .select({
            bookingId: tableBookings.bookingId,
            reservationName: tableBookings.reservationName,
            partySize: tableBookings.partySize,
            startAt: tableBookings.reservationStartAt,
            status: tableBookings.status,
          })
          .from(tableBookings)
          .where(
            and(
              eq(tableBookings.venueId, venueId),
              eq(tableBookings.venueTableId, table.id),
              inArray(tableBookings.status, ["checked_in", "seated", "bottle_service_active"])
            )
          )
          .orderBy(desc(tableBookings.updatedAt))
          .limit(1),
        db
          .select({
            bookingId: tableBookings.bookingId,
            reservationName: tableBookings.reservationName,
            partySize: tableBookings.partySize,
            startAt: tableBookings.reservationStartAt,
            status: tableBookings.status,
          })
          .from(tableBookings)
          .where(
            and(
              eq(tableBookings.venueId, venueId),
              eq(tableBookings.venueTableId, table.id),
              inArray(tableBookings.status, ["confirmed", "deposit_paid", "pending"])
            )
          )
          .orderBy(asc(tableBookings.reservationStartAt))
          .limit(1),
      ]);

      let liveStatus: LiveTableStatus = "available";
      try {
        const parsed = JSON.parse(table.metadataJson) as Record<string, unknown>;
        if (typeof parsed.liveStatus === "string") {
          liveStatus = parsed.liveStatus as LiveTableStatus;
        }
      } catch {
        liveStatus = "available";
      }

      return {
        ...table,
        liveStatus,
        occupyingBooking: occupying[0] ?? null,
        nextBooking: nextBooking[0] ?? null,
      };
    })
  );

  return rows;
}

export async function getOwnerArrivalBoard(venueId: number) {
  const reservations = await db
    .select({
      bookingId: bookings.id,
      bookingNumber: bookings.bookingNumber,
      lifecycleStatus: bookings.lifecycleStatus,
      requestedStartAt: bookings.requestedStartAt,
      guestCount: bookings.guestCount,
      reservationName: tableBookings.reservationName,
      partySize: tableBookings.partySize,
      tableName: venueTables.name,
      serverName: venueServers.displayName,
      serverId: venueServers.id,
      depositRequiredCents: bookings.depositRequiredCents,
      depositStatus: sql<string>`case when ${bookings.lifecycleStatus} in ('deposit_paid','confirmed','checked_in','completed','closed') then 'paid' when ${bookings.lifecycleStatus} = 'deposit_required' then 'required' else 'pending' end`,
      notes: bookings.notes,
      specialRequests: bookings.specialRequests,
    })
    .from(tableBookings)
    .innerJoin(bookings, eq(tableBookings.bookingId, bookings.id))
    .leftJoin(venueTables, eq(tableBookings.venueTableId, venueTables.id))
    .leftJoin(venueServers, eq(tableBookings.serverId, venueServers.id))
    .where(eq(tableBookings.venueId, venueId))
    .orderBy(asc(tableBookings.reservationStartAt), asc(bookings.requestedStartAt));

  const bookingIds = reservations.map((row) => row.bookingId);

  const [bottleRows, splitRows] = bookingIds.length
    ? await Promise.all([
        db
          .select({
            bookingId: bookingBottles.bookingId,
            label: bookingBottles.label,
            quantity: bookingBottles.quantity,
          })
          .from(bookingBottles)
          .where(inArray(bookingBottles.bookingId, bookingIds)),
        db
          .select({
            bookingId: billSplits.bookingId,
            status: billSplits.status,
          })
          .from(billSplits)
          .where(inArray(billSplits.bookingId, bookingIds)),
      ])
    : [[], []];

  return reservations.map((row) => ({
    ...row,
    bottles: bottleRows.filter((item) => item.bookingId === row.bookingId),
    splitStatuses: splitRows.filter((item) => item.bookingId === row.bookingId),
  }));
}

export async function getServerDashboard(input: { venueId: number; serverId: number }) {
  const rows = await db
    .select({
      assignmentId: serverAssignments.id,
      bookingId: serverAssignments.bookingId,
      bookingNumber: bookings.bookingNumber,
      customerName: tableBookings.reservationName,
      tableName: venueTables.name,
      partySize: tableBookings.partySize,
      arrivalAt: tableBookings.reservationStartAt,
      lifecycleStatus: bookings.lifecycleStatus,
      notes: bookings.specialRequests,
      assignmentStatus: serverAssignments.assignmentStatus,
    })
    .from(serverAssignments)
    .innerJoin(bookings, eq(serverAssignments.bookingId, bookings.id))
    .leftJoin(tableBookings, eq(serverAssignments.tableBookingId, tableBookings.id))
    .leftJoin(venueTables, eq(tableBookings.venueTableId, venueTables.id))
    .where(and(eq(serverAssignments.venueId, input.venueId), eq(serverAssignments.serverId, input.serverId)))
    .orderBy(asc(tableBookings.reservationStartAt), desc(serverAssignments.createdAt));

  const bookingIds = rows.map((row) => row.bookingId);
  const bottleRows = bookingIds.length
    ? await db
        .select({
          bookingId: bookingBottles.bookingId,
          label: bookingBottles.label,
          quantity: bookingBottles.quantity,
        })
        .from(bookingBottles)
        .where(inArray(bookingBottles.bookingId, bookingIds))
    : [];

  return rows.map((row) => ({
    ...row,
    bottles: bottleRows.filter((item) => item.bookingId === row.bookingId),
  }));
}

export async function getDoorReservationBoard(input: { venueId: number; query?: string }) {
  const whereClause = input.query?.trim()
    ? and(
        eq(tableBookings.venueId, input.venueId),
        or(
          ilike(bookings.bookingNumber, `%${input.query.trim()}%`),
          ilike(tableBookings.reservationName, `%${input.query.trim()}%`),
          ilike(bookings.notes, `%${input.query.trim()}%`)
        )
      )
    : eq(tableBookings.venueId, input.venueId);

  return db
    .select({
      bookingId: bookings.id,
      bookingNumber: bookings.bookingNumber,
      reservationName: tableBookings.reservationName,
      partySize: tableBookings.partySize,
      tableName: venueTables.name,
      arrivalAt: tableBookings.reservationStartAt,
      lifecycleStatus: bookings.lifecycleStatus,
      specialRequests: bookings.specialRequests,
    })
    .from(tableBookings)
    .innerJoin(bookings, eq(tableBookings.bookingId, bookings.id))
    .leftJoin(venueTables, eq(tableBookings.venueTableId, venueTables.id))
    .where(whereClause)
    .orderBy(asc(tableBookings.reservationStartAt));
}

export async function createWaitlistEntry(input: {
  venueId: number;
  bookingId?: number | null;
  clerkUserId?: string | null;
  fullName: string;
  phone?: string | null;
  partySize: number;
  preferredSection?: string | null;
  preferredTimeAt?: Date | null;
}) {
  const now = new Date();

  const [entry] = await db
    .insert(waitlistEntries)
    .values({
      venueId: input.venueId,
      bookingId: input.bookingId ?? null,
      clerkUserId: input.clerkUserId ?? null,
      fullName: input.fullName,
      phone: input.phone ?? null,
      partySize: Math.max(input.partySize, 1),
      preferredSection: input.preferredSection ?? null,
      preferredTimeAt: input.preferredTimeAt ?? null,
      status: "waiting",
      metadataJson: JSON.stringify({ source: "reservation_waitlist" }),
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return entry;
}

export async function getWaitlistQueue(input: {
  venueId: number;
  date?: Date | null;
  section?: string | null;
  status?: WaitlistStatus | null;
}) {
  const conditions = [eq(waitlistEntries.venueId, input.venueId)];

  if (input.section) {
    conditions.push(eq(waitlistEntries.preferredSection, input.section));
  }

  if (input.status) {
    conditions.push(eq(waitlistEntries.status, input.status));
  }

  if (input.date) {
    const start = new Date(input.date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    conditions.push(sql`${waitlistEntries.createdAt} >= ${start} and ${waitlistEntries.createdAt} < ${end}`);
  }

  return db
    .select()
    .from(waitlistEntries)
    .where(and(...conditions))
    .orderBy(asc(waitlistEntries.createdAt));
}

export async function updateWaitlistStatus(input: {
  venueId: number;
  entryId: number;
  nextStatus: WaitlistStatus;
  actorClerkUserId: string;
  actorRole: string;
  note?: string | null;
  offerExpiresMinutes?: number;
  convertToTableId?: number | null;
}) {
  const now = new Date();

  const [entry] = await db
    .select()
    .from(waitlistEntries)
    .where(and(eq(waitlistEntries.id, input.entryId), eq(waitlistEntries.venueId, input.venueId)))
    .limit(1);

  if (!entry) {
    throw new Error("Waitlist entry not found.");
  }

  const currentStatus = entry.status as WaitlistStatus;
  if (!canTransitionWaitlistStatus(currentStatus, input.nextStatus)) {
    throw new Error(`Illegal waitlist transition ${currentStatus} -> ${input.nextStatus}.`);
  }

  if (currentStatus === input.nextStatus) {
    return entry;
  }

  if (input.nextStatus === "converted") {
    if (!input.convertToTableId) {
      throw new Error("convertToTableId is required for conversion.");
    }

    const [table] = await db
      .select({ id: venueTables.id, metadataJson: venueTables.metadataJson })
      .from(venueTables)
      .where(and(eq(venueTables.id, input.convertToTableId), eq(venueTables.venueId, input.venueId)))
      .limit(1);

    if (!table) {
      throw new Error("Table not found for waitlist conversion.");
    }

    const [activeBooking] = await db
      .select({ id: tableBookings.id })
      .from(tableBookings)
      .where(
        and(
          eq(tableBookings.venueId, input.venueId),
          eq(tableBookings.venueTableId, input.convertToTableId),
          inArray(tableBookings.status, ["confirmed", "checked_in", "seated", "bottle_service_active"])
        )
      )
      .limit(1);

    if (activeBooking) {
      throw new Error("Table is not available for conversion.");
    }

    await updateLiveTableStatus({
      venueId: input.venueId,
      venueTableId: input.convertToTableId,
      status: "reserved",
      actorClerkUserId: input.actorClerkUserId,
      actorRole: input.actorRole,
      note: input.note ?? "Waitlist converted to reservation hold.",
    });
  }

  const expiresAt =
    input.nextStatus === "offered"
      ? new Date(now.getTime() + Math.max(input.offerExpiresMinutes ?? 15, 1) * 60 * 1000)
      : input.nextStatus === "expired"
        ? now
        : entry.expiresAt;

  const [updated] = await db
    .update(waitlistEntries)
    .set({
      status: input.nextStatus,
      notifiedAt: input.nextStatus === "offered" ? now : entry.notifiedAt,
      acceptedAt: input.nextStatus === "accepted" ? now : entry.acceptedAt,
      expiresAt,
      metadataJson: JSON.stringify({
        ...(entry.metadataJson ? JSON.parse(entry.metadataJson) : {}),
        lastAction: input.nextStatus,
        actorClerkUserId: input.actorClerkUserId,
        actorRole: input.actorRole,
        note: input.note ?? null,
        convertToTableId: input.convertToTableId ?? null,
      }),
      updatedAt: now,
    })
    .where(eq(waitlistEntries.id, input.entryId))
    .returning();

  if (entry.bookingId) {
    await db.insert(reservationNotifications).values({
      bookingId: entry.bookingId,
      venueId: input.venueId,
      recipientClerkUserId: entry.clerkUserId,
      notificationType: "waitlist_offer",
      channel: "in_app",
      status: "queued",
      payloadJson: JSON.stringify({ entryId: entry.id, nextStatus: input.nextStatus, expiresAt: expiresAt?.toISOString() ?? null }),
      scheduledAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  return updated;
}

export async function modifyReservation(input: {
  bookingId: number;
  actorClerkUserId: string;
  actorRole: string;
  upgradeTableId?: number | null;
  addBottleIds?: number[];
  addAddonIds?: number[];
  partySize?: number | null;
  cancel?: boolean;
  changeRequest?: string | null;
}) {
  const now = new Date();

  const [booking] = await db.select().from(bookings).where(eq(bookings.id, input.bookingId)).limit(1);
  if (!booking) {
    throw new Error("Booking not found.");
  }

  const currentStatus = booking.lifecycleStatus as BookingLifecycleStatus;
  if (["completed", "closed", "refunded", "refund_pending", "cancelled_by_consumer", "cancelled_by_venue", "cancelled_by_dj", "expired"].includes(currentStatus)) {
    throw new Error("Booking can no longer be modified.");
  }

  if (input.actorRole === "consumer" && input.actorClerkUserId !== booking.consumerClerkUserId) {
    throw new Error("Consumers can only modify their own reservation.");
  }

  if (booking.requestedStartAt && booking.requestedStartAt.getTime() - now.getTime() < 2 * 60 * 60 * 1000) {
    throw new Error("Reservation modifications are locked within 2 hours of start time.");
  }

  const [tableBooking] = await db
    .select({
      id: tableBookings.id,
      venueId: tableBookings.venueId,
      minimumSpendCents: tableBookings.minimumSpendCents,
      depositAmountCents: tableBookings.depositAmountCents,
      partySize: tableBookings.partySize,
    })
    .from(tableBookings)
    .where(eq(tableBookings.bookingId, input.bookingId))
    .limit(1);

  if (!tableBooking) {
    throw new Error("Reservation table context not found.");
  }

  const existingBottles = await db
    .select({ total: sql<number>`coalesce(sum(${bookingBottles.quantity} * ${bookingBottles.unitPriceCents}), 0)::int` })
    .from(bookingBottles)
    .where(eq(bookingBottles.bookingId, input.bookingId));

  const existingAddons = await db
    .select({ total: sql<number>`coalesce(sum(${bookingAddons.totalPriceCents}), 0)::int` })
    .from(bookingAddons)
    .where(eq(bookingAddons.bookingId, input.bookingId));

  let addedBottleTotal = 0;
  let addedAddonTotal = 0;

  if (input.cancel) {
    await db
      .update(bookings)
      .set({
        lifecycleStatus: "cancelled_by_consumer",
        cancelledAt: now,
        updatedAt: now,
      })
      .where(eq(bookings.id, input.bookingId));

    await db.insert(reservationStatusLog).values({
      bookingId: input.bookingId,
      fromStatus: mapLifecycleToCustomerStatus(booking.lifecycleStatus as BookingLifecycleStatus),
      toStatus: "cancelled",
      actorClerkUserId: input.actorClerkUserId,
      actorRole: input.actorRole,
      note: input.changeRequest ?? "Cancelled by customer request.",
      metadataJson: JSON.stringify({}),
      createdAt: now,
    });
  }

  if (input.partySize && input.partySize > 0) {
    await db
      .update(bookings)
      .set({
        guestCount: input.partySize,
        updatedAt: now,
      })
      .where(eq(bookings.id, input.bookingId));

    await db
      .update(tableBookings)
      .set({
        partySize: input.partySize,
        updatedAt: now,
      })
      .where(eq(tableBookings.bookingId, input.bookingId));
  }

  if (input.upgradeTableId) {
    await db
      .update(tableBookings)
      .set({
        venueTableId: input.upgradeTableId,
        updatedAt: now,
      })
      .where(eq(tableBookings.bookingId, input.bookingId));
  }

  if (input.addBottleIds?.length) {
    const bottleRows = await db
      .select()
      .from(venueBottlePackages)
      .where(inArray(venueBottlePackages.id, input.addBottleIds));

    if (bottleRows.length > 0) {
      addedBottleTotal = bottleRows.reduce((sum, bottle) => sum + bottle.priceCents, 0);
      await db.insert(bookingBottles).values(
        bottleRows.map((bottle) => ({
          bookingId: input.bookingId,
          bottlePackageId: bottle.id,
          label: bottle.name,
          quantity: 1,
          unitPriceCents: bottle.priceCents,
          mixersJson: bottle.mixersJson,
          notes: "Added via modification",
          createdAt: now,
          updatedAt: now,
        }))
      );
    }
  }

  if (input.addAddonIds?.length) {
    const addonRows = await db
      .select()
      .from(venueAddons)
      .where(inArray(venueAddons.id, input.addAddonIds));

    if (addonRows.length > 0) {
      addedAddonTotal = addonRows.reduce((sum, addon) => sum + addon.unitPriceCents, 0);
      await db.insert(bookingAddons).values(
        addonRows.map((addon) => ({
          bookingId: input.bookingId,
          venueAddonId: addon.id,
          label: addon.name,
          quantity: 1,
          unitPriceCents: addon.unitPriceCents,
          totalPriceCents: addon.unitPriceCents,
          notes: "Added via modification",
          createdAt: now,
          updatedAt: now,
        }))
      );
    }
  }

  const priorAddons = existingAddons[0]?.total ?? 0;
  const priorBottles = existingBottles[0]?.total ?? 0;
  const revisedTotal = Math.max(tableBooking.minimumSpendCents, tableBooking.minimumSpendCents + priorAddons + priorBottles + addedBottleTotal + addedAddonTotal);

  await db
    .update(bookings)
    .set({
      totalCents: revisedTotal,
      updatedAt: now,
    })
    .where(eq(bookings.id, input.bookingId));

  await db.insert(bookingActivity).values({
    bookingId: input.bookingId,
    actorClerkUserId: input.actorClerkUserId,
    actorRole: input.actorRole,
    activityType: "reservation_modified",
    details: input.changeRequest ?? "Reservation modified.",
    metadataJson: JSON.stringify({
      upgradeTableId: input.upgradeTableId ?? null,
      addBottleIds: input.addBottleIds ?? [],
      addAddonIds: input.addAddonIds ?? [],
      partySize: input.partySize ?? null,
      cancelled: Boolean(input.cancel),
      serverCalculatedDeltaCents: addedBottleTotal + addedAddonTotal,
      revisedTotalCents: revisedTotal,
    }),
    createdAt: now,
  });

  await db.insert(reservationNotifications).values({
    bookingId: input.bookingId,
    venueId: booking.venueId,
    recipientClerkUserId: booking.consumerClerkUserId,
    notificationType: "reservation_modified",
    channel: "in_app",
    status: "queued",
    payloadJson: JSON.stringify({ bookingId: input.bookingId }),
    scheduledAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

export async function getReservationAnalytics(venueId: number) {
  const [summary] = await db
    .select({
      reservationCount: sql<number>`count(*)::int`,
      revenueCents: sql<number>`coalesce(sum(${bookings.totalCents}), 0)::int`,
      averagePartySize: sql<number>`coalesce(avg(${tableBookings.partySize}), 0)::float`,
      noShowCount: sql<number>`count(*) filter (where ${tableBookings.status} = 'no_show')::int`,
      completedCount: sql<number>`count(*) filter (where ${bookings.lifecycleStatus} = 'completed')::int`,
      depositCollectedCount: sql<number>`count(*) filter (where ${bookings.lifecycleStatus} in ('deposit_paid','confirmed','checked_in','completed','closed'))::int`,
    })
    .from(tableBookings)
    .innerJoin(bookings, eq(tableBookings.bookingId, bookings.id))
    .where(eq(tableBookings.venueId, venueId));

  const popularBottles = await db
    .select({
      label: bookingBottles.label,
      quantity: sql<number>`coalesce(sum(${bookingBottles.quantity}), 0)::int`,
    })
    .from(bookingBottles)
    .innerJoin(tableBookings, eq(bookingBottles.bookingId, tableBookings.bookingId))
    .where(eq(tableBookings.venueId, venueId))
    .groupBy(bookingBottles.label)
    .orderBy(sql`coalesce(sum(${bookingBottles.quantity}), 0) desc`)
    .limit(8);

  const topTables = await db
    .select({
      tableName: venueTables.name,
      reservationCount: sql<number>`count(*)::int`,
    })
    .from(tableBookings)
    .leftJoin(venueTables, eq(tableBookings.venueTableId, venueTables.id))
    .where(eq(tableBookings.venueId, venueId))
    .groupBy(venueTables.name)
    .orderBy(sql`count(*) desc`)
    .limit(8);

  const topServers = await db
    .select({
      serverName: venueServers.displayName,
      assignmentCount: sql<number>`count(*)::int`,
    })
    .from(serverAssignments)
    .leftJoin(venueServers, eq(serverAssignments.serverId, venueServers.id))
    .where(eq(serverAssignments.venueId, venueId))
    .groupBy(venueServers.displayName)
    .orderBy(sql`count(*) desc`)
    .limit(8);

  return {
    summary: summary ?? {
      reservationCount: 0,
      revenueCents: 0,
      averagePartySize: 0,
      noShowCount: 0,
      completedCount: 0,
      depositCollectedCount: 0,
    },
    popularBottles,
    topTables,
    topServers,
  };
}
