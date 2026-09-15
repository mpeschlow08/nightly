import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  billSplits,
  bookingActivity,
  bookingAddons,
  bookingAuditLog,
  bookingBottles,
  bookingCheckins,
  bookingContractVersions,
  bookingContracts,
  bookingItems,
  bookingMessages,
  bookingNotifications,
  bookingParticipants,
  bookingPayments,
  bookingPricing,
  bookingRequirements,
  bookingStatusHistory,
  bookings,
  tableBookings,
} from "@/db/schema";
import type { BookingLifecycleStatus } from "@/lib/bookings/types";

export type BookingDbClient = Pick<typeof db, "insert" | "update" | "select" | "transaction" | "execute" | "query">;

export function bookingNumberForNow(now: Date) {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `BK-${datePart}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export function buildStatusPatch(status: BookingLifecycleStatus, now: Date) {
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

export async function addBookingHistory(input: {
  bookingId: number;
  fromStatus: BookingLifecycleStatus | null;
  toStatus: BookingLifecycleStatus;
  actorClerkUserId: string;
  actorRole: string | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
}, dbClient: BookingDbClient = db) {
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
    dbClient.insert(bookingStatusHistory).values(payload),
    dbClient.insert(bookingAuditLog).values({
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

export async function queueBookingNotification(input: {
  bookingId: number;
  notificationType: string;
  recipientClerkUserId?: string | null;
  payload: Record<string, unknown>;
}, dbClient: BookingDbClient = db) {
  await dbClient.insert(bookingNotifications).values({
    bookingId: input.bookingId,
    recipientClerkUserId: input.recipientClerkUserId ?? null,
    notificationType: input.notificationType,
    payloadJson: JSON.stringify(input.payload),
    channel: "in_app",
  });
}

export type CreateBookingWithinTransactionInput = {
  bookingValues: Omit<typeof bookings.$inferInsert, "id" | "createdAt" | "updatedAt"> & {
    createdAt?: Date;
    updatedAt?: Date;
  };
  contractValues: Omit<typeof bookingContracts.$inferInsert, "id" | "bookingId" | "createdAt" | "updatedAt">;
  contractVersionValues: Omit<typeof bookingContractVersions.$inferInsert, "id" | "bookingContractId" | "createdAt">;
  tableBookingValues?: Omit<typeof tableBookings.$inferInsert, "id" | "bookingId" | "createdAt" | "updatedAt"> | null;
  participantValues: Array<Omit<typeof bookingParticipants.$inferInsert, "id" | "bookingId" | "createdAt" | "updatedAt">>;
  pricingValues: Omit<typeof bookingPricing.$inferInsert, "id" | "bookingId" | "createdAt" | "updatedAt">;
  paymentValues: Array<Omit<typeof bookingPayments.$inferInsert, "id" | "bookingId" | "createdAt" | "updatedAt">>;
  itemValues: Array<Omit<typeof bookingItems.$inferInsert, "id" | "bookingId" | "createdAt">>;
  bottleValues?: Array<Omit<typeof bookingBottles.$inferInsert, "id" | "bookingId" | "createdAt" | "updatedAt">>;
  addonValues?: Array<Omit<typeof bookingAddons.$inferInsert, "id" | "bookingId" | "createdAt" | "updatedAt">>;
  splitValues?: Array<Omit<typeof billSplits.$inferInsert, "id" | "bookingId" | "createdAt" | "updatedAt">>;
  requirementValues?: Array<Omit<typeof bookingRequirements.$inferInsert, "id" | "bookingId" | "createdAt" | "updatedAt">>;
  checkinValues: Omit<typeof bookingCheckins.$inferInsert, "id" | "bookingId" | "createdAt" | "updatedAt">;
  messageValues: Omit<typeof bookingMessages.$inferInsert, "id" | "bookingId" | "createdAt">;
  activityValues: Omit<typeof bookingActivity.$inferInsert, "id" | "bookingId" | "createdAt">;
  notificationValues: Omit<typeof bookingNotifications.$inferInsert, "id" | "bookingId" | "createdAt" | "updatedAt">;
  historyValues: {
    fromStatus: BookingLifecycleStatus | null;
    toStatus: BookingLifecycleStatus;
    actorClerkUserId: string;
    actorRole: string | null;
    note?: string | null;
    metadata?: Record<string, unknown>;
  };
};

export async function createBookingWithinTransaction(input: CreateBookingWithinTransactionInput, dbClient: BookingDbClient) {
  const now = new Date();

  if (input.bookingValues.idempotencyKey) {
    const existing = await dbClient
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.idempotencyKey, input.bookingValues.idempotencyKey))
      .limit(1);

    if (existing[0]) {
      return { bookingId: existing[0].id, created: false } as const;
    }
  }

  const [booking] = await dbClient
    .insert(bookings)
    .values({
      ...input.bookingValues,
      createdAt: input.bookingValues.createdAt ?? now,
      updatedAt: input.bookingValues.updatedAt ?? now,
    })
    .returning({ id: bookings.id });

  if (!booking) {
    throw new Error("Failed to create booking.");
  }

  const [bookingContract] = await dbClient
    .insert(bookingContracts)
    .values({
      ...input.contractValues,
      bookingId: booking.id,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: bookingContracts.id });

  if (!bookingContract) {
    throw new Error("Failed to create booking contract.");
  }

  await addBookingHistory({
    bookingId: booking.id,
    ...input.historyValues,
  }, dbClient);

  await Promise.all([
    dbClient.insert(bookingParticipants).values(input.participantValues.map((row) => ({ ...row, bookingId: booking.id, createdAt: now, updatedAt: now }))),
    dbClient.insert(bookingPricing).values({ ...input.pricingValues, bookingId: booking.id, createdAt: now, updatedAt: now }),
    dbClient.insert(bookingPayments).values(input.paymentValues.map((row) => ({ ...row, bookingId: booking.id, createdAt: now, updatedAt: now }))),
    dbClient.insert(bookingItems).values(input.itemValues.map((row) => ({ ...row, bookingId: booking.id, createdAt: now }))),
    dbClient.insert(bookingActivity).values({ ...input.activityValues, bookingId: booking.id, createdAt: now }),
    dbClient.insert(bookingContractVersions).values({ ...input.contractVersionValues, bookingContractId: bookingContract.id, createdAt: now }),
    dbClient.insert(bookingCheckins).values({ ...input.checkinValues, bookingId: booking.id, createdAt: now, updatedAt: now }),
    dbClient.insert(bookingMessages).values({ ...input.messageValues, bookingId: booking.id, createdAt: now }),
    dbClient.insert(bookingNotifications).values({ ...input.notificationValues, bookingId: booking.id, createdAt: now, updatedAt: now }),
    ...(input.tableBookingValues ? [dbClient.insert(tableBookings).values({ ...input.tableBookingValues, bookingId: booking.id, createdAt: now, updatedAt: now })] : []),
    ...(input.bottleValues && input.bottleValues.length > 0
      ? [dbClient.insert(bookingBottles).values(input.bottleValues.map((row) => ({ ...row, bookingId: booking.id, createdAt: now, updatedAt: now })))]
      : []),
    ...(input.addonValues && input.addonValues.length > 0
      ? [dbClient.insert(bookingAddons).values(input.addonValues.map((row) => ({ ...row, bookingId: booking.id, createdAt: now, updatedAt: now })))]
      : []),
    ...(input.splitValues && input.splitValues.length > 0
      ? [dbClient.insert(billSplits).values(input.splitValues.map((row) => ({ ...row, bookingId: booking.id, createdAt: now, updatedAt: now })))]
      : []),
    ...(input.requirementValues && input.requirementValues.length > 0
      ? [dbClient.insert(bookingRequirements).values(input.requirementValues.map((row) => ({ ...row, bookingId: booking.id, createdAt: now, updatedAt: now })))]
      : []),
  ]);

  return { bookingId: booking.id, created: true } as const;
}
