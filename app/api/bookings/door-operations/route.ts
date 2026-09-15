import { NextResponse } from "next/server";

import { canAccessBooking, getReservationApiActor } from "@/app/api/bookings/_lib/access";
import { recordDoorReservationAction } from "@/lib/bookings/operations";

export async function POST(request: Request) {
  const actor = await getReservationApiActor();
  if (!actor || (actor.role !== "door_staff" && actor.role !== "owner" && actor.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    bookingId?: number;
    action?: "arrived" | "late_arrival" | "no_show" | "walk_in_conversion";
    note?: string;
    fullName?: string;
    partySize?: number;
    preferredSection?: string;
  };

  if (!body.action) {
    return NextResponse.json({ error: "action is required." }, { status: 400 });
  }

  if (body.bookingId && !(await canAccessBooking(actor, body.bookingId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!actor.venueId) {
    return NextResponse.json({ error: "Venue context required." }, { status: 400 });
  }

  const result = await recordDoorReservationAction({
    bookingId: body.bookingId ?? null,
    venueId: actor.venueId,
    actorClerkUserId: actor.clerkUserId,
    actorRole: actor.role,
    action: body.action,
    note: body.note ?? null,
    fullName: body.fullName ?? null,
    partySize: body.partySize ?? null,
    preferredSection: body.preferredSection ?? null,
  });

  return NextResponse.json({ ok: true, result }, { status: 200 });
}