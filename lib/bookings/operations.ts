import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { acquireAdvisoryLock, RESERVATION_LOCK_SCOPE, stableIntHash } from "@/lib/bookings/reservation-locks";
import {
  arrivalLog,
  billSplits,
  bookingActivity,
  bookingAddons,
  bookingContracts,
  bookingBottles,
  bookingCheckins,
  bookingPayments,
  bookings,
  checkInLog,
  reservationHistory,
  reservationNotifications,
  reservationStatusLog,
  serverAssignments,
  tableBookings,
  tableStatusLog,
  venueInventoryItems,
  venueInventoryMovements,
  venueStaffAvailability,
  venueAddons,
  venueBottlePackages,
  venueServers,
  venueTables,
  waitlistEntries,
} from "@/db/schema";
import { bookingNumberForNow, buildStatusPatch, createBookingWithinTransaction, addBookingHistory, queueBookingNotification } from "@/lib/bookings/booking-creation";
import { canTransitionLiveTableStatus, canTransitionReservationStatus, canTransitionWaitlistStatus, getAllowedBookingTransitions, bookingNotificationTypeForStatus, mapCustomerStatusToBookingLifecycle, mapLifecycleToCustomerStatus } from "@/lib/bookings/lifecycle";
import { createReservationPassToken, parseReservationPassToken } from "@/lib/bookings/pass-token";
import { buildReservationPaymentSummary } from "@/lib/bookings/payment-summary";
import type { BookingLifecycleStatus, CustomerReservationStatus, LiveTableStatus, WaitlistStatus } from "@/lib/bookings/types";

type ReservationDbClient = Pick<typeof db, "select" | "insert" | "update" | "delete" | "execute" | "query" | "transaction">;

function parseJsonObject(value: string | null | undefined) {
  if (!value) {
    return {} as Record<string, unknown>;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {} as Record<string, unknown>;
  }
}

function parseJsonArray(value: string | null | undefined) {
  if (!value) {
    return [] as unknown[];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as unknown[];
  }
}

type InventoryBinding = {
  inventoryItemId: number;
  quantityPerPackage: number;
};

function getPackageInventoryBindings(packageItemsJson: string) {
  const parsedObject = parseJsonObject(packageItemsJson);
  const explicitBindings = parseJsonArray(typeof parsedObject.inventoryBindings === "string" ? parsedObject.inventoryBindings : undefined);
  const source = explicitBindings.length > 0 ? explicitBindings : Array.isArray(parsedObject.inventoryBindings) ? parsedObject.inventoryBindings : [];

  return source.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const candidate = entry as Record<string, unknown>;
    const inventoryItemId = Number(candidate.inventoryItemId);
    const quantityPerPackage = Math.max(Number(candidate.quantityPerPackage ?? 0), 0);
    return Number.isFinite(inventoryItemId) && inventoryItemId > 0 && quantityPerPackage > 0
      ? [{ inventoryItemId, quantityPerPackage } satisfies InventoryBinding]
      : [];
  });
}

async function findOverlappingTableBooking(input: { bookingId?: number; venueTableId: number; venueId: number; startAt: Date | null; endAt: Date | null }) {
  if (!input.startAt || !input.endAt) {
    return null;
  }

  const startAt = input.startAt;
  const endAt = input.endAt;

  const rows = await db
    .select({
      id: tableBookings.id,
      bookingId: tableBookings.bookingId,
      reservationStartAt: tableBookings.reservationStartAt,
      reservationEndAt: tableBookings.reservationEndAt,
      status: tableBookings.status,
    })
    .from(tableBookings)
    .where(and(eq(tableBookings.venueId, input.venueId), eq(tableBookings.venueTableId, input.venueTableId)))
    .orderBy(desc(tableBookings.updatedAt));

  return rows.find((row) => {
    if (input.bookingId && row.bookingId === input.bookingId) {
      return false;
    }
    if (!row.reservationStartAt || !row.reservationEndAt) {
      return false;
    }
    if (["cancelled", "refunded", "closed", "expired"].includes(row.status)) {
      return false;
    }
    return row.reservationStartAt < endAt && row.reservationEndAt > startAt;
  }) ?? null;
}

export async function assertTableAvailability(input: {
  bookingId?: number;
  venueId: number;
  venueTableId: number;
  requestedStartAt: Date | null;
  requestedEndAt: Date | null;
}, dbClient: ReservationDbClient = db) {
  const db = dbClient;

  await acquireAdvisoryLock(db, RESERVATION_LOCK_SCOPE.table, input.venueTableId);

  const conflicting = await findOverlappingTableBooking({
    bookingId: input.bookingId,
    venueId: input.venueId,
    venueTableId: input.venueTableId,
    startAt: input.requestedStartAt,
    endAt: input.requestedEndAt,
  });
  if (conflicting) {
    throw new Error("Table is already reserved for an overlapping reservation window.");
  }

  const [table] = await db
    .select({ metadataJson: venueTables.metadataJson })
    .from(venueTables)
    .where(and(eq(venueTables.id, input.venueTableId), eq(venueTables.venueId, input.venueId)))
    .limit(1);

  if (!table) {
    throw new Error("Table not found.");
  }

  const metadata = parseJsonObject(table.metadataJson);
  const liveStatus = typeof metadata.liveStatus === "string" ? metadata.liveStatus : "available";
  if (["blocked", "out_of_service", "occupied", "cleaning"].includes(liveStatus)) {
    throw new Error("Table is not currently available.");
  }
}

