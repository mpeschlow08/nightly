import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { consumeFreeHotReelVenueUnlock, CommercialEntitlementError, getConsumerCommercialStatus } from "@/lib/commercial-entitlements/service";
import { commercialErrorResponse, commercialMutationSameOrigin, readCommercialJson } from "@/lib/commercial-entitlements/http";

async function getConsumerUserId() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) throw new CommercialEntitlementError("unauthorized", 401);
  const [user] = await db.select({ id: users.id, accountStatus: users.accountStatus, role: users.role }).from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);
  if (!user || user.accountStatus !== "active" || user.role !== "consumer") throw new CommercialEntitlementError("forbidden", 403);
  return user.id;
}

export async function GET() {
  try {
    const userId = await getConsumerUserId();
    return NextResponse.json(await getConsumerCommercialStatus(userId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return commercialErrorResponse(error); }
}

export async function POST(request: Request) {
  if (!commercialMutationSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await readCommercialJson(request);
  if (!body || typeof body.venueId !== "number" || !Number.isSafeInteger(body.venueId) || body.venueId <= 0) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    const userId = await getConsumerUserId();
    const result = await consumeFreeHotReelVenueUnlock({ userId, venueId: body.venueId });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return commercialErrorResponse(error); }
}