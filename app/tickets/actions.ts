"use server";

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { writeAuditLog } from "@/app/lib/audit-log";
import { db } from "@/db";
import { events, guestListEntries, guestLists, ticketOrderItems, ticketOrders, ticketProducts, ticketScans, ticketScanSessions, tickets, venues } from "@/db/schema";
import { isKillSwitchEnabled } from "@/lib/platform/kill-switches";
import { verifyTicketToken } from "@/lib/ticketing/token";
import { getTicketActor, requireConsumerTicketActor, requireDoorStaffTicketActor } from "./lib/auth";
import type { TicketScanDecision } from "@/lib/ticketing/types";

function toNumber(value: FormDataEntryValue | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStringValue(value: FormDataEntryValue | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function orderNumber(now: Date) {
  return `TO-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

async function logTicketAudit(input: {
  eventId: number;
  ticketId?: number | null;
  orderId?: number | null;
  actorClerkUserId: string;
  actorRole: string;
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}) {
  await writeAuditLog({
    actorClerkUserId: input.actorClerkUserId,
    actorRole: input.actorRole,
    entityType: "ticket",
    entityId: input.ticketId ?? input.orderId ?? input.eventId,
    action: input.action,
    previousValues: input.before ?? undefined,
    nextValues: input.after ?? undefined,
    metadata: {
      eventId: input.eventId,
      ticketId: input.ticketId ?? null,
      orderId: input.orderId ?? null,
      ...(input.metadata ?? {}),
    },
  });
}

export async function createTicketOrderAction(formData: FormData) {
  const actor = await requireConsumerTicketActor();
  const checkoutDisabled = await isKillSwitchEnabled("ticket_checkout", {
    userId: actor.clerkUserId,
    role: actor.role,
  });

  if (checkoutDisabled) {
    throw new Error("Ticket checkout is temporarily disabled.");
  }

  const eventId = Number(formData.get("eventId"));
  const productId = Number(formData.get("productId"));
  const quantity = Math.max(toNumber(formData.get("quantity")) ?? 1, 1);
  const idempotencyKey = toStringValue(formData.get("idempotencyKey")) || randomUUID();
  const attendeeName = toStringValue(formData.get("attendeeName"));
  const attendeeEmail = toStringValue(formData.get("attendeeEmail"));
  const now = new Date();

  if (!Number.isFinite(eventId) || !Number.isFinite(productId)) {
    throw new Error("Missing event or product.");
  }

  const [eventRow, productRow] = await Promise.all([
    db.query.events.findFirst({ where: eq(events.id, eventId) }),
    db.query.ticketProducts.findFirst({ where: eq(ticketProducts.id, productId) }),
  ]);

  if (!eventRow || !productRow || productRow.eventId !== eventId) {
    throw new Error("Ticket product not found.");
  }

  const isFree = productRow.priceCents <= 0 || productRow.productType === "free_rsvp";
  const canIssueImmediately = isFree && eventRow.supportsFreeRsvp;

  const result: {
    order: typeof ticketOrders.$inferSelect;
    orderItem: typeof ticketOrderItems.$inferSelect | null;
    issuedTickets: Array<{ id: number; tokenId: string; ticketCode: string }>;
  } = await db.transaction(async (tx) => {
    const [existingOrder] = await tx.select().from(ticketOrders).where(eq(ticketOrders.idempotencyKey, idempotencyKey)).limit(1);

    if (existingOrder) {
      return { order: existingOrder, orderItem: null, issuedTickets: [] };
    }

    const [order] = await tx
      .insert(ticketOrders)
      .values({
        orderNumber: orderNumber(now),
        idempotencyKey,
        eventId,
        userId: actor.userId,
        clerkUserId: actor.clerkUserId,
        guestEmail: attendeeEmail || null,
        status: canIssueImmediately ? "completed" : "reserved",
        currency: productRow.currency,
        subtotalCents: productRow.priceCents * quantity,
        feeCents: Math.round(productRow.priceCents * quantity * 0.1),
        taxCents: Math.round(productRow.priceCents * quantity * 0.07),
        discountCents: 0,
        totalCents: productRow.priceCents * quantity + Math.round(productRow.priceCents * quantity * 0.17),
        paymentProvider: canIssueImmediately ? "free" : "none",
        paymentStatus: canIssueImmediately ? "captured" : "pending",
        completedAt: canIssueImmediately ? now : null,
        expiresAt: canIssueImmediately ? null : new Date(now.getTime() + 15 * 60 * 1000),
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const [orderItem] = await tx.insert(ticketOrderItems).values({
      orderId: order.id,
      productId,
      quantity,
      unitPriceCents: productRow.priceCents,
      feeCents: Math.round(productRow.priceCents * quantity * 0.1),
      taxCents: Math.round(productRow.priceCents * quantity * 0.07),
      discountCents: 0,
      totalCents: productRow.priceCents * quantity + Math.round(productRow.priceCents * quantity * 0.17),
      accessZone: productRow.accessZone,
      holderNameRequired: Boolean(attendeeName),
      holderEmailRequired: Boolean(attendeeEmail),
      createdAt: now,
      updatedAt: now,
    }).returning();

    if (canIssueImmediately) {
      const issuedTickets = [] as Array<{ id: number; tokenId: string; ticketCode: string }>;

      for (let index = 0; index < quantity; index += 1) {
        const tokenId = randomUUID();
        const ticketCode = `TK-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
        const [ticket] = await tx
          .insert(tickets)
          .values({
            ticketCode,
            tokenId,
            tokenVersion: 1,
            orderId: order.id,
            orderItemId: 1,
            eventId,
            productId,
            holderUserId: actor.userId,
            holderClerkUserId: actor.clerkUserId,
            holderName: attendeeName || null,
            holderEmail: attendeeEmail || null,
            status: "issued",
            transferStatus: "pending",
            accessZone: productRow.accessZone,
            issuedAt: now,
            activatedAt: now,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        issuedTickets.push(ticket);
      }

      return { order, orderItem, issuedTickets };
    }

    return { order, orderItem, issuedTickets: [] as Array<{ id: number; tokenId: string; ticketCode: string }> };
  });

  await logTicketAudit({
    eventId,
    orderId: result.order.id,
    actorClerkUserId: actor.clerkUserId,
    actorRole: actor.role,
    action: canIssueImmediately ? "ticket_order_completed" : "ticket_order_reserved",
    after: { orderNumber: result.order.orderNumber, quantity, productId, orderItemId: result.orderItem?.id ?? null },
  });

  if (canIssueImmediately) {
    redirect(`/tickets?success=1&order=${result.order.id}`);
  }

  redirect(`/orders/${result.order.id}?pendingPayment=1`);
}

