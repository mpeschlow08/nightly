import { NextResponse } from "next/server";

import { canAccessBooking, getReservationApiActor } from "@/app/api/bookings/_lib/access";
import { assignServerToReservation } from "@/lib/bookings/operations";

export async function POST(request: Request) {
  const actor = await getReservationApiActor();
  if (!actor || (actor.role !== "owner" && actor.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    bookingId?: number;
    serverId?: number;
    note?: string;
  };

  if (!body.bookingId || !body.serverId || !actor?.venueId) {
    return NextResponse.json({ error: "bookingId, serverId, and venue context are required." }, { status: 400 });
  }

  if (!(await canAccessBooking(actor, body.bookingId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await assignServerToReservation({
    bookingId: body.bookingId,
    venueId: actor.venueId,
    serverId: body.serverId,
    actorClerkUserId: actor.clerkUserId,
    actorRole: actor.role,
    note: body.note,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