export async function syncBookingInventoryReservation(input: {
  bookingId: number;
  venueId: number;
  mode: "reserve" | "release";
  actorClerkUserId: string;
}, dbClient: ReservationDbClient = db) {
  const db = dbClient;

  await acquireAdvisoryLock(db, RESERVATION_LOCK_SCOPE.booking, input.bookingId);

  const bottleSelections = await db
    .select({
      id: bookingBottles.id,
      bookingId: bookingBottles.bookingId,
      bottlePackageId: bookingBottles.bottlePackageId,
      quantity: bookingBottles.quantity,
      packageItemsJson: venueBottlePackages.packageItemsJson,
      packageName: venueBottlePackages.name,
    })
    .from(bookingBottles)
    .innerJoin(venueBottlePackages, eq(bookingBottles.bottlePackageId, venueBottlePackages.id))
    .where(eq(bookingBottles.bookingId, input.bookingId));

  if (bottleSelections.length === 0) {
    return;
  }

  await db.transaction(async (tx) => {
    for (const selection of bottleSelections) {
      for (const binding of getPackageInventoryBindings(selection.packageItemsJson)) {
        const [item] = await tx
          .select()
          .from(venueInventoryItems)
          .where(and(eq(venueInventoryItems.id, binding.inventoryItemId), eq(venueInventoryItems.venueId, input.venueId)))
          .limit(1);

        if (!item) {
          continue;
        }

        const priorMovements = await tx
          .select({
            referenceType: venueInventoryMovements.referenceType,
            quantity: venueInventoryMovements.quantity,
          })
          .from(venueInventoryMovements)
          .where(and(
            eq(venueInventoryMovements.venueId, input.venueId),
            eq(venueInventoryMovements.itemId, item.id),
            eq(venueInventoryMovements.referenceId, input.bookingId)
          ));

        const metadata = parseJsonObject(item.metadataJson);
        await acquireAdvisoryLock(tx, RESERVATION_LOCK_SCOPE.inventoryItem, item.id);
        const reservedQuantity = Math.max(Number(metadata.reservedQuantity ?? 0), 0);
        const hidden = Boolean(metadata.hidden);
        const outOfStock = Boolean(metadata.outOfStock);
        const quantityDelta = binding.quantityPerPackage * Math.max(selection.quantity, 1);
        const netReservedForBooking = priorMovements.reduce((sum, movement) => {
          if (movement.referenceType === "booking_reservation") return sum + movement.quantity;
          if (movement.referenceType === "booking_release") return sum - Math.abs(movement.quantity);
          return sum;
        }, 0);

        if (input.mode === "reserve") {
          if (netReservedForBooking >= quantityDelta) {
            continue;
          }

          const availableQuantity = item.onHandQuantity - reservedQuantity;
          if (hidden || outOfStock || availableQuantity < quantityDelta) {
            throw new Error(`Insufficient inventory for ${selection.packageName}.`);
          }

          await tx.update(venueInventoryItems).set({
            metadataJson: JSON.stringify({
              ...metadata,
              reservedQuantity: reservedQuantity + quantityDelta,
              availableQuantity: Math.max(item.onHandQuantity - (reservedQuantity + quantityDelta), 0),
            }),
            updatedAt: new Date(),
          }).where(eq(venueInventoryItems.id, item.id));

          await tx.insert(venueInventoryMovements).values({
            venueId: input.venueId,
            itemId: item.id,
            movementType: "adjust",
            quantity: quantityDelta,
            referenceType: "booking_reservation",
            referenceId: input.bookingId,
            notes: `Reserved for booking ${input.bookingId}`,
            createdAt: new Date(),
          });
        } else {
          if (netReservedForBooking <= 0) {
            continue;
          }

          const nextReserved = Math.max(reservedQuantity - quantityDelta, 0);
          await tx.update(venueInventoryItems).set({
            metadataJson: JSON.stringify({
              ...metadata,
              reservedQuantity: nextReserved,
              availableQuantity: Math.max(item.onHandQuantity - nextReserved, 0),
            }),
            updatedAt: new Date(),
          }).where(eq(venueInventoryItems.id, item.id));

          await tx.insert(venueInventoryMovements).values({
            venueId: input.venueId,
            itemId: item.id,
            movementType: "adjust",
            quantity: -quantityDelta,
            referenceType: "booking_release",
            referenceId: input.bookingId,
            notes: `Released reservation hold for booking ${input.bookingId}`,
            createdAt: new Date(),
          });
        }
      }
    }
  });
}

function isServerAvailableForTime(params: {
  availabilityRows: Array<{ dayOfWeek: number; startTime: string | null; endTime: string | null }>;
  startAt: Date | null;
  endAt: Date | null;
}) {
  if (!params.startAt || !params.endAt) {
    return true;
  }

  if (params.availabilityRows.length === 0) {
    return true;
  }

  const day = params.startAt.getDay();
  const candidates = params.availabilityRows.filter((row) => row.dayOfWeek === day);
  if (candidates.length === 0) {
    return false;
  }

  const toMinutes = (value: string | null) => {
    if (!value) return null;
    const [hour, minute] = value.split(":").map(Number);
    return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : null;
  };

  const startMinutes = params.startAt.getHours() * 60 + params.startAt.getMinutes();
  const endMinutes = params.endAt.getHours() * 60 + params.endAt.getMinutes();
  return candidates.some((row) => {
    const from = toMinutes(row.startTime);
    const to = toMinutes(row.endTime);
    return from != null && to != null && startMinutes >= from && endMinutes <= to;
  });
}

export async function selectBestAvailableServer(input: {
  venueId: number;
  requestedStartAt: Date | null;
  requestedEndAt: Date | null;
  sectionName?: string | null;
  partySize: number;
  preferredServerId?: number | null;
}, dbClient: ReservationDbClient = db) {
  const db = dbClient;

  const servers = await db
    .select()
    .from(venueServers)
    .where(and(eq(venueServers.venueId, input.venueId), eq(venueServers.isActive, true)))
    .orderBy(desc(venueServers.isLead), asc(venueServers.displayName));

  if (servers.length === 0) {
    return null;
  }

  const assignments = await db
    .select({
      serverId: serverAssignments.serverId,
      reservationStartAt: tableBookings.reservationStartAt,
      reservationEndAt: tableBookings.reservationEndAt,
      partySize: tableBookings.partySize,
    })
    .from(serverAssignments)
    .innerJoin(tableBookings, eq(serverAssignments.tableBookingId, tableBookings.id))
    .where(and(eq(serverAssignments.venueId, input.venueId), eq(serverAssignments.assignmentStatus, "assigned")));

  const availabilityRows = await db
    .select({
      staffProfileId: venueStaffAvailability.staffProfileId,
      dayOfWeek: venueStaffAvailability.dayOfWeek,
      startTime: venueStaffAvailability.startTime,
      endTime: venueStaffAvailability.endTime,
    })
    .from(venueStaffAvailability)
    .where(sql`${venueStaffAvailability.staffProfileId} in (${sql.join(servers.map((server) => sql`${server.staffProfileId ?? -1}`), sql`,`)})`);

  const eligible = servers
    .map((server) => {
      const metadata = parseJsonObject(server.metadataJson);
      const sectionAssignment = typeof metadata.sectionAssignment === "string" ? metadata.sectionAssignment : null;
      const maxTables = Math.max(Number(metadata.maxTables ?? 3), 1);
      const maxGuests = Math.max(Number(metadata.maxGuests ?? 18), 1);
      const priority = Math.max(Number(metadata.priority ?? 0), 0);
      const manualOnly = Boolean(metadata.manualOnly);
      const activeAssignments = assignments.filter((assignment) => {
        if (assignment.serverId !== server.id) return false;
        if (!input.requestedStartAt || !input.requestedEndAt || !assignment.reservationStartAt || !assignment.reservationEndAt) return true;
        return assignment.reservationStartAt < input.requestedEndAt && assignment.reservationEndAt > input.requestedStartAt;
      });
      const assignedGuests = activeAssignments.reduce((sum, assignment) => sum + assignment.partySize, 0);
      const availability = availabilityRows.filter((row) => row.staffProfileId === server.staffProfileId);
      return {
        server,
        sectionAssignment,
        priority,
        manualOnly,
        activeTableCount: activeAssignments.length,
        assignedGuests,
        maxTables,
        maxGuests,
        availableForTime: isServerAvailableForTime({ availabilityRows: availability, startAt: input.requestedStartAt, endAt: input.requestedEndAt }),
      };
    })
    .filter((candidate) => !candidate.manualOnly)
    .filter((candidate) => candidate.availableForTime)
    .filter((candidate) => candidate.activeTableCount < candidate.maxTables)
    .filter((candidate) => candidate.assignedGuests + input.partySize <= candidate.maxGuests)
    .filter((candidate) => !input.sectionName || !candidate.sectionAssignment || candidate.sectionAssignment === input.sectionName)
    .sort((left, right) => right.priority - left.priority || left.activeTableCount - right.activeTableCount || left.assignedGuests - right.assignedGuests);

  if (input.preferredServerId) {
    const preferred = eligible.find((candidate) => candidate.server.id === input.preferredServerId);
    if (!preferred) {
      throw new Error("Preferred server is not available for this reservation.");
    }
    return preferred.server;
  }

  return eligible[0]?.server ?? null;
}

