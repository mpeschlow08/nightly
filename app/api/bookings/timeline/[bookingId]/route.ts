import { NextResponse } from "next/server";

import { canAccessBooking, getReservationApiActor } from "@/app/api/bookings/_lib/access";
import { getReservationTimeline } from "@/lib/bookings/operations";

export async function GET(_request: Request, context: { params: Promise<{ bookingId: string }> }) {
  const actor = await getReservationApiActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bookingId } = await context.params;
  const id = Number(bookingId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
  }

  if (!(await canAccessBooking(actor, id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const timeline = await getReservationTimeline(id);
  if (!timeline) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  return NextResponse.json(timeline, { status: 200 });
}
