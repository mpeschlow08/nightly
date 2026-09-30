import { NextResponse } from "next/server";

import { createSocialDistributionRequest, listSocialDistributionHistory } from "@/lib/social-publishing/distribution-service";
import { requireSocialPublishingActor } from "@/lib/social-publishing/auth";
import { parseVenueId, readJsonObject, sameOriginMutation, socialErrorResponse, socialMutationRateLimit } from "../_lib/http";

export async function GET(request: Request) {
  const venueId = parseVenueId(new URL(request.url).searchParams.get("venueId"));
  if (!venueId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    return NextResponse.json({ distributions: await listSocialDistributionHistory(venueId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return socialErrorResponse(error);
  }
}

export async function POST(request: Request) {
  if (!sameOriginMutation(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await readJsonObject(request);
  const venueId = parseVenueId(String(body?.venueId ?? ""));
  if (!venueId || typeof body?.hotReelId !== "string" || !Array.isArray(body?.accountIds) || body.accountIds.some((id) => typeof id !== "string") || typeof body?.idempotencyKey !== "string" || (body.caption !== undefined && typeof body.caption !== "string")) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  try {
    await requireSocialPublishingActor(venueId, "publish");
    const rate = socialMutationRateLimit(venueId, "social_distribution_create");
    if (!rate.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
    const distribution = await createSocialDistributionRequest({
      venueId,
      hotReelPublicId: body.hotReelId,
      accountPublicIds: body.accountIds as string[],
      idempotencyKey: body.idempotencyKey,
      caption: body.caption as string | undefined,
    });
    return NextResponse.json({ distribution }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return socialErrorResponse(error);
  }
}
