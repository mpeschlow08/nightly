import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { socialOAuthStates } from "@/db/schema";
import { requireSocialPublishingActor } from "@/lib/social-publishing/auth";
import { completeSocialOAuth, rejectSocialOAuth } from "@/lib/social-publishing/oauth";
import { hashOAuthState, validateSocialOAuthRedirect } from "@/lib/social-publishing/oauth-security";
import { SocialPublishingError, safeSocialError } from "@/lib/social-publishing/errors";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const clerk = await auth();
  if (!clerk.userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!state) return NextResponse.json({ error: "oauth_state_invalid" }, { status: 400 });

  try {
    const [stored] = await db.select({ venueId: socialOAuthStates.venueId, redirectUri: socialOAuthStates.redirectUri })
      .from(socialOAuthStates)
      .where(eq(socialOAuthStates.stateHash, hashOAuthState(state)))
      .limit(1);
    if (!stored) throw new SocialPublishingError("oauth_state_invalid", 400);
    const actor = await requireSocialPublishingActor(stored.venueId, "manage_accounts");
    if (actor.clerkUserId !== clerk.userId) throw new SocialPublishingError("oauth_state_invalid", 400);
    const callbackOrigin = process.env.SOCIAL_OAUTH_REDIRECT_ORIGIN;
    if (!callbackOrigin) throw new SocialPublishingError("provider_not_configured", 503);
    const expectedUri = validateSocialOAuthRedirect(new URL("/api/owner/social-accounts/callback", callbackOrigin).toString());
    if (expectedUri !== stored.redirectUri) throw new SocialPublishingError("unsafe_redirect", 400);
    if (!code || url.searchParams.has("error")) {
      await rejectSocialOAuth({ actor, state, redirectUri: expectedUri });
      return NextResponse.json({ error: "oauth_state_invalid" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    await completeSocialOAuth({ actor, state, code, redirectUri: expectedUri });
    return NextResponse.redirect(new URL("/owner/publishing?social=connected", callbackOrigin), { status: 303 });
  } catch (error) {
    const safe = safeSocialError(error);
    return NextResponse.json({ error: safe.code }, { status: safe.status, headers: { "Cache-Control": "no-store" } });
  }
}
