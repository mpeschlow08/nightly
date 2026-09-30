import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { transitionSocialPublicationState } from "@/lib/social-publishing/core";
import { getProviderCapabilities, supportsCapability } from "@/lib/social-publishing/capabilities";
import { mayManageSocialPublishing } from "@/lib/social-publishing/authorization-policy";
import { loggerInternals } from "@/lib/platform/logger";
import { safeSocialError } from "@/lib/social-publishing/errors";
import { createOAuthPkcePair, hashOAuthState, socialOAuthStateFailure, socialOAuthStateMatchesActor, validateOAuthAuthorizationUrl, validateRequestedSocialScopes, validateSocialOAuthRedirect } from "@/lib/social-publishing/oauth-security";
import { aggregateDistributionState, canApplyPublishResult, canManuallyRetryDestination, destinationStartState, distributionAuthorityUserId, distributionRequestFingerprint, hasActiveRemoteProviderWork, isSocialPublicationMediaEligible, retryDelayMs, socialAccountReconnectDecision, socialAccountSnapshotMatches } from "@/lib/social-publishing/policy";
import { isSocialProviderAllowed } from "@/lib/social-publishing/provider";
import { MockSocialPublishingProvider } from "@/lib/social-publishing/provider/mock";
import type { SocialPublicationRecord } from "@/lib/social-publishing/types";
import { readJsonObject } from "@/app/api/owner/social-publishing/_lib/http";

const readyMedia = {
  reelState: "ready",
  reelReviewState: "approved",
  reelExpiresAt: null,
  reelDeletedAt: null,
  deviceLifecycleState: "active",
  serviceEntitlementState: "active",
  serviceSuspendedAt: null,
  contentEligibility: "approved",
  hotReelEligible: true,
  publicPublishingEnabled: true,
  privacyMode: "public",
};

function publishedRecord(): SocialPublicationRecord {
  return {
    id: "destination-public-12345678",
    entityType: "hot_reel",
    entityId: "hot-reel-public-123456",
    venueId: 42,
    actorUserId: 7,
    platform: "instagram",
    lifecycleState: "queued",
    publicationState: "scheduled",
    reviewState: "approved",
    contentText: "Tonight was unreal.",
    providerKey: "mock",
    providerPostId: null,
    providerUrl: null,
    publishedAt: null,
    revokedAt: null,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  };
}

test("destination lifecycle allows only supported transitions and keeps revoke idempotent", () => {
  assert.equal(transitionSocialPublicationState("queued", "processing"), "processing");
  assert.throws(() => transitionSocialPublicationState("published", "queued"), /invalid_transition/);
  assert.throws(() => transitionSocialPublicationState("revoked", "published"), /invalid_transition/);
});

test("review policy defaults to waiting and disabled policy creates no work", () => {
  assert.equal(destinationStartState("review_before_post"), "waiting_for_review");
  assert.equal(destinationStartState("auto_publish"), "queued");
  assert.equal(destinationStartState("disabled"), null);
});

test("publication eligibility is independent and fails closed on device or media policy", () => {
  assert.equal(isSocialPublicationMediaEligible(readyMedia), true);
  assert.equal(isSocialPublicationMediaEligible({ ...readyMedia, publicPublishingEnabled: false }), false);
  assert.equal(isSocialPublicationMediaEligible({ ...readyMedia, privacyMode: "private" }), false);
  assert.equal(isSocialPublicationMediaEligible({ ...readyMedia, reelReviewState: "pending" }), false);
  assert.equal(isSocialPublicationMediaEligible({ ...readyMedia, serviceEntitlementState: "suspended" }), false);
});

test("idempotency fingerprints ignore destination order but detect payload changes", () => {
  const first = distributionRequestFingerprint({ hotReelPublicId: "hot-reel-12345678", accountPublicIds: ["b-account-123", "a-account-123"], caption: "Night out" });
  const reordered = distributionRequestFingerprint({ hotReelPublicId: "hot-reel-12345678", accountPublicIds: ["a-account-123", "b-account-123"], caption: "Night out" });
  const changed = distributionRequestFingerprint({ hotReelPublicId: "hot-reel-12345678", accountPublicIds: ["a-account-123", "b-account-123"], caption: "Different" });
  assert.equal(first, reordered);
  assert.notEqual(first, changed);
});

