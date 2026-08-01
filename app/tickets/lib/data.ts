import { desc, eq, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { events, guestListEntries, guestLists, ticketOrders, ticketProducts, ticketScans, ticketScanSessions, ticketWaitlists, tickets, venues } from "@/db/schema";
import { getEventBySlug } from "@/lib/consumer/data";
import type { TicketOrderStatus, TicketStatus } from "@/lib/ticketing/types";

export type TicketingProductRow = {
  id: number;
  eventId: number;
  venueId: number;
  productType: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  quantityTotal: number;
  quantityReserved: number;
  quantitySold: number;
  quantityRefunded: number;
  salesStartAt: Date | null;
  salesEndAt: Date | null;
  minimumQuantity: number;
  maximumQuantity: number;
  purchaseLimit: number;
  visibility: string;
  sortOrder: number;
  accessZone: string | null;
  entryWindowStartsAt: Date | null;
  entryWindowEndsAt: Date | null;
  benefitsJson: string | null;
  refundability: string;
  transferability: string;
  isActive: boolean;
  isHidden: boolean;
  soldOutAt: Date | null;
};

export async function getEventTicketingData(slugOrId: string) {
  const event = await getEventBySlug(slugOrId);

  if (!event) {
    return null;
  }

  const [productRows, guestListsRows, waitlistRows] = await Promise.all([
    db.select().from(ticketProducts).where(eq(ticketProducts.eventId, event.id)).orderBy(desc(ticketProducts.sortOrder), desc(ticketProducts.createdAt)),
    db.select().from(guestLists).where(eq(guestLists.eventId, event.id)).orderBy(desc(guestLists.createdAt)),
    db.select().from(ticketWaitlists).where(eq(ticketWaitlists.eventId, event.id)).orderBy(desc(ticketWaitlists.createdAt)).limit(50),
  ]);

  return {
    event,
    products: productRows as TicketingProductRow[],
    guestLists: guestListsRows,
    waitlistRows,
  };
}

export async function getMyTickets(userId: number, clerkUserId: string) {
  return db
    .select({
      id: tickets.id,
      ticketCode: tickets.ticketCode,
      tokenId: tickets.tokenId,
      status: tickets.status,
      transferStatus: tickets.transferStatus,
      holderName: tickets.holderName,
      holderEmail: tickets.holderEmail,
      eventId: tickets.eventId,
      productId: tickets.productId,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
      eventTitle: events.title,
      eventSlug: events.slug,
      eventStartsAt: events.startsAt,
      venueName: venues.name,
      venueSlug: venues.slug,
      productName: ticketProducts.name,
      productType: ticketProducts.productType,
    })
    .from(tickets)
    .innerJoin(events, eq(tickets.eventId, events.id))
    .innerJoin(venues, eq(events.venueId, venues.id))
    .innerJoin(ticketProducts, eq(tickets.productId, ticketProducts.id))
    .where(or(eq(tickets.holderUserId, userId), eq(tickets.holderClerkUserId, clerkUserId)))
    .orderBy(desc(tickets.createdAt), desc(tickets.id));
}

export async function getMyOrders(userId: number, clerkUserId: string) {
  return db
    .select({
      id: ticketOrders.id,
      orderNumber: ticketOrders.orderNumber,
      status: ticketOrders.status,
      totalCents: ticketOrders.totalCents,
      currency: ticketOrders.currency,
      completedAt: ticketOrders.completedAt,
      createdAt: ticketOrders.createdAt,
      eventId: ticketOrders.eventId,
      eventTitle: events.title,
      eventSlug: events.slug,
      venueName: venues.name,
      venueSlug: venues.slug,
    })
    .from(ticketOrders)
    .innerJoin(events, eq(ticketOrders.eventId, events.id))
    .innerJoin(venues, eq(events.venueId, venues.id))
    .where(or(eq(ticketOrders.userId, userId), eq(ticketOrders.clerkUserId, clerkUserId)))
    .orderBy(desc(ticketOrders.createdAt), desc(ticketOrders.id));
}

export async function getTicketById(ticketId: number) {
  const [ticket] = await db
    .select({
      id: tickets.id,
      ticketCode: tickets.ticketCode,
      tokenId: tickets.tokenId,
      status: tickets.status,
      transferStatus: tickets.transferStatus,
      holderName: tickets.holderName,
      holderEmail: tickets.holderEmail,
      accessZone: tickets.accessZone,
      entryWindowStartsAt: tickets.entryWindowStartsAt,
      entryWindowEndsAt: tickets.entryWindowEndsAt,
      issuedAt: tickets.issuedAt,
      activatedAt: tickets.activatedAt,
      checkedInAt: tickets.checkedInAt,
      orderId: tickets.orderId,
      eventId: tickets.eventId,
      eventTitle: events.title,
      eventSlug: events.slug,
      eventStartsAt: events.startsAt,
      eventEndsAt: events.endsAt,
      venueId: venues.id,
      venueName: venues.name,
      venueSlug: venues.slug,
      venueCity: venues.city,
      productName: ticketProducts.name,
      productType: ticketProducts.productType,
      orderNumber: ticketOrders.orderNumber,
    })
    .from(tickets)
    .innerJoin(events, eq(tickets.eventId, events.id))
    .innerJoin(venues, eq(events.venueId, venues.id))
    .innerJoin(ticketProducts, eq(tickets.productId, ticketProducts.id))
    .innerJoin(ticketOrders, eq(tickets.orderId, ticketOrders.id))
    .where(eq(tickets.id, ticketId))
    .limit(1);

  return ticket ?? null;
}

export async function getDoorDashboard(eventId: number) {
  const [ticketCounts] = await db
    .select({
      totalTickets: sql<number>`count(*)::int`,
      checkedIn: sql<number>`count(*) filter (where ${tickets.status} = 'checked_in')::int`,
      partial: sql<number>`count(*) filter (where ${tickets.status} = 'partially_checked_in')::int`,
      voided: sql<number>`count(*) filter (where ${tickets.status} = 'voided')::int`,
      issued: sql<number>`count(*) filter (where ${tickets.status} in ('issued','active','transferred','transfer_pending','reserved','pending_payment'))::int`,
    })
    .from(tickets)
    .where(eq(tickets.eventId, eventId));

  const scanRows = await db
    .select()
    .from(ticketScans)
    .where(eq(ticketScans.eventId, eventId))
    .orderBy(desc(ticketScans.scannedAt))
    .limit(50);

  return {
    counts: ticketCounts ?? { totalTickets: 0, checkedIn: 0, partial: 0, voided: 0, issued: 0 },
    scans: scanRows,
  };
}
