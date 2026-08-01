import { NextResponse } from "next/server";
import { and, asc, desc, eq } from "drizzle-orm";

import { getReservationApiActor } from "@/app/api/bookings/_lib/access";
import { db } from "@/db";
import { waitlistEntries } from "@/db/schema";
import { createWaitlistEntry, getWaitlistQueue, updateWaitlistStatus } from "@/lib/bookings/operations";
import type { WaitlistStatus } from "@/lib/bookings/types";

export async function GET(request: Request) {
  const actor = await getReservationApiActor();
  if (!actor?.venueId) {
    return NextResponse.json({ error: "Venue context required." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status") as WaitlistStatus | null;
  const section = searchParams.get("section");
  const date = searchParams.get("date");

  if (actor.role === "consumer") {
    const rows = await db
      .select()
      .from(waitlistEntries)
      .where(and(eq(waitlistEntries.venueId, actor.venueId), eq(waitlistEntries.clerkUserId, actor.clerkUserId)))
      .orderBy(desc(waitlistEntries.createdAt));

    return NextResponse.json({ venueId: actor.venueId, waitlist: rows }, { status: 200 });
  }

  const rows = await getWaitlistQueue({
    venueId: actor.venueId,
    status: statusParam,
    section: section?.trim() ? section.trim() : null,
    date: date ? new Date(date) : null,
  });

  return NextResponse.json({ venueId: actor.venueId, waitlist: rows }, { status: 200 });
}

export async function POST(request: Request) {
  const actor = await getReservationApiActor();
  const body = (await request.json().catch(() => ({}))) as {
    venueId?: number;
    bookingId?: number;
    fullName?: string;
    phone?: string;
    partySize?: number;
    preferredSection?: string;
    preferredTimeAt?: string;
  };

  const venueId = body.venueId ?? actor?.venueId;
  if (!venueId || !body.fullName) {
    return NextResponse.json({ error: "venueId and fullName are required." }, { status: 400 });
  }

  if (actor?.role === "consumer" && actor.venueId && actor.venueId !== venueId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = actor?.clerkUserId
    ? await db
        .select({ id: waitlistEntries.id, status: waitlistEntries.status })
        .from(waitlistEntries)
        .where(and(eq(waitlistEntries.venueId, venueId), eq(waitlistEntries.clerkUserId, actor.clerkUserId), eq(waitlistEntries.status, "waiting")))
        .orderBy(asc(waitlistEntries.createdAt))
        .limit(1)
    : [];

  if (existing[0]) {
    return NextResponse.json({ entry: existing[0], idempotent: true }, { status: 200 });
  }

  const entry = await createWaitlistEntry({
    venueId,
    bookingId: body.bookingId ?? null,
    clerkUserId: actor?.clerkUserId ?? null,
    fullName: body.fullName,
    phone: body.phone ?? null,
    partySize: body.partySize ?? 2,
    preferredSection: body.preferredSection ?? null,
    preferredTimeAt: body.preferredTimeAt ? new Date(body.preferredTimeAt) : null,
  });

  return NextResponse.json({ entry }, { status: 201 });
}

export async function PATCH(request: Request) {
  const actor = await getReservationApiActor();
  if (!actor?.venueId || (actor.role !== "owner" && actor.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    entryId?: number;
    nextStatus?: WaitlistStatus;
    note?: string;
    offerExpiresMinutes?: number;
    convertToTableId?: number;
  };

  if (!body.entryId || !body.nextStatus) {
    return NextResponse.json({ error: "entryId and nextStatus are required." }, { status: 400 });
  }

  const entry = await updateWaitlistStatus({
    venueId: actor.venueId,
    entryId: body.entryId,
    nextStatus: body.nextStatus,
    actorClerkUserId: actor.clerkUserId,
    actorRole: actor.role,
    note: body.note ?? null,
    offerExpiresMinutes: body.offerExpiresMinutes,
    convertToTableId: body.convertToTableId ?? null,
  });

  return NextResponse.json({ entry }, { status: 200 });
}

export async function DELETE(request: Request) {
  const actor = await getReservationApiActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const entryId = Number(searchParams.get("entryId") ?? 0);

  if (!entryId || !Number.isFinite(entryId)) {
    return NextResponse.json({ error: "entryId is required." }, { status: 400 });
  }

  const [entry] = await db
    .select({ id: waitlistEntries.id, venueId: waitlistEntries.venueId, clerkUserId: waitlistEntries.clerkUserId, status: waitlistEntries.status })
    .from(waitlistEntries)
    .where(eq(waitlistEntries.id, entryId))
    .limit(1);

  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (actor.role === "consumer" && actor.clerkUserId !== entry.clerkUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if ((actor.role === "owner" || actor.role === "door_staff" || actor.role === "server") && actor.venueId !== entry.venueId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (entry.status !== "cancelled") {
    await updateWaitlistStatus({
      venueId: entry.venueId,
      entryId,
      nextStatus: "cancelled",
      actorClerkUserId: actor.clerkUserId,
      actorRole: actor.role,
      note: "Left waitlist",
    });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