test("retry backoff is deterministic, increasing, and bounded", () => {
  const first = retryDelayMs(1, "destination-1");
  assert.equal(first, retryDelayMs(1, "destination-1"));
  assert.ok(retryDelayMs(2, "destination-1") > first);
  assert.ok(retryDelayMs(100, "destination-1") <= 6 * 60 * 60 * 1000);
});

test("independent destination results preserve a truthful partial distribution summary", () => {
  assert.equal(aggregateDistributionState(["published", "failed_retryable", "processing"]), "processing");
  assert.equal(aggregateDistributionState(["published", "failed_permanent"]), "partial");
  assert.equal(aggregateDistributionState(["published", "published"]), "completed");
  assert.equal(aggregateDistributionState(["cancelled", "cancelled"]), "cancelled");
});

test("stale publication outcomes and active disconnects are classified safely", () => {
  test("manual retry respects the durable backoff deadline and attempt ceiling", () => {
    const deadline = new Date("2026-09-29T12:00:00.000Z");
    const base = { state: "failed_retryable" as const, attempts: 2, maxAttempts: 5, nextRetryAt: deadline };
    assert.equal(canManuallyRetryDestination({ ...base, now: new Date(deadline.getTime() - 1) }), false);
    assert.equal(canManuallyRetryDestination({ ...base, now: deadline }), true);
    assert.equal(canManuallyRetryDestination({ ...base, now: new Date(deadline.getTime() + 1) }), true);
    assert.equal(canManuallyRetryDestination({ ...base, attempts: 5, nextRetryAt: null, now: deadline }), false);
    assert.equal(canManuallyRetryDestination({ ...base, state: "failed_permanent", nextRetryAt: null, now: deadline }), false);
  });
  assert.equal(canApplyPublishResult("uploading"), true);
  assert.equal(canApplyPublishResult("published"), false);
  assert.equal(canApplyPublishResult("revoked"), false);
  assert.equal(canApplyPublishResult("cancelled"), false);
  assert.equal(hasActiveRemoteProviderWork(["queued", "processing"]), true);
  assert.equal(hasActiveRemoteProviderWork(["queued", "failed_retryable"]), false);
});

test("reviewed distributions use the approving owner as publication authority", () => {
  assert.equal(distributionAuthorityUserId({ actorUserId: 10, reviewedByUserId: 22 }), 22);
  assert.equal(distributionAuthorityUserId({ actorUserId: 10, reviewedByUserId: null }), 10);
});

test("social account reconnect preserves venue ownership and waits for remote work", () => {
  assert.equal(socialAccountReconnectDecision({ existingVenueId: null, requestedVenueId: 5, hasActiveRemoteWork: false }), "new_account");
  assert.equal(socialAccountReconnectDecision({ existingVenueId: 5, requestedVenueId: 5, hasActiveRemoteWork: false }), "reconnect");
  assert.equal(socialAccountReconnectDecision({ existingVenueId: 6, requestedVenueId: 5, hasActiveRemoteWork: false }), "venue_conflict");
  assert.equal(socialAccountReconnectDecision({ existingVenueId: 5, requestedVenueId: 5, hasActiveRemoteWork: true }), "publishing_in_progress");
});

test("credential refresh snapshot cannot match after disconnect or newer update", () => {
  const expectedUpdatedAt = new Date("2026-09-29T12:00:00.000Z");
  const base = {
    expectedCredentialRef: "credential-ref-a",
    currentCredentialRef: "credential-ref-a",
    expectedConnectionState: "connected",
    currentConnectionState: "connected",
    expectedAuthorizationState: "expired",
    currentAuthorizationState: "expired",
    expectedUpdatedAt,
    currentUpdatedAt: expectedUpdatedAt,
  };
  assert.equal(socialAccountSnapshotMatches(base), true);
  assert.equal(socialAccountSnapshotMatches({ ...base, currentConnectionState: "disconnected" }), false);
  assert.equal(socialAccountSnapshotMatches({ ...base, currentCredentialRef: null }), false);
  assert.equal(socialAccountSnapshotMatches({ ...base, currentUpdatedAt: new Date(expectedUpdatedAt.getTime() + 1) }), false);
});

