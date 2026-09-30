import { NextResponse } from "next/server";

import { getSocialPublishingPolicy, setSocialPublishingPolicy } from "@/lib/social-publishing/distribution-service";
import { requireSocialPublishingActor } from "@/lib/social-publishing/auth";
import type { SocialPublishingMode } from "@/lib/social-publishing/types";
import { parseVenueId, readJsonObject, sameOriginMutation, socialErrorResponse, socialMutationRateLimit } from "../_lib/http";

const modes = new Set<SocialPublishingMode>(["auto_publish", "review_before_post", "disabled"]);

export async function GET(request: Request) {
  const venueId = parseVenueId(new URL(request.url).searchParams.get("venueId"));
  if (!venueId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    return NextResponse.json(await getSocialPublishingPolicy(venueId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return socialErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  if (!sameOriginMutation(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await readJsonObject(request);
  const venueId = parseVenueId(String(body?.venueId ?? ""));
  if (!venueId || typeof body?.mode !== "string" || !modes.has(body.mode as SocialPublishingMode)) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    await requireSocialPublishingActor(venueId, "manage_policy");
    const rate = socialMutationRateLimit(venueId, "social_policy_update");
    if (!rate.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
    return NextResponse.json(await setSocialPublishingPolicy(venueId, body.mode as SocialPublishingMode), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return socialErrorResponse(error);
  }
}
