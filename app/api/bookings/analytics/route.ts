import { NextResponse } from "next/server";

import { canManageVenueReservations, getReservationApiActor } from "@/app/api/bookings/_lib/access";
import { getReservationAnalytics } from "@/lib/bookings/operations";

export async function GET() {
  const actor = await getReservationApiActor();
  if (!canManageVenueReservations(actor) || !actor?.venueId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const analytics = await getReservationAnalytics(actor.venueId);
  return NextResponse.json({ venueId: actor.venueId, ...analytics }, { status: 200 });
}