export async function scanTicketAction(formData: FormData): Promise<void> {
  const actor = await requireDoorStaffTicketActor();
  const scanningDisabled = await isKillSwitchEnabled("ticket_scanning", {
    userId: actor.clerkUserId,
    role: actor.role,
  });

  if (scanningDisabled) {
    redirect(`/door?scanDecision=blocked&scanReason=${encodeURIComponent("Ticket scanning is temporarily disabled.")}`);
  }

  const token = toStringValue(formData.get("token"));
  const sessionToken = toStringValue(formData.get("sessionToken"));
  const idempotencyKey = toStringValue(formData.get("idempotencyKey")) || randomUUID();
  const zone = toStringValue(formData.get("zone")) || null;
  const now = new Date();

  const tokenPayload = verifyTicketToken(token);
  if (!tokenPayload) {
    redirect(`/door?scanDecision=invalid&scanReason=${encodeURIComponent("Invalid or tampered ticket token.")}`);
  }

  const ticket = await db.query.tickets.findFirst({ where: eq(tickets.tokenId, tokenPayload.tokenId) });
  if (!ticket) {
    redirect(`/door?scanDecision=invalid&scanReason=${encodeURIComponent("Ticket not found.")}`);
  }

  const order = await db.query.ticketOrders.findFirst({ where: eq(ticketOrders.id, ticket.orderId) });
  if (!order) {
    redirect(`/door?scanDecision=invalid&scanReason=${encodeURIComponent("Ticket order missing.")}`);
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, ticket.eventId) });
  const venue = await db.query.venues.findFirst({ where: eq(venues.id, event?.venueId ?? 0) });
  if (!event || !venue) {
    redirect(`/door?scanDecision=wrong_event&scanReason=${encodeURIComponent("Event not found.")}`);
  }

  if (actor.role === "door_staff" && actor.eventId !== event.id) {
    redirect(`/door?scanDecision=insufficient_access&scanReason=${encodeURIComponent("You are not assigned to this event.")}`);
  }

  const session = await db.query.ticketScanSessions.findFirst({ where: eq(ticketScanSessions.sessionToken, sessionToken) });
  if (!session || !session.isActive) {
    redirect(`/door?scanDecision=blocked&scanReason=${encodeURIComponent("Invalid door session.")}`);
  }

  if (actor.role === "door_staff" && actor.eventId !== session.eventId) {
    redirect(`/door?scanDecision=insufficient_access&scanReason=${encodeURIComponent("Session event is outside your assignment.")}`);
  }

  const decision: TicketScanDecision =
    ticket.status === "voided" ? "voided" :
    ticket.status === "refunded" ? "refunded" :
    ticket.status === "checked_in" ? "already_checked_in" :
    ticket.status === "transfer_pending" ? "transfer_pending" :
    ticket.status === "expired" ? "expired" :
    ticket.status === "blocked" ? "blocked" :
    "valid";

  const scanResult = await db.transaction(async (tx) => {
    const [existingScan] = await tx.select().from(ticketScans).where(eq(ticketScans.idempotencyKey, idempotencyKey)).limit(1);
    if (existingScan) {
      return existingScan;
    }

    const [scan] = await tx.insert(ticketScans).values({
      ticketId: ticket.id,
      eventId: event.id,
      venueId: venue.id,
      scanSessionId: session.id,
      doorStaffUserId: session.doorStaffUserId,
      clerkUserId: actor.clerkUserId,
      scanToken: randomUUID(),
      decision,
      reason: decision === "valid" ? "Checked in" : `Scan rejected: ${decision}`,
      zone,
      checkedInAt: decision === "valid" ? now : null,
      partialCheckinCount: 0,
      idempotencyKey,
      scannedAt: now,
      createdAt: now,
    }).returning();

    if (decision === "valid") {
      await tx.update(tickets).set({ status: "checked_in", checkedInAt: now, checkedInByClerkUserId: actor.clerkUserId, updatedAt: now }).where(eq(tickets.id, ticket.id));
    }

    return scan;
  });

  await logTicketAudit({
    eventId: event.id,
    ticketId: ticket.id,
    orderId: order.id,
    actorClerkUserId: actor.clerkUserId,
    actorRole: actor.role,
    action: "ticket_scanned",
    after: { decision, zone, scanId: scanResult.id },
  });

  redirect(`/door?eventId=${event.id}&sessionToken=${session.sessionToken}&scanDecision=${decision}&scanReason=${encodeURIComponent(scanResult.reason ?? "Scan recorded")}`);
}

