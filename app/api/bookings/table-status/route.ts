import { NextResponse } from "next/server";

import { canManageVenueReservations, getReservationApiActor } from "@/app/api/bookings/_lib/access";
import { getVenueTableOperationsSnapshot, updateLiveTableStatus } from "@/lib/bookings/operations";
import type { LiveTableStatus } from "@/lib/bookings/types";

const ACTION_TO_STATUS: Record<string, LiveTableStatus> = {
  release_table: "available",
  mark_cleaning: "cleaning",
  mark_available: "available",
  place_vip_hold: "vip_hold",
  remove_vip_hold: "available",
  out_of_service: "out_of_service",
};

export async function GET() {
  const actor = await getReservationApiActor();
  if (!canManageVenueReservations(actor) || !actor?.venueId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tables = await getVenueTableOperationsSnapshot(actor.venueId);
  return NextResponse.json({ venueId: actor.venueId, tables }, { status: 200 });
}

export async function POST(request: Request) {
  const actor = await getReservationApiActor();
  if (!canManageVenueReservations(actor) || !actor?.venueId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    venueTableId?: number;
    status?: LiveTableStatus;
    action?: string;
    note?: string;
  };

  const resolvedStatus = body.status ?? (body.action ? ACTION_TO_STATUS[body.action] : undefined);

  if (!body.venueTableId || !resolvedStatus) {
    return NextResponse.json({ error: "venueTableId and status are required." }, { status: 400 });
  }

  await updateLiveTableStatus({
    venueId: actor.venueId,
    venueTableId: body.venueTableId,
    status: resolvedStatus,
    actorClerkUserId: actor.clerkUserId,
    actorRole: actor.role,
    note: body.note ?? null,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
