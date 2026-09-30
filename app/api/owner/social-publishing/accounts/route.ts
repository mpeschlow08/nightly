import { NextResponse } from "next/server";

import { disconnectSocialAccount, listSocialAccounts } from "@/lib/social-publishing/distribution-service";
import { requireSocialPublishingActor } from "@/lib/social-publishing/auth";
import { beginSocialOAuth } from "@/lib/social-publishing/oauth";
import type { SocialPlatform } from "@/lib/social-publishing/types";
import { parseVenueId, readJsonObject, sameOriginMutation, socialErrorResponse, socialMutationRateLimit } from "../_lib/http";

const platforms = new Set<SocialPlatform>(["instagram", "facebook", "tiktok", "youtube", "x"]);

export async function GET(request: Request) {
  const venueId = parseVenueId(new URL(request.url).searchParams.get("venueId"));
  if (!venueId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    return NextResponse.json({ accounts: await listSocialAccounts(venueId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return socialErrorResponse(error);
  }
}

export async function POST(request: Request) {
  if (!sameOriginMutation(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await readJsonObject(request);
  const venueId = parseVenueId(String(body?.venueId ?? ""));
  if (!venueId || typeof body?.platform !== "string" || !platforms.has(body.platform as SocialPlatform) || !Array.isArray(body?.scopes) || body.scopes.some((scope) => typeof scope !== "string")) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  try {
    const actor = await requireSocialPublishingActor(venueId, "manage_accounts");
    const rate = socialMutationRateLimit(venueId, "social_accounts_oauth_start");
    if (!rate.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
    const callbackOrigin = process.env.SOCIAL_OAUTH_REDIRECT_ORIGIN;
    if (!callbackOrigin) return NextResponse.json({ error: "provider_not_configured" }, { status: 503 });
    const redirectUri = new URL("/api/owner/social-accounts/callback", callbackOrigin).toString();
    const result = await beginSocialOAuth({ actor, platform: body.platform as SocialPlatform, scopes: body.scopes as string[], redirectUri });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return socialErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  if (!sameOriginMutation(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await readJsonObject(request);
  const venueId = parseVenueId(String(body?.venueId ?? ""));
  if (!venueId || typeof body?.accountId !== "string" || !/^[A-Fa-f0-9-]{16,64}$/.test(body.accountId)) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    await requireSocialPublishingActor(venueId, "manage_accounts");
    const rate = socialMutationRateLimit(venueId, "social_accounts_disconnect");
    if (!rate.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
    return NextResponse.json(await disconnectSocialAccount({ venueId, accountPublicId: body.accountId }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return socialErrorResponse(error);
  }
}