export async function createScanSessionAction(formData: FormData) {
  const actor = await requireDoorStaffTicketActor();
  const eventId = Number(formData.get("eventId"));
  const deviceLabel = toStringValue(formData.get("deviceLabel")) || null;
  const clerkUserId = actor.clerkUserId;

  if (!Number.isFinite(eventId)) {
    throw new Error("Missing event id.");
  }

  const [event] = await db.select({ id: events.id, venueId: events.venueId }).from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) {
    throw new Error("Event not found.");
  }

  if (actor.role === "door_staff" && actor.eventId !== event.id) {
    throw new Error("Forbidden. Door staff can only create sessions for assigned events.");
  }

  const [session] = await db
    .insert(ticketScanSessions)
    .values({
      eventId: event.id,
      venueId: event.venueId,
      doorStaffUserId: actor.userId,
      clerkUserId,
      deviceLabel,
      sessionToken: randomUUID(),
      startedAt: new Date(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  await logTicketAudit({
    eventId: event.id,
    actorClerkUserId: actor.clerkUserId,
    actorRole: actor.role,
    action: "ticket_scan_session_started",
    after: { sessionId: session.id, sessionToken: session.sessionToken, deviceLabel },
  });

  redirect(`/door?eventId=${event.id}&sessionToken=${session.sessionToken}`);
}
