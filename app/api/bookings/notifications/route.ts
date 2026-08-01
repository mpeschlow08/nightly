import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { canAccessBooking, getReservationApiActor } from "@/app/api/bookings/_lib/access";
import { db } from "@/db";
import { reservationNotifications } from "@/db/schema";

export async function GET() {
  const actor = await getReservationApiActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = actor.role === "admin"
    ? await db
        .select()
        .from(reservationNotifications)
        .orderBy(desc(reservationNotifications.createdAt))
        .limit(100)
    : await db
        .select()
        .from(reservationNotifications)
        .where(eq(reservationNotifications.recipientClerkUserId, actor.clerkUserId))
        .orderBy(desc(reservationNotifications.createdAt))
        .limit(100);

  return NextResponse.json({ notifications: rows }, { status: 200 });
}

export async function POST(request: Request) {
  const actor = await getReservationApiActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    bookingId?: number;
    venueId?: number;
    recipientClerkUserId?: string;
    notificationType?: string;
    channel?: string;
    payload?: Record<string, unknown>;
  };

  if (!body.bookingId || !body.notificationType) {
    return NextResponse.json({ error: "bookingId and notificationType are required." }, { status: 400 });
  }

  if (!(await canAccessBooking(actor, body.bookingId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const channel = body.channel ?? "in_app";
  const externalConfigured = Boolean(process.env.RESERVATION_NOTIFICATIONS_EXTERNAL_ENABLED === "true");
  const status = channel === "in_app"
    ? "delivered_in_app"
    : externalConfigured
      ? "provider_pending"
      : "not_configured";

  const now = new Date();
  const [row] = await db
    .insert(reservationNotifications)
    .values({
      bookingId: body.bookingId,
      venueId: body.venueId ?? actor.venueId,
      recipientClerkUserId: body.recipientClerkUserId ?? actor.clerkUserId,
      notificationType: body.notificationType,
      channel,
      status,
      payloadJson: JSON.stringify(body.payload ?? {}),
      scheduledAt: now,
      sentAt: channel === "in_app" ? now : null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return NextResponse.json({ notification: row }, { status: 201 });
}

export async function PATCH(request: Request) {
  const actor = await getReservationApiActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    id?: number;
    status?: string;
  };

  if (!body.id || !body.status) {
    return NextResponse.json({ error: "id and status are required." }, { status: 400 });
  }

  const [existing] = await db
    .select({
      id: reservationNotifications.id,
      recipientClerkUserId: reservationNotifications.recipientClerkUserId,
    })
    .from(reservationNotifications)
    .where(eq(reservationNotifications.id, body.id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (actor.role !== "admin" && existing.recipientClerkUserId !== actor.clerkUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [row] = await db
    .update(reservationNotifications)
    .set({
      status: body.status,
      sentAt: body.status === "delivered_in_app" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(reservationNotifications.id, body.id))
    .returning();

  return NextResponse.json({ notification: row }, { status: 200 });
}
