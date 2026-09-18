import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { authorizeLivePlayback } from "@/lib/live/playback";

async function resolveActor() {
  const session = await auth();
  if (!session.userId) {
    return { userId: null, role: null };
  }

  const [user] = await db.select({ role: users.role }).from(users).where(eq(users.clerkUserId, session.userId)).limit(1);
  return {
    userId: session.userId,
    role: user?.role ?? "consumer",
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const venue = url.searchParams.get("venue")?.trim();
  const cameraRaw = url.searchParams.get("camera")?.trim();

  if (!venue) {
    return NextResponse.json({ error: "Venue is required." }, { status: 400 });
  }

  const actor = await resolveActor();
  const cameraId = cameraRaw ? Number(cameraRaw) : null;

  const result = await authorizeLivePlayback({
    venueSlugOrId: venue,
    cameraId: Number.isInteger(cameraId) ? cameraId : null,
    actor,
  });

  if (result.status === "ok") {
    return NextResponse.json(result, { status: 200, headers: { "cache-control": "no-store" } });
  }

  const status = result.status === "denied" ? 403 : result.status === "provider_unavailable" ? 503 : 200;
  return NextResponse.json(result, { status, headers: { "cache-control": "no-store" } });
}
