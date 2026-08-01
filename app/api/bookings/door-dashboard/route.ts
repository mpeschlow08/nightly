import { NextResponse } from "next/server";

import { getReservationApiActor } from "@/app/api/bookings/_lib/access";
import { getDoorReservationBoard } from "@/lib/bookings/operations";

export async function GET(request: Request) {
  const actor = await getReservationApiActor();
  if (!actor || (actor.role !== "door_staff" && actor.role !== "owner" && actor.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;
  const requestedVenueId = Number(searchParams.get("venueId") ?? actor.venueId ?? 0);
  const venueId = actor.role === "door_staff" ? Number(actor.venueId ?? 0) : requestedVenueId;

  if (actor.role === "owner" && actor.venueId && venueId !== actor.venueId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!Number.isFinite(venueId) || !venueId) {
    return NextResponse.json({ error: "venueId is required." }, { status: 400 });
  }

  const board = await getDoorReservationBoard({ venueId, query: q });
  return NextResponse.json({ venueId, reservations: board }, { status: 200 });
}
