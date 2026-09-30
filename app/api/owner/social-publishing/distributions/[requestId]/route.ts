import { NextResponse } from "next/server";

import { getSocialDistribution, reviewSocialDistribution } from "@/lib/social-publishing/distribution-service";
import { requireSocialPublishingActor } from "@/lib/social-publishing/auth";
import { parseVenueId, readJsonObject, sameOriginMutation, socialErrorResponse, socialMutationRateLimit } from "../../_lib/http";

export async function GET(request: Request, context: { params: Promise<{ requestId: string }> }) {
  const venueId = parseVenueId(new URL(request.url).searchParams.get("venueId"));
  const { requestId } = await context.params;
  if (!venueId || !/^[A-Fa-f0-9-]{16,64}$/.test(requestId)) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    return NextResponse.json({ distribution: await getSocialDistribution(venueId, requestId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return socialErrorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  if (!sameOriginMutation(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { requestId } = await context.params;
  const body = await readJsonObject(request);
  const venueId = parseVenueId(String(body?.venueId ?? ""));
  if (!venueId || !/^[A-Fa-f0-9-]{16,64}$/.test(requestId) || (body?.decision !== "approve" && body?.decision !== "reject")) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    await requireSocialPublishingActor(venueId, "review");
    const rate = socialMutationRateLimit(venueId, "social_distribution_review");
    if (!rate.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
    const distribution = await reviewSocialDistribution({ venueId, requestPublicId: requestId, decision: body.decision });
    return NextResponse.json({ distribution }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return socialErrorResponse(error);
  }
}