test("mock provider cannot be resolved or injected in Production", () => {
  assert.equal(isSocialProviderAllowed("mock", "test"), true);
  assert.equal(isSocialProviderAllowed("mock", "production"), false);
  assert.equal(isSocialProviderAllowed("official-provider", "production"), true);
});

test("owner API JSON reader accepts bounded input and rejects oversized bodies", async () => {
  const maxBytes = 16 * 1024;
  const prefix = '{"value":"';
  const suffix = '"}';
  const exactLimit = `${prefix}${"a".repeat(maxBytes - prefix.length - suffix.length)}${suffix}`;
  assert.equal(new TextEncoder().encode(exactLimit).byteLength, maxBytes);
  const accepted = await readJsonObject(new Request("https://nightly.example/api", { method: "POST", headers: { "Content-Type": "application/json" }, body: exactLimit }));
  assert.equal(typeof accepted?.value, "string");
  const rejected = await readJsonObject(new Request("https://nightly.example/api", { method: "POST", body: `${exactLimit} ` }));
  assert.equal(rejected, null);
});

test("owner API JSON reader rejects non-JSON content types", async () => {
  const parsed = await readJsonObject(new Request("https://nightly.example/api", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ venueId: 42 }),
  }));
  assert.equal(parsed, null);
});

test("owner API JSON reader rejects malformed, empty, form, and multipart bodies", async () => {
  const cases = [
    { headers: { "Content-Type": "application/json" }, body: "" },
    { headers: { "Content-Type": "application/json" }, body: "{\"venueId\":" },
    { headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "venueId=42" },
    { headers: { "Content-Type": "multipart/form-data; boundary=nightly-test" }, body: "--nightly-test--\r\n" },
  ];
  for (const input of cases) {
    const parsed = await readJsonObject(new Request("https://nightly.example/api", { method: "POST", ...input }));
    assert.equal(parsed, null);
  }
});

test("0034 source contains the exact DB integrity relationship constraints", async () => {
  const [schema, migration] = await Promise.all([
    readFile("db/schema.ts", "utf8"),
    readFile("drizzle/0034_social_publishing_integrity_hardening.sql", "utf8"),
  ]);
  assert.match(schema, /social_publications_request_reel_venue_fkey/);
  assert.match(schema, /social_publications_account_venue_platform_fkey/);
  assert.match(migration, /social_distribution_requests_id_hot_reel_venue_unique/);
  assert.match(migration, /social_platform_accounts_id_venue_platform_unique/);
  assert.match(migration, /social_publications_request_reel_venue_fkey/);
  assert.match(migration, /social_publications_account_venue_platform_fkey/);
});

test("provider capabilities fail closed outside the explicit mock adapter", () => {
  assert.equal(getProviderCapabilities("mock", "instagram").has("can_idempotently_publish"), true);
  assert.equal(getProviderCapabilities("official-adapter-not-installed", "instagram").size, 0);
});

test("publishing authorization is owner-only, active, and venue-scoped", () => {
  assert.equal(mayManageSocialPublishing({ isActiveUser: true, venueMembershipRole: "owner", venueMatches: true }), true);
  assert.equal(mayManageSocialPublishing({ isActiveUser: true, venueMembershipRole: "manager", venueMatches: true }), false);
  assert.equal(mayManageSocialPublishing({ isActiveUser: true, venueMembershipRole: "tech_operator", venueMatches: true }), false);
  assert.equal(mayManageSocialPublishing({ isActiveUser: true, venueMembershipRole: "owner", venueMatches: false }), false);
  assert.equal(mayManageSocialPublishing({ isActiveUser: false, venueMembershipRole: "owner", venueMatches: true }), false);
});

