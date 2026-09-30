import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { hotReels, users } from "@/db/schema";
import { consumeRateLimit } from "@/lib/platform/rate-limit";
import { commercialErrorResponse, commercialMutationSameOrigin } from "@/lib/commercial-entitlements/http";
import { CommercialEntitlementError, consumeFreeHotReelVenueUnlock } from "@/lib/commercial-entitlements/service";
import { authorizeHotReelPlayback } from "@/lib/hot-reel/core";
import { getHotReelProvider } from "@/lib/hot-reel/provider";
import type { HotReelRecord } from "@/lib/hot-reel/types";

const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

export async function POST(request: Request, context: { params: Promise<{ publicId: string }> }) {
  if (!commercialMutationSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) throw new CommercialEntitlementError("unauthorized", 401);
    const [user] = await db.select({ id: users.id, accountStatus: users.accountStatus, role: users.role }).from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);
    if (!user || user.accountStatus !== "active" || user.role !== "consumer") throw new CommercialEntitlementError("forbidden", 403);
    const rate = consumeRateLimit({ key: String(user.id), scope: "user", burstLimit: 20, sustainedLimit: 40, windowMs: 60_000, route: "consumer-hot-reel-playback" });
    if (!rate.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { ...headers, "Retry-After": String(rate.retryAfterSeconds) } });
    const { publicId } = await context.params;
    if (!/^hotreel-[0-9a-f]{32}$/.test(publicId)) throw new CommercialEntitlementError("invalid_request", 400);
    const [row] = await db.select().from(hotReels).where(eq(hotReels.publicId, publicId)).limit(1);
    if (!row) throw new CommercialEntitlementError("not_found", 404);

    const provider = getHotReelProvider();
    if (provider.providerKey !== row.providerKey || !provider.isConfigured()) throw new CommercialEntitlementError("media_unavailable", 503);
    const record: HotReelRecord = {
      id: String(row.id), publicId: row.publicId, hotMomentId: row.hotMomentId, venueId: row.venueId, deviceId: row.deviceId,
      sourceId: row.sourceId, sessionId: row.sessionId, lifecycleState: row.lifecycleState as HotReelRecord["lifecycleState"],
      publicationState: row.publicationState as HotReelRecord["publicationState"], reviewState: row.reviewState as HotReelRecord["reviewState"],
      providerKey: row.providerKey, providerObjectKey: row.providerObjectKey, providerObjectVersion: row.providerObjectVersion,
      contentHash: row.contentHash, contentBytes: row.contentBytes, contentType: row.contentType, durationMs: row.durationMs,
      capturedAt: row.capturedAt?.getTime() ?? null, uploadedAt: row.uploadedAt?.getTime() ?? null,
      finalizedAt: row.finalizedAt?.getTime() ?? null, expiresAt: row.expiresAt?.getTime() ?? null, deletedAt: row.deletedAt?.getTime() ?? null,
      failureCode: row.failureCode, failureReason: row.failureReason,
      metadata: (() => { try { const value: unknown = JSON.parse(row.metadataJson); return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; } catch { return {}; } })(),
      createdAt: row.createdAt.getTime(), updatedAt: row.updatedAt.getTime(),
    };
    const playback = await authorizeHotReelPlayback({ record, actor: { userId: user.id, role: "consumer", venueId: row.venueId }, provider, expiresAt: Date.now() + 60_000 });
    if (!playback.allowed) throw new CommercialEntitlementError("media_unavailable", 404);
    const unlock = await consumeFreeHotReelVenueUnlock({ userId: user.id, venueId: row.venueId, hotReelPublicId: publicId });
    if (!unlock.allowed) throw new CommercialEntitlementError("free_allowance_used", 403);
    return NextResponse.json({ url: playback.url, expiresAt: new Date(playback.expiresAt).toISOString(), source: unlock.source }, { headers });
  } catch (error) { return commercialErrorResponse(error); }
}