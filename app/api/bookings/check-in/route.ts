import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getReservationApiActor } from "@/app/api/bookings/_lib/access";
import { scanReservationPass } from "@/lib/bookings/operations";

export async function POST(request: Request) {
  const actor = await getReservationApiActor();

  if (!actor || (actor.role !== "owner" && actor.role !== "admin" && actor.role !== "door_staff")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    checkInToken?: string;
    scanNonce?: string;
    venueId?: number;
    method?: string;
  };

  if (!body.checkInToken) {
    return NextResponse.json({ error: "Missing check-in token." }, { status: 400 });
  }

  const venueId = actor.role === "admin" ? (body.venueId ?? actor.venueId) : actor.venueId;
  if (!venueId) {
    return NextResponse.json({ error: "Venue context is required." }, { status: 400 });
  }

  const result = await scanReservationPass({
    checkInToken: body.checkInToken,
    scanNonce: body.scanNonce ?? randomUUID(),
    venueId,
    actorClerkUserId: actor.clerkUserId,
    actorRole: actor.role,
    method: body.method ?? "qr",
  });

  return NextResponse.json(result, { status: 200 });
}
