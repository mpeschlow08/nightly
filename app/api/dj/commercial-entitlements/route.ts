import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { djProfiles, users } from "@/db/schema";
import { CommercialEntitlementError, getCommercialSubscriptionStatus } from "@/lib/commercial-entitlements/service";
import { commercialErrorResponse } from "@/lib/commercial-entitlements/http";

export async function GET() {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) throw new CommercialEntitlementError("unauthorized", 401);
    const [artist] = await db.select({ userId: users.id, profileId: djProfiles.id }).from(users)
      .innerJoin(djProfiles, eq(djProfiles.userId, users.id))
      .where(and(eq(users.clerkUserId, clerkUserId), eq(users.role, "dj"), eq(users.accountStatus, "active"), eq(users.isOnboarded, true)))
      .limit(1);
    if (!artist) throw new CommercialEntitlementError("forbidden", 403);
    return NextResponse.json(await getCommercialSubscriptionStatus("artist", artist.profileId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return commercialErrorResponse(error); }
}