test("mock publication retries converge on one provider publication ID", async () => {
  const provider = new MockSocialPublishingProvider();
  const record = publishedRecord();
  const first = await provider.publish(record, { idempotencyKey: "request-destination-123" });
  const second = await provider.publish(record, { idempotencyKey: "request-destination-123" });
  assert.equal(first.providerPostId, second.providerPostId);
  assert.equal((await provider.findPublicationByIdempotencyKey({ idempotencyKey: "request-destination-123" })).state, "published");
});

test("mock publication access is owner and venue scoped", async () => {
  const provider = new MockSocialPublishingProvider();
  const record = publishedRecord();
  const sameVenueOwner = await provider.authorizePublicationAccess({ record, actor: { userId: 2, role: "owner", venueId: 42 } });
  const crossVenueOwner = await provider.authorizePublicationAccess({ record, actor: { userId: 2, role: "owner", venueId: 43 } });
  const consumer = await provider.authorizePublicationAccess({ record, actor: { userId: 7, role: "consumer", venueId: 42 } });
  assert.equal(sameVenueOwner.allowed, true);
  assert.equal(crossVenueOwner.allowed, false);
  assert.equal(consumer.allowed, false);
});

test("mock provider preserves asynchronous processing until completion", async () => {
  const provider = new MockSocialPublishingProvider({ processingPublishes: true });
  const result = await provider.publish(publishedRecord(), { idempotencyKey: "async-destination-1" });
  assert.equal(result.providerStatus, "processing");
  assert.equal((await provider.inspectPublication({ providerPublicationId: result.providerPostId })).state, "processing");
  provider.completeProcessing(result.providerPostId);
  assert.equal((await provider.inspectPublication({ providerPublicationId: result.providerPostId })).state, "published");
});

test("mock provider retries bounded transient failures and preserves permanent failures", async () => {
  const transient = new MockSocialPublishingProvider({ failures: { publish: 1 } });
  await assert.rejects(transient.publish(publishedRecord(), { idempotencyKey: "transient-destination-1" }), /retryable_provider_error/);
  assert.equal((await transient.publish(publishedRecord(), { idempotencyKey: "transient-destination-1" })).providerStatus, "published");

  const permanent = new MockSocialPublishingProvider({ failures: { publish: { count: 1, code: "permanent_provider_rejection", retryable: false } } });
  await assert.rejects(permanent.publish(publishedRecord(), { idempotencyKey: "permanent-destination-1" }), /permanent_provider_rejection/);
});

test("revocation is idempotent and unsupported deletion fails closed", async () => {
  const provider = new MockSocialPublishingProvider();
  const record = { ...publishedRecord(), lifecycleState: "published" as const, providerPostId: "provider-post-123" };
  const revoked = await provider.revoke(record);
  const repeated = await provider.revoke(record);
  assert.equal(revoked.providerStatus, "revoked");
  assert.equal(repeated.providerPostId, revoked.providerPostId);

  class NoDeleteProvider extends MockSocialPublishingProvider {
    override getCapabilities(platform: "instagram" | "facebook" | "tiktok" | "youtube" | "x") {
      const capabilities = new Set(super.getCapabilities(platform));
      capabilities.delete("can_delete_publication");
      return capabilities;
    }
  }
  assert.equal(supportsCapability(new NoDeleteProvider().getCapabilities("instagram"), "can_delete_publication"), false);
});

test("OAuth state hashing and PKCE are opaque and scope-allowlisted", () => {
  const state = "state-value-that-is-long-enough-to-test";
  assert.notEqual(hashOAuthState(state), state);
  assert.notEqual(hashOAuthState(state), hashOAuthState(`${state}-tampered`));
  const pkce = createOAuthPkcePair();
  assert.ok(pkce.verifier.length >= 40);
  assert.notEqual(pkce.verifier, pkce.challenge);
  assert.deepEqual(validateRequestedSocialScopes(["publish", "profile"], new Set(["publish", "profile"])), ["profile", "publish"]);
  assert.throws(() => validateRequestedSocialScopes(["admin"], new Set(["publish"])), /scope_not_allowed/);
});

