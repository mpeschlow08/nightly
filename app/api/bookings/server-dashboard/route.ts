import { NextResponse } from "next/server";

import { getReservationApiActor } from "@/app/api/bookings/_lib/access";
import { getServerDashboard } from "@/lib/bookings/operations";

export async function GET(request: Request) {
  const actor = await getReservationApiActor();
  if (!actor || (actor.role !== "server" && actor.role !== "owner" && actor.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const requestedServerId = Number(searchParams.get("serverId") ?? actor.serverId ?? 0);
  const requestedVenueId = Number(searchParams.get("venueId") ?? actor.venueId ?? 0);

  const serverId = actor.role === "server" ? Number(actor.serverId ?? 0) : requestedServerId;
  const venueId = actor.role === "server" ? Number(actor.venueId ?? 0) : requestedVenueId;

  if (actor.role === "owner" && actor.venueId && venueId !== actor.venueId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!Number.isFinite(serverId) || !serverId || !Number.isFinite(venueId) || !venueId) {
    return NextResponse.json({ error: "serverId and venueId are required." }, { status: 400 });
  }

  const rows = await getServerDashboard({ venueId, serverId });
  return NextResponse.json({ serverId, venueId, reservations: rows }, { status: 200 });
}
