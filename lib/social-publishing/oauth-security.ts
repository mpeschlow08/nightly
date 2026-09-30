import { createHash, randomBytes } from "node:crypto";

import { SocialPublishingError } from "./errors";
import type { SocialPlatform } from "./types";

export const SOCIAL_OAUTH_CALLBACK_PATH = "/api/owner/social-accounts/callback";
export const SOCIAL_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export function hashOAuthState(state: string) {
  return createHash("sha256").update(state).digest("hex");
}

export function createOAuthPkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function validateSocialOAuthRedirect(redirectUri: string, configuredOrigin = process.env.SOCIAL_OAUTH_REDIRECT_ORIGIN): string {
  if (!configuredOrigin) throw new SocialPublishingError("unsafe_redirect", 503);
  let target: URL;
  let origin: URL;
  try {
    target = new URL(redirectUri);
    origin = new URL(configuredOrigin);
  } catch {
    throw new SocialPublishingError("unsafe_redirect", 400);
  }
  if (origin.protocol !== "https:" || target.protocol !== "https:" || target.origin !== origin.origin || target.pathname !== SOCIAL_OAUTH_CALLBACK_PATH || target.username || target.password || target.search || target.hash) {
    throw new SocialPublishingError("unsafe_redirect", 400);
  }
  return target.toString();
}

export function validateOAuthAuthorizationUrl(authorizationUrl: URL, allowedOrigin: string): URL {
  let expectedOrigin: URL;
  try {
    expectedOrigin = new URL(allowedOrigin);
  } catch {
    throw new SocialPublishingError("provider_not_configured", 503);
  }
  const hasCredentialParameter = [...authorizationUrl.searchParams.keys()].some((key) => /^(access_token|refresh_token|client_secret|password|cookie)$/i.test(key));
  if (expectedOrigin.protocol !== "https:" || authorizationUrl.protocol !== "https:" || authorizationUrl.origin !== expectedOrigin.origin || authorizationUrl.username || authorizationUrl.password || authorizationUrl.hash || hasCredentialParameter) {
    throw new SocialPublishingError("unsafe_redirect", 500);
  }
  return authorizationUrl;
}

export function validateRequestedSocialScopes(requestedScopes: string[], allowedScopes: ReadonlySet<string>): string[] {
  if (!Array.isArray(requestedScopes) || requestedScopes.length === 0 || requestedScopes.length > 20 || requestedScopes.some((scope) => typeof scope !== "string" || scope.length > 128 || !allowedScopes.has(scope))) {
    throw new SocialPublishingError("scope_not_allowed", 400);
  }
  return [...new Set(requestedScopes)].sort();
}

export function socialOAuthStateFailure(input: { exists: boolean; consumedAt: Date | null; expiresAt: Date | null; now: Date }): "oauth_state_invalid" | "oauth_state_expired" | "oauth_state_replayed" {
  if (!input.exists) return "oauth_state_invalid";
  if (input.consumedAt !== null) return "oauth_state_replayed";
  if (input.expiresAt === null || input.expiresAt <= input.now) return "oauth_state_expired";
  return "oauth_state_invalid";
}

export function socialOAuthStateMatchesActor(input: { stateVenueId: number; stateActorClerkUserId: string; venueId: number; actorClerkUserId: string }) {
  return input.stateVenueId === input.venueId && input.stateActorClerkUserId === input.actorClerkUserId;
}

export function isSocialPlatform(value: unknown): value is SocialPlatform {
  return value === "instagram" || value === "facebook" || value === "tiktok" || value === "youtube" || value === "x";
}
