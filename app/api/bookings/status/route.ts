import { NextResponse } from "next/server";

import { canAccessBooking, getReservationApiActor } from "@/app/api/bookings/_lib/access";
import { setReservationStatus } from "@/lib/bookings/operations";
import type { CustomerReservationStatus } from "@/lib/bookings/types";

export async function POST(request: Request) {
  const actor = await getReservationApiActor();
  if (!actor || (actor.role !== "owner" && actor.role !== "admin" && actor.role !== "server" && actor.role !== "door_staff")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    bookingId?: number;
    status?: CustomerReservationStatus;
    note?: string;
  };

  if (!body.bookingId || !body.status) {
    return NextResponse.json({ error: "bookingId and status are required." }, { status: 400 });
  }

  if (!(await canAccessBooking(actor, body.bookingId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await setReservationStatus({
    bookingId: body.bookingId,
    actorClerkUserId: actor!.clerkUserId,
    actorRole: actor!.role,
    status: body.status,
    note: body.note ?? null,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
