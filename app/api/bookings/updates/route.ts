import { NextResponse } from "next/server";

import { canAccessBooking, getReservationApiActor } from "@/app/api/bookings/_lib/access";
import { modifyReservation } from "@/lib/bookings/operations";

export async function POST(request: Request) {
  const actor = await getReservationApiActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (actor.role !== "consumer" && actor.role !== "owner" && actor.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    bookingId?: number;
    upgradeTableId?: number;
    addBottleIds?: number[];
    addAddonIds?: number[];
    partySize?: number;
    cancel?: boolean;
    changeRequest?: string;
  };

  if (!body.bookingId) {
    return NextResponse.json({ error: "bookingId is required." }, { status: 400 });
  }

  if (!(await canAccessBooking(actor, body.bookingId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await modifyReservation({
    bookingId: body.bookingId,
    actorClerkUserId: actor.clerkUserId,
    actorRole: actor.role,
    upgradeTableId: body.upgradeTableId ?? null,
    addBottleIds: body.addBottleIds ?? [],
    addAddonIds: body.addAddonIds ?? [],
    partySize: body.partySize ?? null,
    cancel: Boolean(body.cancel),
    changeRequest: body.changeRequest ?? null,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