test("OAuth state rejects replay, expiry, and venue or actor mismatch", () => {
  const now = new Date("2026-09-29T12:00:00.000Z");
  assert.equal(socialOAuthStateFailure({ exists: true, consumedAt: new Date(now.getTime() - 1), expiresAt: new Date(now.getTime() + 1000), now }), "oauth_state_replayed");
  assert.equal(socialOAuthStateFailure({ exists: true, consumedAt: null, expiresAt: new Date(now.getTime()), now }), "oauth_state_expired");
  assert.equal(socialOAuthStateFailure({ exists: false, consumedAt: null, expiresAt: null, now }), "oauth_state_invalid");
  assert.equal(socialOAuthStateMatchesActor({ stateVenueId: 4, stateActorClerkUserId: "user_a", venueId: 4, actorClerkUserId: "user_a" }), true);
  assert.equal(socialOAuthStateMatchesActor({ stateVenueId: 4, stateActorClerkUserId: "user_a", venueId: 5, actorClerkUserId: "user_a" }), false);
  assert.equal(socialOAuthStateMatchesActor({ stateVenueId: 4, stateActorClerkUserId: "user_a", venueId: 4, actorClerkUserId: "user_b" }), false);
});

test("OAuth callback redirect accepts only the fixed HTTPS callback URI", () => {
  const origin = "https://nightly.example";
  assert.equal(validateSocialOAuthRedirect(`${origin}/api/owner/social-accounts/callback`, origin), `${origin}/api/owner/social-accounts/callback`);
  assert.throws(() => validateSocialOAuthRedirect("https://evil.example/redirect", origin), /unsafe_redirect/);
  assert.throws(() => validateSocialOAuthRedirect("https://nightly.example/api/owner/social-accounts/callback?next=https://evil.example", origin), /unsafe_redirect/);
  assert.equal(validateOAuthAuthorizationUrl(new URL("https://accounts.example/oauth/authorize"), "https://accounts.example").origin, "https://accounts.example");
  assert.throws(() => validateOAuthAuthorizationUrl(new URL("https://evil.example/oauth/authorize"), "https://accounts.example"), /unsafe_redirect/);
  assert.throws(() => validateOAuthAuthorizationUrl(new URL("https://accounts.example/oauth/authorize?client_secret=synthetic"), "https://accounts.example"), /unsafe_redirect/);
});

test("public error and diagnostic metadata do not expose credential values", () => {
  const redacted = loggerInternals.redact({ accessToken: "synthetic-secret", refresh_token: "synthetic-refresh" }) as Record<string, unknown>;
  assert.equal(redacted.accessToken, "[REDACTED]");
  assert.equal(redacted.refresh_token, "[REDACTED]");
  assert.deepEqual(safeSocialError(new Error("provider leaked synthetic-secret")), { code: "internal_failure", status: 500 });
});

test("runtime log redaction covers OAuth codes, PKCE verifiers, signed URLs, and bearer values", () => {
  const oauthCode = "synthetic-oauth-code-value-0123456789";
  const verifier = "synthetic-pkce-verifier-value-0123456789";
  const bearer = "synthetic-bearer-token-value-0123456789";
  const signedUrl = "https://cdn.mock.example/media.mp4?token=synthetic-signed-token-value&sig=0123456789abcdef0123456789abcdef";
  const redacted = loggerInternals.redact({
    oauthCode,
    pkceVerifier: verifier,
    signedUrl,
    authorization: `Bearer ${bearer}`,
  }) as Record<string, unknown>;
  assert.equal(redacted.oauthCode, "[REDACTED]");
  assert.equal(redacted.pkceVerifier, "[REDACTED]");
  assert.equal(redacted.signedUrl, "[REDACTED]");
  assert.equal(redacted.authorization, "[REDACTED]");
});
