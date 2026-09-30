import { NextResponse } from "next/server";

import { retrySocialDestination, revokeSocialDestination } from "@/lib/social-publishing/distribution-service";
import { requireSocialPublishingActor } from "@/lib/social-publishing/auth";
import { parseVenueId, readJsonObject, sameOriginMutation, socialErrorResponse, socialMutationRateLimit } from "../../_lib/http";

export async function POST(request: Request, context: { params: Promise<{ destinationId: string }> }) {
  if (!sameOriginMutation(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { destinationId } = await context.params;
  const body = await readJsonObject(request);
  const venueId = parseVenueId(String(body?.venueId ?? ""));
  if (!venueId || !/^[A-Fa-f0-9-]{16,64}$/.test(destinationId) || (body?.action !== "retry" && body?.action !== "revoke")) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    await requireSocialPublishingActor(venueId, body.action);
    const rate = socialMutationRateLimit(venueId, `social_destination_${body.action}`);
    if (!rate.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
    const result = body.action === "retry"
      ? await retrySocialDestination({ venueId, destinationPublicId: destinationId })
      : await revokeSocialDestination({ venueId, destinationPublicId: destinationId });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return socialErrorResponse(error);
  }
}
