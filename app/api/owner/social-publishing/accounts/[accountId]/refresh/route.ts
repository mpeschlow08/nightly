import { NextResponse } from "next/server";

import { refreshSocialAccountAuthorization } from "@/lib/social-publishing/distribution-service";
import { requireSocialPublishingActor } from "@/lib/social-publishing/auth";
import { parseVenueId, readJsonObject, sameOriginMutation, socialErrorResponse, socialMutationRateLimit } from "../../../_lib/http";

export async function POST(request: Request, context: { params: Promise<{ accountId: string }> }) {
  if (!sameOriginMutation(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { accountId } = await context.params;
  const body = await readJsonObject(request);
  const venueId = parseVenueId(String(body?.venueId ?? ""));
  if (!venueId || !/^[A-Fa-f0-9-]{16,64}$/.test(accountId)) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    await requireSocialPublishingActor(venueId, "manage_accounts");
    const rate = socialMutationRateLimit(venueId, "social_account_refresh");
    if (!rate.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
    return NextResponse.json(await refreshSocialAccountAuthorization({ venueId, accountPublicId: accountId }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return socialErrorResponse(error);
  }
}