export async function processWaitlistAutomation(input: { venueId: number; actorClerkUserId: string; actorRole: string; sectionName?: string | null }, dbClient: ReservationDbClient = db) {
  const db = dbClient;

  return db.transaction(async (tx) => {
    const now = new Date();
    await acquireAdvisoryLock(tx, RESERVATION_LOCK_SCOPE.waitlistSection, stableIntHash(`${input.venueId}:${input.sectionName ?? "all"}`));
    const queue = await getWaitlistQueue({ venueId: input.venueId, section: input.sectionName ?? null, status: null, date: null });

    for (const entry of queue) {
      if (entry.status === "offered" && entry.expiresAt && entry.expiresAt <= now) {
        await updateWaitlistStatus({
          venueId: input.venueId,
          entryId: entry.id,
          nextStatus: "expired",
          actorClerkUserId: input.actorClerkUserId,
          actorRole: input.actorRole,
          note: "Offer expired automatically.",
        }, tx);
      }
    }

    const refreshed = await getWaitlistQueue({ venueId: input.venueId, section: input.sectionName ?? null, status: null, date: null });
    const hasOpenOffer = refreshed.some((entry) => entry.status === "offered" && (!entry.expiresAt || entry.expiresAt > now));
    if (hasOpenOffer) {
      return refreshed;
    }

    const nextWaiting = refreshed.find((entry) => entry.status === "waiting");
    if (nextWaiting) {
      await updateWaitlistStatus({
        venueId: input.venueId,
        entryId: nextWaiting.id,
        nextStatus: "offered",
        actorClerkUserId: input.actorClerkUserId,
        actorRole: input.actorRole,
        note: "Waitlist offer sent automatically.",
        offerExpiresMinutes: 15,
      }, tx);
    }

    return getWaitlistQueue({ venueId: input.venueId, section: input.sectionName ?? null, status: null, date: null });
  });
}

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

    await reservationLifecycleService.checkIn({
      bookingId: issued.bookingId,
      actorClerkUserId: input.actorClerkUserId,
      actorRole: input.actorRole,
      note: "Checked in via reservation pass.",
    }, tx);

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
}, dbClient: ReservationDbClient = db) {
  const db = dbClient;

  return db.transaction(async (tx) => {
    await acquireAdvisoryLock(tx, RESERVATION_LOCK_SCOPE.booking, input.bookingId);

    const [booking] = await tx
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

    if (currentReservationStatus === input.status) {
      return booking;
    }

    const [tableBooking] = await tx
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
      await tx
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

    await tx.update(bookings).set(lifecyclePatch).where(eq(bookings.id, input.bookingId));

    if (tableBooking?.venueId && ["confirmed", "checked_in"].includes(input.status)) {
      await syncBookingInventoryReservation({
        bookingId: input.bookingId,
        venueId: tableBooking.venueId,
        mode: "reserve",
        actorClerkUserId: input.actorClerkUserId,
      }, tx);
    }

    if (tableBooking?.venueId && ["cancelled", "refunded", "completed"].includes(input.status)) {
      await syncBookingInventoryReservation({
        bookingId: input.bookingId,
        venueId: tableBooking.venueId,
        mode: "release",
        actorClerkUserId: input.actorClerkUserId,
      }, tx);
    }

    if (input.status === "seated") {
      if (tableBooking?.venueId) {
        await tx.insert(arrivalLog).values({
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

    await tx.insert(reservationStatusLog).values({
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

    await tx.insert(bookingActivity).values({
      bookingId: input.bookingId,
      actorClerkUserId: input.actorClerkUserId,
      actorRole: input.actorRole,
      activityType: "reservation_status_update",
      details: input.note ?? `Status updated to ${input.status}`,
      metadataJson: JSON.stringify({ status: input.status }),
      createdAt: now,
    });

    if (tableBooking?.venueId) {
      await tx.insert(reservationNotifications).values({
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
        }, tx);
      }

      if (input.status === "completed") {
        await updateLiveTableStatus({
          venueId: tableBooking.venueId,
          venueTableId: tableBooking.venueTableId,
          status: "cleaning",
          actorClerkUserId: input.actorClerkUserId,
          actorRole: input.actorRole,
          note: input.note ?? "Reservation completed, table ready for cleaning.",
        }, tx);
      }

      if (input.status === "cancelled" || input.status === "refunded") {
        await updateLiveTableStatus({
          venueId: tableBooking.venueId,
          venueTableId: tableBooking.venueTableId,
          status: "available",
          actorClerkUserId: input.actorClerkUserId,
          actorRole: input.actorRole,
          note: input.note ?? "Reservation released.",
        }, tx);
      }

      if (input.status === "completed" || input.status === "cancelled" || input.status === "refunded") {
        await processWaitlistAutomation({
          venueId: tableBooking.venueId,
          actorClerkUserId: input.actorClerkUserId,
          actorRole: input.actorRole,
        }, tx);
      }
    }

    if (input.status === "completed") {
      await tx.insert(reservationHistory).values({
        bookingId: input.bookingId,
        venueId: tableBooking?.venueId ?? null,
        summaryType: "completed_reservation",
        summaryJson: JSON.stringify({ status: input.status, completedAt: now.toISOString() }),
        createdAt: now,
      });
    }

    if (tableBooking?.venueId && tableBooking.venueTableId && (input.status === "cancelled" || input.status === "refunded" || input.status === "completed")) {
      await updateLiveTableStatus({
        venueId: tableBooking.venueId,
        venueTableId: tableBooking.venueTableId,
        status: input.status === "completed" ? "cleaning" : "available",
        actorClerkUserId: input.actorClerkUserId,
        actorRole: input.actorRole,
        note: input.note ?? "Reservation released.",
      }, tx);
    }

    return booking;
  });
}

export async function transitionBookingLifecycleStatus(input: {
  bookingId: number;
  actorClerkUserId: string;
  actorRole: string;
  nextStatus: BookingLifecycleStatus;
  note?: string | null;
}, dbClient: ReservationDbClient = db) {
  const db = dbClient;

  return db.transaction(async (tx) => {
    await acquireAdvisoryLock(tx, RESERVATION_LOCK_SCOPE.booking, input.bookingId);

    const [currentBooking] = await tx
      .select({
        id: bookings.id,
        lifecycleStatus: bookings.lifecycleStatus,
        totalCents: bookings.totalCents,
        counterOfferDepositCents: bookings.counterOfferDepositCents,
        payoutCents: bookings.payoutCents,
        venueId: bookings.venueId,
        requestedStartAt: bookings.requestedStartAt,
        requestedEndAt: bookings.requestedEndAt,
        consumerClerkUserId: bookings.consumerClerkUserId,
        cancellationReason: bookings.cancellationReason,
        refundReason: bookings.refundReason,
        disputeReason: bookings.disputeReason,
      })
      .from(bookings)
      .where(eq(bookings.id, input.bookingId))
      .limit(1);

    if (!currentBooking) {
      throw new Error("Booking not found or inaccessible.");
    }

    if (currentBooking.lifecycleStatus === input.nextStatus) {
      return currentBooking;
    }

    const releaseStatuses = new Set<BookingLifecycleStatus>(["cancelled_by_consumer", "cancelled_by_venue", "cancelled_by_dj", "expired", "closed"]);
    if (releaseStatuses.has(currentBooking.lifecycleStatus as BookingLifecycleStatus) && releaseStatuses.has(input.nextStatus)) {
      return currentBooking;
    }

    const allowed = getAllowedBookingTransitions(currentBooking.lifecycleStatus as BookingLifecycleStatus);
    if (!allowed.includes(input.nextStatus)) {
      throw new Error("That booking transition is not allowed.");
    }

    const now = new Date();
    await tx
      .update(bookings)
      .set({
        lifecycleStatus: input.nextStatus,
        cancellationReason: input.nextStatus.startsWith("cancelled") ? (input.note ?? currentBooking.cancellationReason) : currentBooking.cancellationReason,
        refundReason: input.nextStatus === "refund_pending" ? (input.note ?? currentBooking.refundReason) : currentBooking.refundReason,
        disputeReason: input.nextStatus === "disputed" ? (input.note ?? currentBooking.disputeReason) : currentBooking.disputeReason,
        ...buildStatusPatch(input.nextStatus, now),
        updatedAt: now,
      })
      .where(eq(bookings.id, input.bookingId));

    await addBookingHistory({
      bookingId: input.bookingId,
      fromStatus: currentBooking.lifecycleStatus as BookingLifecycleStatus,
      toStatus: input.nextStatus,
      actorClerkUserId: input.actorClerkUserId,
      actorRole: input.actorRole,
      note: input.note ?? null,
      metadata: { nextStatus: input.nextStatus },
    }, tx);

    await tx.insert(bookingActivity).values({
      bookingId: input.bookingId,
      actorClerkUserId: input.actorClerkUserId,
      actorRole: input.actorRole,
      activityType: "status_transition",
      details: input.note,
      metadataJson: JSON.stringify({ fromStatus: currentBooking.lifecycleStatus, toStatus: input.nextStatus }),
      createdAt: now,
    });

    const [tableBooking] = await tx
      .select({
        id: tableBookings.id,
        venueId: tableBookings.venueId,
        venueTableId: tableBookings.venueTableId,
        serverId: tableBookings.serverId,
        partySize: tableBookings.partySize,
        metadataJson: tableBookings.metadataJson,
      })
      .from(tableBookings)
      .where(eq(tableBookings.bookingId, input.bookingId))
      .limit(1);

    if (["accepted", "deposit_paid", "confirmed"].includes(input.nextStatus) && tableBooking?.venueTableId && currentBooking.venueId) {
      await assertTableAvailability({
        bookingId: input.bookingId,
        venueId: currentBooking.venueId,
        venueTableId: tableBooking.venueTableId,
        requestedStartAt: currentBooking.requestedStartAt,
        requestedEndAt: currentBooking.requestedEndAt,
      }, tx);

      if (!["deposit_paid", "confirmed", "checked_in", "completed", "closed"].includes(currentBooking.lifecycleStatus)) {
        await syncBookingInventoryReservation({
          bookingId: input.bookingId,
          venueId: currentBooking.venueId,
          mode: "reserve",
          actorClerkUserId: input.actorClerkUserId,
        }, tx);
      }

      if (!tableBooking.serverId) {
        const tableMeta = tableBooking.metadataJson ? parseJsonObject(tableBooking.metadataJson) : {};
        const bestServer = await selectBestAvailableServer({
          venueId: currentBooking.venueId,
          requestedStartAt: currentBooking.requestedStartAt,
          requestedEndAt: currentBooking.requestedEndAt,
          sectionName: typeof tableMeta.sectionName === "string" ? tableMeta.sectionName : null,
          partySize: tableBooking.partySize,
          preferredServerId: null,
        }, tx);

        if (bestServer) {
          await assignServerToReservation({
            bookingId: input.bookingId,
            venueId: currentBooking.venueId,
            serverId: bestServer.id,
            actorClerkUserId: input.actorClerkUserId,
            actorRole: input.actorRole,
            note: "Assigned automatically by reservation engine.",
          }, tx);
        }
      }
    }

    if (["cancelled_by_consumer", "cancelled_by_venue", "cancelled_by_dj", "expired", "refunded", "closed"].includes(input.nextStatus) && currentBooking.venueId) {
      await syncBookingInventoryReservation({
        bookingId: input.bookingId,
        venueId: currentBooking.venueId,
        mode: "release",
        actorClerkUserId: input.actorClerkUserId,
      }, tx);
    }

    const projectedStatus = mapLifecycleToCustomerStatus(input.nextStatus);
    if (["confirmed", "checked_in", "seated", "bottle_service_active", "completed", "cancelled", "refunded"].includes(projectedStatus)) {
      await setReservationStatus({
        bookingId: input.bookingId,
        actorClerkUserId: input.actorClerkUserId,
        actorRole: input.actorRole,
        status: projectedStatus,
        note: input.note ?? null,
      }, tx);
    }

    const notificationType = bookingNotificationTypeForStatus(input.nextStatus);
    if (notificationType) {
      await queueBookingNotification({
        bookingId: input.bookingId,
        notificationType,
        recipientClerkUserId: currentBooking.consumerClerkUserId,
        payload: { bookingId: input.bookingId, nextStatus: input.nextStatus },
      }, tx);
    }

    if (input.nextStatus === "deposit_required" && currentBooking.totalCents > 0) {
      const existingDeposit = await tx.select({ id: bookingPayments.id }).from(bookingPayments).where(eq(bookingPayments.bookingId, input.bookingId)).limit(1);
      if (existingDeposit.length === 0) {
        await tx.insert(bookingPayments).values({
          bookingId: input.bookingId,
          provider: "nightly_manual",
          status: "due",
          amountCents: currentBooking.counterOfferDepositCents ?? Math.round(currentBooking.totalCents * 0.2),
          currency: "USD",
          platformFeeCents: Math.round(currentBooking.totalCents * 0.12),
          payoutCents: currentBooking.payoutCents,
          dueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    if (input.nextStatus === "accepted") {
      await tx.update(bookingContracts).set({ status: "sent", sentAt: now, updatedAt: now }).where(eq(bookingContracts.bookingId, input.bookingId));
    }

    return currentBooking;
  });
}

export async function assignServerToReservation(input: {
  bookingId: number;
  venueId: number;
  serverId: number;
  actorClerkUserId: string;
  actorRole: string;
  note?: string | null;
}, dbClient: ReservationDbClient = db) {
  const db = dbClient;

  return db.transaction(async (tx) => {
    await acquireAdvisoryLock(tx, RESERVATION_LOCK_SCOPE.booking, input.bookingId);
    await acquireAdvisoryLock(tx, RESERVATION_LOCK_SCOPE.server, input.serverId);

    const now = new Date();
    const [tableBooking] = await tx
      .select({ id: tableBookings.id })
      .from(tableBookings)
      .where(eq(tableBookings.bookingId, input.bookingId))
      .limit(1);

    const [booking] = await tx
      .select({
        requestedStartAt: bookings.requestedStartAt,
        requestedEndAt: bookings.requestedEndAt,
        guestCount: bookings.guestCount,
        venueId: bookings.venueId,
      })
      .from(bookings)
      .where(eq(bookings.id, input.bookingId))
      .limit(1);

    const tableMeta = tableBooking?.id
      ? await tx
          .select({ metadataJson: tableBookings.metadataJson, partySize: tableBookings.partySize })
          .from(tableBookings)
          .where(eq(tableBookings.id, tableBooking.id))
          .limit(1)
      : [];

    const serverMatch = await selectBestAvailableServer({
      venueId: input.venueId,
      requestedStartAt: booking?.requestedStartAt ?? null,
      requestedEndAt: booking?.requestedEndAt ?? null,
      sectionName: (() => {
        const metadataJson = tableMeta[0]?.metadataJson;
        if (!metadataJson) return null;
        try {
          const metadata = JSON.parse(metadataJson) as Record<string, unknown>;
          return typeof metadata.sectionName === "string" ? metadata.sectionName : null;
        } catch {
          return null;
        }
      })(),
      partySize: tableMeta[0]?.partySize ?? booking?.guestCount ?? 1,
      preferredServerId: input.serverId,
    }, tx);

    if (!serverMatch || serverMatch.id !== input.serverId) {
      throw new Error("Preferred server is not available for this reservation.");
    }

    await tx.insert(serverAssignments).values({
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

    await tx
      .update(tableBookings)
      .set({
        serverId: input.serverId,
        status: "confirmed",
        updatedAt: now,
      })
      .where(eq(tableBookings.bookingId, input.bookingId));

    await tx.insert(reservationNotifications).values({
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
  });
}

export async function updateLiveTableStatus(input: {
  venueId: number;
  venueTableId: number;
  status: LiveTableStatus;
  actorClerkUserId: string;
  actorRole: string;
  note?: string | null;
}, dbClient: ReservationDbClient = db) {
  const db = dbClient;

  return db.transaction(async (tx) => {
    await acquireAdvisoryLock(tx, RESERVATION_LOCK_SCOPE.table, input.venueTableId);

    const now = new Date();

    const [current] = await tx
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

    if (normalizedPrevious === input.status) {
      return current;
    }

    await tx
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

    await tx.insert(tableStatusLog).values({
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
      await processWaitlistAutomation({
        venueId: input.venueId,
        actorClerkUserId: input.actorClerkUserId,
        actorRole: input.actorRole,
      }, tx);
    }
  });
}

export async function getVenueTableOperationsSnapshot(venueId: number, dbClient: ReservationDbClient = db) {
  const db = dbClient;

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

export async function acceptWaitlistOffer(input: {
  venueId: number;
  entryId: number;
  actorClerkUserId: string;
  actorRole: string;
  note?: string | null;
  convertToTableId?: number | null;
}, dbClient: ReservationDbClient = db) {
  const db = dbClient;

  return db.transaction(async (tx) => {
    await acquireAdvisoryLock(tx, RESERVATION_LOCK_SCOPE.waitlistEntry, input.entryId);

    const now = new Date();
    const [entry] = await tx
      .select()
      .from(waitlistEntries)
      .where(and(eq(waitlistEntries.id, input.entryId), eq(waitlistEntries.venueId, input.venueId)))
      .limit(1);

    if (!entry) {
      throw new Error("Waitlist entry not found.");
    }

    if (entry.status === "converted" && entry.bookingId) {
      return entry;
    }

    if (!entry.clerkUserId) {
      throw new Error("Waitlist entry cannot be converted without an authenticated consumer.");
    }

    if (input.actorRole === "consumer" && input.actorClerkUserId !== entry.clerkUserId) {
      throw new Error("Forbidden");
    }

    if (entry.status !== "offered" && entry.status !== "accepted") {
      throw new Error("Waitlist offer is not active.");
    }

    if (entry.expiresAt && entry.expiresAt <= now) {
      throw new Error("Waitlist offer has expired.");
    }

    const metadata = parseJsonObject(entry.metadataJson);
    const requestedStartAt = entry.preferredTimeAt ?? now;
    const requestedEndAt = new Date(requestedStartAt.getTime() + 90 * 60 * 1000);
    const selectedTableIdFromMetadata = Number(metadata.convertToTableId ?? 0);

    let tableId = input.convertToTableId ?? (Number.isFinite(selectedTableIdFromMetadata) && selectedTableIdFromMetadata > 0 ? selectedTableIdFromMetadata : null);

    if (!tableId) {
      const snapshot = await getVenueTableOperationsSnapshot(input.venueId, tx);
      const candidate = snapshot.find((row) => {
        if (row.liveStatus !== "available") return false;
        if (entry.preferredSection && row.sectionName !== entry.preferredSection) return false;
        return true;
      });

      if (!candidate) {
        throw new Error("No table available for waitlist conversion.");
      }

      tableId = candidate.id;
    }

    await acquireAdvisoryLock(tx, RESERVATION_LOCK_SCOPE.table, tableId);

    const [table] = await tx
      .select({
        id: venueTables.id,
        venueId: venueTables.venueId,
        sectionName: venueTables.sectionName,
        minimumSpendCents: venueTables.minimumSpendCents,
        depositPercent: venueTables.depositPercent,
        metadataJson: venueTables.metadataJson,
      })
      .from(venueTables)
      .where(and(eq(venueTables.id, tableId), eq(venueTables.venueId, input.venueId)))
      .limit(1);

    if (!table) {
      throw new Error("Table not found for waitlist conversion.");
    }

    await assertTableAvailability({
      venueId: input.venueId,
      venueTableId: tableId,
      requestedStartAt,
      requestedEndAt,
    }, tx);

    const tableMetadata = parseJsonObject(table.metadataJson);
    const reservationFeeCents = Number(tableMetadata.reservationFeeCents ?? 0) || 0;
    const bottleMinimumCents = Number(tableMetadata.bottleMinimumCents ?? 0) || 0;
    const paymentSummary = buildReservationPaymentSummary({
      minimumSpendCents: Math.max(table.minimumSpendCents, 0),
      bottleMinimumCents,
      reservationFeeCents,
      bottleSubtotalCents: 0,
      addonSubtotalCents: 0,
      depositPercent: Math.min(Math.max(table.depositPercent ?? 20, 0), 100),
      paymentOption: "deposit_only",
    });

    const selectedServer = await selectBestAvailableServer({
      venueId: input.venueId,
      requestedStartAt,
      requestedEndAt,
      sectionName: table.sectionName,
      partySize: Math.max(entry.partySize, 1),
      preferredServerId: null,
    }, tx);

    const bookingNumber = bookingNumberForNow(now);
    const totalCents = Math.max(paymentSummary.totalCents, 0);
    const platformFeeCents = Math.round(totalCents * 0.12);
    const payoutCents = Math.max(totalCents - platformFeeCents, 0);
    const idempotencyKey = `waitlist-convert:${entry.id}`;

    const created = await createBookingWithinTransaction({
      bookingValues: {
        bookingNumber,
        bookingType: "vip_table_reservation",
        lifecycleStatus: "confirmed",
        idempotencyKey,
        requesterClerkUserId: entry.clerkUserId,
        consumerClerkUserId: entry.clerkUserId,
        venueId: input.venueId,
        city: null,
        timezone: "America/New_York",
        requestedForAt: requestedStartAt,
        requestedStartAt,
        requestedEndAt,
        durationMinutes: 90,
        guestCount: Math.max(entry.partySize, 1),
        budgetCents: totalCents,
        notes: input.note ?? "Converted from waitlist offer.",
        inspirationText: null,
        specialRequests: null,
        source: "waitlist_conversion",
        depositRequiredCents: Math.max(paymentSummary.depositCents, 0),
        totalCents,
        platformFeeCents,
        payoutCents,
        ...buildStatusPatch("confirmed", now),
      },
      contractValues: {
        versionNumber: 1,
        status: "sent",
        title: `Nightly booking ${bookingNumber}`,
        termsJson: JSON.stringify({
          bookingNumber,
          bookingType: "vip_table_reservation",
          source: "waitlist_conversion",
          requestedStartAt: requestedStartAt.toISOString(),
          requestedEndAt: requestedEndAt.toISOString(),
        }),
        generatedAt: now,
        sentAt: now,
      },
      contractVersionValues: {
        versionNumber: 1,
        contentJson: JSON.stringify({
          title: `Nightly booking ${bookingNumber}`,
          requestedStartAt: requestedStartAt.toISOString(),
          requestedEndAt: requestedEndAt.toISOString(),
          source: "waitlist_conversion",
        }),
        createdByClerkUserId: input.actorClerkUserId,
      },
      tableBookingValues: {
        venueId: input.venueId,
        venueTableId: table.id,
        serverId: selectedServer?.id ?? null,
        bookingCategory: "vip_table",
        reservationName: entry.fullName,
        partySize: Math.max(entry.partySize, 1),
        reservationStartAt: requestedStartAt,
        reservationEndAt: requestedEndAt,
        status: "confirmed",
        minimumSpendCents: Math.max(table.minimumSpendCents, 0),
        depositAmountCents: Math.max(paymentSummary.depositCents, 0),
        notes: input.note ?? null,
        metadataJson: JSON.stringify({
          sectionName: table.sectionName,
          convertedFromWaitlistId: entry.id,
        }),
      },
      participantValues: [
        {
          participantRole: "consumer",
          clerkUserId: entry.clerkUserId,
          displayName: entry.fullName,
          isPrimary: true,
          responseStatus: "confirmed",
        },
        {
          participantRole: "venue",
          clerkUserId: `venue-${input.venueId}`,
          venueId: input.venueId,
          displayName: "Venue",
          isPrimary: false,
          responseStatus: "invited",
        },
      ],
      pricingValues: {
        pricingKind: "quote",
        quoteVersion: 1,
        baseAmountCents: paymentSummary.spendTargetCents + reservationFeeCents,
        depositAmountCents: paymentSummary.depositCents,
        serviceFeeCents: paymentSummary.serviceFeeCents,
        taxCents: paymentSummary.taxCents,
        platformFeeCents,
        travelFeeCents: 0,
        surgeFeeCents: 0,
        discountCents: 0,
        totalAmountCents: totalCents,
        currency: "USD",
        quoteNotes: "Converted from waitlist offer.",
      },
      paymentValues: [
        {
          provider: "nightly_manual",
          status: "due",
          amountCents: paymentSummary.dueNowCents,
          currency: "USD",
          platformFeeCents,
          payoutCents,
          paymentMethod: "deposit_only",
          dueAt: now,
        },
      ],
      itemValues: [
        {
          itemType: "reservation_base",
          referenceId: table.id,
          label: "Waitlist table conversion",
          quantity: 1,
          unitPriceCents: paymentSummary.spendTargetCents + reservationFeeCents,
          totalPriceCents: paymentSummary.spendTargetCents + reservationFeeCents,
          metadataJson: JSON.stringify({ source: "waitlist_conversion" }),
        },
      ],
      checkinValues: {
        status: "pending",
      },
      messageValues: {
        senderRole: "system",
        senderClerkUserId: "system",
        messageType: "timeline",
        body: "Your waitlist offer was accepted and converted to a reservation.",
        isSystem: true,
      },
      activityValues: {
        actorClerkUserId: input.actorClerkUserId,
        actorRole: input.actorRole,
        activityType: "waitlist_conversion",
        details: input.note ?? "Waitlist offer accepted and converted.",
        metadataJson: JSON.stringify({ entryId: entry.id, tableId: table.id }),
      },
      notificationValues: {
        recipientClerkUserId: entry.clerkUserId,
        notificationType: "booking_confirmed",
        payloadJson: JSON.stringify({ source: "waitlist_conversion", tableId: table.id }),
        status: "queued",
        scheduledAt: now,
      },
      historyValues: {
        fromStatus: null,
        toStatus: "confirmed",
        actorClerkUserId: input.actorClerkUserId,
        actorRole: input.actorRole,
        note: input.note ?? "Created from waitlist acceptance.",
        metadata: { entryId: entry.id, tableId: table.id },
      },
    }, tx);

    await updateLiveTableStatus({
      venueId: input.venueId,
      venueTableId: table.id,
      status: "reserved",
      actorClerkUserId: input.actorClerkUserId,
      actorRole: input.actorRole,
      note: input.note ?? "Waitlist converted to reservation hold.",
    }, tx);

    const [updated] = await tx
      .update(waitlistEntries)
      .set({
        status: "converted",
        bookingId: created.bookingId,
        acceptedAt: entry.acceptedAt ?? now,
        metadataJson: JSON.stringify({
          ...metadata,
          convertedBookingId: created.bookingId,
          convertToTableId: table.id,
          convertedByClerkUserId: input.actorClerkUserId,
          convertedAtIso: now.toISOString(),
        }),
        updatedAt: now,
      })
      .where(eq(waitlistEntries.id, entry.id))
      .returning();

    return updated;
  });
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
}, dbClient: ReservationDbClient = db) {
  const db = dbClient;

  return db.transaction(async (tx) => {
    await acquireAdvisoryLock(tx, RESERVATION_LOCK_SCOPE.waitlistEntry, input.entryId);

    const now = new Date();

    const [entry] = await tx
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

    if (input.nextStatus === "accepted" || input.nextStatus === "converted") {
      return acceptWaitlistOffer({
        venueId: input.venueId,
        entryId: input.entryId,
        actorClerkUserId: input.actorClerkUserId,
        actorRole: input.actorRole,
        note: input.note ?? null,
        convertToTableId: input.convertToTableId ?? null,
      }, tx);
    }

    const expiresAt =
      input.nextStatus === "offered"
        ? new Date(now.getTime() + Math.max(input.offerExpiresMinutes ?? 15, 1) * 60 * 1000)
        : input.nextStatus === "expired"
          ? now
          : entry.expiresAt;

    const [updated] = await tx
      .update(waitlistEntries)
      .set({
        status: input.nextStatus,
        notifiedAt: input.nextStatus === "offered" ? now : entry.notifiedAt,
        acceptedAt: entry.acceptedAt,
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
      await tx.insert(reservationNotifications).values({
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
  });
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
}, dbClient: ReservationDbClient = db) {
  const db = dbClient;

  return db.transaction(async (tx) => {
    await acquireAdvisoryLock(tx, RESERVATION_LOCK_SCOPE.booking, input.bookingId);

    const now = new Date();

    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, input.bookingId)).limit(1);
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

    const [tableBooking] = await tx
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

    const existingBottles = await tx
      .select({ total: sql<number>`coalesce(sum(${bookingBottles.quantity} * ${bookingBottles.unitPriceCents}), 0)::int` })
      .from(bookingBottles)
      .where(eq(bookingBottles.bookingId, input.bookingId));

    const existingAddons = await tx
      .select({ total: sql<number>`coalesce(sum(${bookingAddons.totalPriceCents}), 0)::int` })
      .from(bookingAddons)
      .where(eq(bookingAddons.bookingId, input.bookingId));

    let addedBottleTotal = 0;
    let addedAddonTotal = 0;

    if (input.cancel) {
      await transitionBookingLifecycleStatus({
        bookingId: input.bookingId,
        actorClerkUserId: input.actorClerkUserId,
        actorRole: input.actorRole,
        nextStatus: "cancelled_by_consumer",
        note: input.changeRequest ?? "Cancelled by customer request.",
      }, tx);
      return;
    }

    if (input.partySize && input.partySize > 0) {
      await tx
        .update(bookings)
        .set({
          guestCount: input.partySize,
          updatedAt: now,
        })
        .where(eq(bookings.id, input.bookingId));

      await tx
        .update(tableBookings)
        .set({
          partySize: input.partySize,
          updatedAt: now,
        })
        .where(eq(tableBookings.bookingId, input.bookingId));
    }

    if (input.upgradeTableId) {
      await tx
        .update(tableBookings)
        .set({
          venueTableId: input.upgradeTableId,
          updatedAt: now,
        })
        .where(eq(tableBookings.bookingId, input.bookingId));
    }

    if (input.addBottleIds?.length) {
      const bottleRows = await tx
        .select()
        .from(venueBottlePackages)
        .where(inArray(venueBottlePackages.id, input.addBottleIds));

      if (bottleRows.length > 0) {
        addedBottleTotal = bottleRows.reduce((sum, bottle) => sum + bottle.priceCents, 0);
        await tx.insert(bookingBottles).values(
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
      const addonRows = await tx
        .select()
        .from(venueAddons)
        .where(inArray(venueAddons.id, input.addAddonIds));

      if (addonRows.length > 0) {
        addedAddonTotal = addonRows.reduce((sum, addon) => sum + addon.unitPriceCents, 0);
        await tx.insert(bookingAddons).values(
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

    await tx
      .update(bookings)
      .set({
        totalCents: revisedTotal,
        updatedAt: now,
      })
      .where(eq(bookings.id, input.bookingId));

    await tx.insert(bookingActivity).values({
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

    await tx.insert(reservationNotifications).values({
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
  });
}

export async function recordDoorReservationAction(input: {
  bookingId?: number | null;
  venueId: number;
  actorClerkUserId: string;
  actorRole: string;
  action: "arrived" | "late_arrival" | "no_show" | "walk_in_conversion";
  note?: string | null;
  fullName?: string | null;
  partySize?: number | null;
  preferredSection?: string | null;
}) {
  if (input.action === "walk_in_conversion") {
    const now = new Date();
    const entry = await createWaitlistEntry({
      venueId: input.venueId,
      bookingId: null,
      clerkUserId: null,
      fullName: input.fullName?.trim() || "Walk-in guest",
      phone: null,
      partySize: Math.max(input.partySize ?? 2, 1),
      preferredSection: input.preferredSection ?? null,
      preferredTimeAt: now,
    });

    return { kind: "waitlist_entry", entryId: entry.id } as const;
  }

  if (!input.bookingId) {
    throw new Error("bookingId is required.");
  }

  const bookingId = input.bookingId;

  return db.transaction(async (tx) => {
    const now = new Date();

    await acquireAdvisoryLock(tx, RESERVATION_LOCK_SCOPE.booking, bookingId);

    if (input.action === "arrived") {
      await setReservationStatus({
        bookingId,
        actorClerkUserId: input.actorClerkUserId,
        actorRole: input.actorRole,
        status: "checked_in",
        note: input.note ?? "Guest arrived at door.",
      }, tx);

      return { kind: "booking", status: "checked_in" } as const;
    }

    if (input.action === "late_arrival") {
      await tx.insert(bookingActivity).values({
        bookingId,
        actorClerkUserId: input.actorClerkUserId,
        actorRole: input.actorRole,
        activityType: "late_arrival_flagged",
        details: input.note ?? "Guest reported late arrival.",
        metadataJson: JSON.stringify({ venueId: input.venueId }),
        createdAt: now,
      });

      return { kind: "booking", status: "late_arrival_flagged" } as const;
    }

    const [existingCheckin] = await tx
      .select({ id: bookingCheckins.id, status: bookingCheckins.status })
      .from(bookingCheckins)
      .where(eq(bookingCheckins.bookingId, bookingId))
      .limit(1);

    if (existingCheckin?.status === "no_show") {
      return { kind: "booking", status: "no_show" } as const;
    }

    if (existingCheckin) {
      await tx
        .update(bookingCheckins)
        .set({
          status: "no_show",
          notes: input.note ?? "Marked as no-show by door staff.",
          updatedAt: now,
        })
        .where(eq(bookingCheckins.bookingId, bookingId));
    } else {
      await tx.insert(bookingCheckins).values({
        bookingId,
        status: "no_show",
        notes: input.note ?? "Marked as no-show by door staff.",
        updatedAt: now,
      });
    }

    await transitionBookingLifecycleStatus({
      bookingId,
      actorClerkUserId: input.actorClerkUserId,
      actorRole: input.actorRole,
      nextStatus: "closed",
      note: input.note ?? "Guest marked as no-show.",
    }, tx);

    await tx.insert(bookingActivity).values({
      bookingId,
      actorClerkUserId: input.actorClerkUserId,
      actorRole: input.actorRole,
      activityType: "no_show_recorded",
      details: input.note ?? "Guest marked as no-show.",
      metadataJson: JSON.stringify({ venueId: input.venueId }),
      createdAt: now,
    });

    return { kind: "booking", status: "no_show" } as const;
  });
}

export const reservationLifecycleService = {
  transitionReservationStatus: setReservationStatus,
  transitionBookingLifecycleStatus,
  acceptWaitlistOffer,
  async cancel(input: { bookingId: number; actorClerkUserId: string; actorRole: string; note?: string | null }, dbClient: ReservationDbClient = db) {
    const nextStatus: BookingLifecycleStatus = input.actorRole === "consumer" ? "cancelled_by_consumer" : "cancelled_by_venue";
    return transitionBookingLifecycleStatus({
      bookingId: input.bookingId,
      actorClerkUserId: input.actorClerkUserId,
      actorRole: input.actorRole,
      nextStatus,
      note: input.note ?? null,
    }, dbClient);
  },
  async expire(input: { bookingId: number; actorClerkUserId: string; actorRole: string; note?: string | null }, dbClient: ReservationDbClient = db) {
    return transitionBookingLifecycleStatus({
      bookingId: input.bookingId,
      actorClerkUserId: input.actorClerkUserId,
      actorRole: input.actorRole,
      nextStatus: "expired",
      note: input.note ?? null,
    }, dbClient);
  },
  async checkIn(input: { bookingId: number; actorClerkUserId: string; actorRole: string; note?: string | null }, dbClient: ReservationDbClient = db) {
    return setReservationStatus({
      bookingId: input.bookingId,
      actorClerkUserId: input.actorClerkUserId,
      actorRole: input.actorRole,
      status: "checked_in",
      note: input.note ?? null,
    }, dbClient);
  },
  async complete(input: { bookingId: number; actorClerkUserId: string; actorRole: string; note?: string | null }, dbClient: ReservationDbClient = db) {
    return transitionBookingLifecycleStatus({
      bookingId: input.bookingId,
      actorClerkUserId: input.actorClerkUserId,
      actorRole: input.actorRole,
      nextStatus: "completed",
      note: input.note ?? null,
    }, dbClient);
  },
  async markNoShow(input: { bookingId: number; actorClerkUserId: string; actorRole: string; note?: string | null }, dbClient: ReservationDbClient = db) {
    return transitionBookingLifecycleStatus({
      bookingId: input.bookingId,
      actorClerkUserId: input.actorClerkUserId,
      actorRole: input.actorRole,
      nextStatus: "closed",
      note: input.note ?? "Guest marked as no-show.",
    }, dbClient);
  },
};

export async function getReservationAnalytics(venueId: number) {
  const [summary] = await db
    .select({
      reservationCount: sql<number>`count(*)::int`,
      revenueCents: sql<number>`coalesce(sum(${bookings.totalCents}), 0)::int`,
      averagePartySize: sql<number>`coalesce(avg(${tableBookings.partySize}), 0)::float`,
      noShowCount: sql<number>`count(*) filter (where ${tableBookings.status} = 'no_show')::int`,
      lateCount: sql<number>`count(*) filter (where ${arrivalLog.delayMinutes} > 0)::int`,
      completedCount: sql<number>`count(*) filter (where ${bookings.lifecycleStatus} = 'completed')::int`,
      depositCollectedCount: sql<number>`count(*) filter (where ${bookings.lifecycleStatus} in ('deposit_paid','confirmed','checked_in','completed','closed'))::int`,
      projectedRevenueCents: sql<number>`coalesce(sum(case when ${bookings.lifecycleStatus} in ('requested','pending_review','accepted','deposit_required','deposit_paid','confirmed','checked_in') then ${bookings.totalCents} else 0 end), 0)::int`,
    })
    .from(tableBookings)
    .innerJoin(bookings, eq(tableBookings.bookingId, bookings.id))
    .leftJoin(arrivalLog, eq(arrivalLog.tableBookingId, tableBookings.id))
    .where(eq(tableBookings.venueId, venueId));

  const [occupancy] = await db
    .select({
      activeTableCount: sql<number>`count(distinct ${tableBookings.venueTableId}) filter (where ${tableBookings.status} in ('confirmed','checked_in','seated','bottle_service_active'))::int`,
      totalTableCount: sql<number>`count(distinct ${venueTables.id})::int`,
    })
    .from(venueTables)
    .leftJoin(tableBookings, and(eq(tableBookings.venueTableId, venueTables.id), eq(tableBookings.venueId, venueId)))
    .where(eq(venueTables.venueId, venueId));

  const [waitlist] = await db
    .select({
      waitlistConversions: sql<number>`count(*) filter (where ${waitlistEntries.status} = 'converted')::int`,
      waitlistEntriesCount: sql<number>`count(*)::int`,
    })
    .from(waitlistEntries)
    .where(eq(waitlistEntries.venueId, venueId));

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

  const peakArrival = await db
    .select({
      hourBucket: sql<string>`to_char(date_trunc('hour', ${arrivalLog.arrivedAt}), 'HH24:00')`,
      arrivalCount: sql<number>`count(*)::int`,
    })
    .from(arrivalLog)
    .where(eq(arrivalLog.venueId, venueId))
    .groupBy(sql`date_trunc('hour', ${arrivalLog.arrivedAt})`)
    .orderBy(sql`count(*) desc`)
    .limit(1);

  return {
    summary: summary ?? {
      reservationCount: 0,
      revenueCents: 0,
      averagePartySize: 0,
      noShowCount: 0,
      lateCount: 0,
      completedCount: 0,
      depositCollectedCount: 0,
      projectedRevenueCents: 0,
    },
    occupancy: {
      activeTableCount: occupancy?.activeTableCount ?? 0,
      totalTableCount: occupancy?.totalTableCount ?? 0,
      occupancyPercent: occupancy?.totalTableCount ? Math.round(((occupancy.activeTableCount ?? 0) / occupancy.totalTableCount) * 100) : 0,
    },
    waitlist: {
      conversions: waitlist?.waitlistConversions ?? 0,
      totalEntries: waitlist?.waitlistEntriesCount ?? 0,
    },
    peakArrivalHour: peakArrival[0]?.hourBucket ?? null,
    popularBottles,
    topTables,
    topServers,
  };
}
