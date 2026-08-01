import { NextResponse } from "next/server";

import { canManageVenueReservations, getReservationApiActor } from "@/app/api/bookings/_lib/access";
import { getOwnerArrivalBoard } from "@/lib/bookings/operations";

export async function GET() {
  const actor = await getReservationApiActor();
  if (!canManageVenueReservations(actor) || !actor?.venueId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const board = await getOwnerArrivalBoard(actor.venueId);
  return NextResponse.json({ venueId: actor.venueId, arrivals: board }, { status: 200 });
}
