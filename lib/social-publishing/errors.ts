import type { SocialProviderErrorCode } from "./types";

export type SocialErrorCode = SocialProviderErrorCode | "unauthorized" | "forbidden" | "not_found" | "invalid_request" | "policy_disabled" | "idempotency_conflict" | "account_not_connected" | "media_not_eligible" | "provider_not_configured" | "feature_disabled" | "publishing_in_progress" | "oauth_state_invalid" | "oauth_state_expired" | "oauth_state_replayed" | "unsafe_redirect" | "scope_not_allowed";

const SOCIAL_ERROR_CODES = new Set<SocialErrorCode>([
  "retryable_provider_error", "provider_timeout", "authorization_expired", "authorization_revoked", "unsupported_capability",
  "policy_denied", "invalid_media", "permanent_provider_rejection", "media_not_eligible", "account_disconnected", "internal_failure",
  "unauthorized", "forbidden", "not_found", "invalid_request", "policy_disabled", "idempotency_conflict", "account_not_connected",
  "provider_not_configured", "feature_disabled", "publishing_in_progress", "oauth_state_invalid", "oauth_state_expired", "oauth_state_replayed", "unsafe_redirect", "scope_not_allowed",
]);

export class SocialPublishingError extends Error {
  constructor(readonly code: SocialErrorCode, readonly status: number = 400) {
    super(code);
    this.name = "SocialPublishingError";
  }
}

export function safeSocialError(error: unknown): { code: SocialErrorCode; status: number } {
  if (error instanceof SocialPublishingError) return { code: error.code, status: error.status };
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "string" && SOCIAL_ERROR_CODES.has(code as SocialErrorCode)) {
      const status = code === "internal_failure" ? 500 : code === "provider_not_configured" || code === "feature_disabled" ? 503 : code === "not_found" ? 404 : code === "forbidden" ? 403 : code === "idempotency_conflict" || code === "policy_disabled" || code === "account_not_connected" || code === "unsupported_capability" || code === "publishing_in_progress" ? 409 : 400;
      return { code: code as SocialErrorCode, status };
    }
  }
  return { code: "internal_failure", status: 500 };
}
