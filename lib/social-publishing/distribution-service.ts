import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, lt, lte, or } from "drizzle-orm";

import { db } from "@/db";
import { auditLogs, hotReels, nightlyDevices, platformFeatureFlagOverrides, platformFeatureFlags, socialDistributionRequests, socialPlatformAccounts, socialPublications, socialPublishingPolicies, users, venueMembers } from "@/db/schema";
import { evaluateFlagState } from "@/app/admin/lib/feature-flags";
import { authorizeHotReelPlayback } from "@/lib/hot-reel/core";
import { getHotReelProvider } from "@/lib/hot-reel/provider";
import type { HotReelRecord } from "@/lib/hot-reel/types";
import { isFeatureEnabled } from "@/lib/platform/feature-access";
import { logger } from "@/lib/platform/logger";
import { requireSocialPublishingActor, type AuthorizedSocialActor } from "./auth";
import { mayManageSocialPublishing } from "./authorization-policy";
import { getSocialCredentialStore } from "./credentials";
import { SocialPublishingError } from "./errors";
import { getSocialPublishingProvider, isSocialProviderAllowed } from "./provider";
import { aggregateDistributionState, canApplyPublishResult, canManuallyRetryDestination, distributionAuthorityUserId, distributionRequestFingerprint, destinationStartState, hasActiveRemoteProviderWork, isSocialPublicationMediaEligible, retryDelayMs, socialAccountSnapshotMatches } from "./policy";
import { SocialProviderError } from "./types";
import type { SocialPublicationRecord, SocialPublishingMode } from "./types";

const MAX_DESTINATIONS = 5;
const MAX_CAPTION_LENGTH = 2200;
const MAX_ATTEMPTS = 5;
const SAFE_PROVIDER_FAILURES = new Set([
  "retryable_provider_error", "provider_timeout", "authorization_expired", "authorization_revoked",
  "unsupported_capability", "policy_denied", "invalid_media", "permanent_provider_rejection",
  "media_not_eligible", "account_disconnected", "internal_failure",
]);

function parseStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function eligible(row: {
  reelState: string; reelReviewState: string; reelExpiresAt: Date | null; reelDeletedAt: Date | null;
  deviceLifecycleState: string; serviceEntitlementState: string; serviceSuspendedAt: Date | null;
  contentEligibility: string; hotReelEligible: boolean; publicPublishingEnabled: boolean; privacyMode: string;
}, now = Date.now()) {
  return isSocialPublicationMediaEligible({
    reelState: row.reelState,
    reelReviewState: row.reelReviewState,
    reelExpiresAt: row.reelExpiresAt,
    reelDeletedAt: row.reelDeletedAt,
    deviceLifecycleState: row.deviceLifecycleState,
    serviceEntitlementState: row.serviceEntitlementState,
    serviceSuspendedAt: row.serviceSuspendedAt,
    contentEligibility: row.contentEligibility,
    hotReelEligible: row.hotReelEligible,
    publicPublishingEnabled: row.publicPublishingEnabled,
    privacyMode: row.privacyMode,
  }, now);
}

async function loadEligibleReel(venueId: number, hotReelPublicId: string, now = Date.now()) {
  const [row] = await db
    .select({
      reel: hotReels,
      deviceLifecycleState: nightlyDevices.lifecycleState,
      serviceEntitlementState: nightlyDevices.serviceEntitlementState,
      serviceSuspendedAt: nightlyDevices.serviceSuspendedAt,
      contentEligibility: nightlyDevices.contentEligibility,
      hotReelEligible: nightlyDevices.hotReelEligible,
      publicPublishingEnabled: nightlyDevices.publicPublishingEnabled,
      privacyMode: nightlyDevices.privacyMode,
    })
    .from(hotReels)
    .innerJoin(nightlyDevices, eq(hotReels.deviceId, nightlyDevices.id))
    .where(and(eq(hotReels.publicId, hotReelPublicId), eq(hotReels.venueId, venueId), eq(nightlyDevices.venueId, venueId)))
    .limit(1);

  if (!row || !eligible({
    reelState: row.reel.lifecycleState,
    reelReviewState: row.reel.reviewState,
    reelExpiresAt: row.reel.expiresAt,
    reelDeletedAt: row.reel.deletedAt,
    deviceLifecycleState: row.deviceLifecycleState,
    serviceEntitlementState: row.serviceEntitlementState,
    serviceSuspendedAt: row.serviceSuspendedAt,
    contentEligibility: row.contentEligibility,
    hotReelEligible: row.hotReelEligible,
    publicPublishingEnabled: row.publicPublishingEnabled,
    privacyMode: row.privacyMode,
  }, now)) {
    throw new SocialPublishingError("media_not_eligible", 409);
  }

  return row.reel;
}

function safeDestinationSummary(row: {
  publicId: string; platform: string; state: string; providerUrl: string | null; publishedAt: Date | null;
  lastFailureCode: string | null; accountDisplayName: string;
}) {
  return {
    id: row.publicId,
    platform: row.platform,
    accountName: row.accountDisplayName,
    state: row.state,
    publicUrl: row.providerUrl,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    failureCode: row.lastFailureCode,
  };
}

function safeProviderUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function safeProviderPublicationId(value: string): string {
  if (!/^[A-Za-z0-9._:-]{1,300}$/.test(value)) throw new SocialProviderError("internal_failure", true);
  return value;
}

export async function getSocialDistribution(venueId: number, requestPublicId: string, action: "view" = "view") {
  await requireSocialPublishingActor(venueId, action);
  const [request] = await db
    .select({ id: socialDistributionRequests.id, publicId: socialDistributionRequests.publicId, state: socialDistributionRequests.state, hotReelId: socialDistributionRequests.hotReelId, policyModeSnapshot: socialDistributionRequests.policyModeSnapshot, requestedAt: socialDistributionRequests.requestedAt, reviewedAt: socialDistributionRequests.reviewedAt, completedAt: socialDistributionRequests.completedAt })
    .from(socialDistributionRequests)
    .where(and(eq(socialDistributionRequests.venueId, venueId), eq(socialDistributionRequests.publicId, requestPublicId)))
    .limit(1);
  if (!request) throw new SocialPublishingError("not_found", 404);

  const destinations = await db
    .select({ publicId: socialPublications.publicId, platform: socialPublications.platform, state: socialPublications.state, providerUrl: socialPublications.providerUrl, publishedAt: socialPublications.publishedAt, lastFailureCode: socialPublications.lastFailureCode, accountDisplayName: socialPlatformAccounts.displayName })
    .from(socialPublications)
    .innerJoin(socialPlatformAccounts, eq(socialPublications.accountId, socialPlatformAccounts.id))
    .where(and(eq(socialPublications.requestId, request.id), eq(socialPublications.venueId, venueId)))
    .orderBy(asc(socialPublications.id));

  return {
    id: request.publicId,
    state: request.state,
    policyModeSnapshot: request.policyModeSnapshot,
    requestedAt: request.requestedAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    completedAt: request.completedAt?.toISOString() ?? null,
    destinations: destinations.map(safeDestinationSummary),
  };
}

export async function listSocialDistributionHistory(venueId: number) {
  await requireSocialPublishingActor(venueId, "view");
  const requests = await db
    .select({ id: socialDistributionRequests.id, publicId: socialDistributionRequests.publicId, state: socialDistributionRequests.state, policyModeSnapshot: socialDistributionRequests.policyModeSnapshot, requestedAt: socialDistributionRequests.requestedAt, completedAt: socialDistributionRequests.completedAt })
    .from(socialDistributionRequests)
    .where(eq(socialDistributionRequests.venueId, venueId))
    .orderBy(desc(socialDistributionRequests.createdAt))
    .limit(100);
  if (requests.length === 0) return [];
  const destinations = await db
    .select({ requestId: socialPublications.requestId, publicId: socialPublications.publicId, platform: socialPublications.platform, state: socialPublications.state, providerUrl: socialPublications.providerUrl, publishedAt: socialPublications.publishedAt, lastFailureCode: socialPublications.lastFailureCode, accountDisplayName: socialPlatformAccounts.displayName })
    .from(socialPublications)
    .innerJoin(socialPlatformAccounts, eq(socialPublications.accountId, socialPlatformAccounts.id))
    .where(and(eq(socialPublications.venueId, venueId), inArray(socialPublications.requestId, requests.map((request) => request.id))));
  const byRequest = new Map<number, typeof destinations>();
  for (const destination of destinations) {
    const group = byRequest.get(destination.requestId) ?? [];
    group.push(destination);
    byRequest.set(destination.requestId, group);
  }
  return requests.map((request) => ({
    id: request.publicId,
    state: request.state,
    policyModeSnapshot: request.policyModeSnapshot,
    requestedAt: request.requestedAt.toISOString(),
    completedAt: request.completedAt?.toISOString() ?? null,
    destinations: (byRequest.get(request.id) ?? []).map(safeDestinationSummary),
  }));
}

export async function listEligibleHotReels(venueId: number) {
  await requireSocialPublishingActor(venueId, "view");
  const rows = await db.select({
    reel: hotReels,
    deviceLifecycleState: nightlyDevices.lifecycleState,
    serviceEntitlementState: nightlyDevices.serviceEntitlementState,
    serviceSuspendedAt: nightlyDevices.serviceSuspendedAt,
    contentEligibility: nightlyDevices.contentEligibility,
    hotReelEligible: nightlyDevices.hotReelEligible,
    publicPublishingEnabled: nightlyDevices.publicPublishingEnabled,
    privacyMode: nightlyDevices.privacyMode,
  }).from(hotReels)
    .innerJoin(nightlyDevices, eq(hotReels.deviceId, nightlyDevices.id))
    .where(and(eq(hotReels.venueId, venueId), eq(nightlyDevices.venueId, venueId)))
    .orderBy(desc(hotReels.createdAt))
    .limit(100);
  return rows.filter((row) => eligible({
    reelState: row.reel.lifecycleState, reelReviewState: row.reel.reviewState, reelExpiresAt: row.reel.expiresAt, reelDeletedAt: row.reel.deletedAt,
    deviceLifecycleState: row.deviceLifecycleState, serviceEntitlementState: row.serviceEntitlementState, serviceSuspendedAt: row.serviceSuspendedAt,
    contentEligibility: row.contentEligibility, hotReelEligible: row.hotReelEligible, publicPublishingEnabled: row.publicPublishingEnabled, privacyMode: row.privacyMode,
  })).map(({ reel }) => ({ id: reel.publicId, capturedAt: reel.capturedAt?.toISOString() ?? null, durationMs: reel.durationMs }));
}

export async function listSocialAccounts(venueId: number) {
  await requireSocialPublishingActor(venueId, "view");
  const rows = await db
    .select({ publicId: socialPlatformAccounts.publicId, platform: socialPlatformAccounts.platform, displayName: socialPlatformAccounts.displayName, accountType: socialPlatformAccounts.accountType, connectionState: socialPlatformAccounts.connectionState, authorizationState: socialPlatformAccounts.authorizationState, grantedScopesJson: socialPlatformAccounts.grantedScopesJson, capabilitiesJson: socialPlatformAccounts.capabilitiesJson, expiresAt: socialPlatformAccounts.expiresAt, reconnectRequired: socialPlatformAccounts.reconnectRequired, lastVerifiedAt: socialPlatformAccounts.lastVerifiedAt })
    .from(socialPlatformAccounts)
    .where(eq(socialPlatformAccounts.venueId, venueId))
    .orderBy(asc(socialPlatformAccounts.platform));
  return rows.map((row) => ({
    id: row.publicId,
    platform: row.platform,
    displayName: row.displayName,
    accountType: row.accountType,
    connectionState: row.connectionState,
    authorizationState: row.authorizationState,
    grantedScopes: parseStringArray(row.grantedScopesJson),
    capabilities: parseStringArray(row.capabilitiesJson),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    reconnectRequired: row.reconnectRequired,
    lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
  }));
}

export async function getSocialPublishingPolicy(venueId: number) {
  await requireSocialPublishingActor(venueId, "view");
  const [policy] = await db.select().from(socialPublishingPolicies).where(eq(socialPublishingPolicies.venueId, venueId)).limit(1);
  return policy ? { mode: policy.mode, revision: policy.revision, updatedAt: policy.updatedAt.toISOString() } : { mode: "review_before_post" as const, revision: 1, updatedAt: null };
}

export async function disconnectSocialAccount(input: { venueId: number; accountPublicId: string }) {
  const actor = await requireSocialPublishingActor(input.venueId, "manage_accounts");
  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const [account] = await tx.select().from(socialPlatformAccounts).where(and(
      eq(socialPlatformAccounts.publicId, input.accountPublicId),
      eq(socialPlatformAccounts.venueId, input.venueId),
    )).for("update").limit(1);
    if (!account) throw new SocialPublishingError("not_found", 404);
    const accountDestinations = await tx.select({ state: socialPublications.state }).from(socialPublications).where(and(
      eq(socialPublications.accountId, account.id),
    ));
    if (hasActiveRemoteProviderWork(accountDestinations.map((row) => row.state))) throw new SocialPublishingError("publishing_in_progress", 409);

    if (account.connectionState !== "disconnected") {
      await tx.update(socialPlatformAccounts).set({
        connectionState: "disconnected",
        authorizationState: "revoked",
        reconnectRequired: true,
        disconnectedAt: now,
        revokedAt: now,
        updatedAt: now,
      }).where(and(eq(socialPlatformAccounts.id, account.id), eq(socialPlatformAccounts.venueId, input.venueId)));
    }
    const cancelledDestinations = await tx.update(socialPublications).set({
      state: "cancelled",
      lastFailureCode: "account_disconnected",
      nextRetryAt: null,
      updatedAt: now,
    }).where(and(
      eq(socialPublications.accountId, account.id),
      inArray(socialPublications.state, ["queued", "waiting_for_review", "failed_retryable"]),
    )).returning({ requestId: socialPublications.requestId });
    const requestIds = [...new Set(cancelledDestinations.map((row) => row.requestId))];
    if (account.connectionState !== "disconnected") {
      await tx.insert(auditLogs).values({
        actorClerkUserId: actor.clerkUserId,
        actorRole: actor.role,
        entityType: "social_platform_account",
        entityId: account.publicId,
        action: "social_account_disconnected",
        previousValuesJson: JSON.stringify({ connectionState: account.connectionState, authorizationState: account.authorizationState }),
        nextValuesJson: JSON.stringify({ connectionState: "disconnected", authorizationState: "revoked" }),
        metadataJson: JSON.stringify({ venueId: input.venueId, platform: account.platform }),
      });
    }
    for (const requestId of requestIds) await refreshRequestStateInTransaction(tx, requestId, now);
    return { id: account.id, publicId: account.publicId, credentialRef: account.credentialRef, platform: account.platform, requestIds };
  });
  if (result.credentialRef) {
    await getSocialCredentialStore().delete(result.credentialRef);
    await db.update(socialPlatformAccounts).set({ credentialRef: null, updatedAt: new Date() }).where(and(
      eq(socialPlatformAccounts.id, result.id),
      eq(socialPlatformAccounts.venueId, input.venueId),
      eq(socialPlatformAccounts.connectionState, "disconnected"),
      eq(socialPlatformAccounts.credentialRef, result.credentialRef),
    ));
  }
  return { id: result.publicId, connectionState: "disconnected" };
}

export async function refreshSocialAccountAuthorization(input: { venueId: number; accountPublicId: string }) {
  const actor = await requireSocialPublishingActor(input.venueId, "manage_accounts");
  const [account] = await db.select().from(socialPlatformAccounts).where(and(
    eq(socialPlatformAccounts.publicId, input.accountPublicId),
    eq(socialPlatformAccounts.venueId, input.venueId),
  )).limit(1);
  if (!account) throw new SocialPublishingError("not_found", 404);
  if (!account.credentialRef || account.connectionState === "disconnected" || account.authorizationState === "revoked") throw new SocialPublishingError("account_not_connected", 409);
  const expectedCredentialRef = account.credentialRef;

  const provider = getSocialPublishingProvider();
  if (!provider.getCapabilities(account.platform).has("can_refresh_auth")) throw new SocialPublishingError("unsupported_capability", 409);
  const store = getSocialCredentialStore();
  const currentCredential = await store.get(expectedCredentialRef);
  if (!currentCredential) throw new SocialPublishingError("account_not_connected", 409);
  const refreshed = await provider.refreshAuthorization({ credential: currentCredential.secret });
  let credentialVersion = currentCredential.version;
  let valid = refreshed.valid && !refreshed.reconnectRequired;
  let expiresAt = refreshed.expiresAt === null ? null : new Date(refreshed.expiresAt);

  if (refreshed.rotatedCredential) {
    const swapped = await store.compareAndSwap(expectedCredentialRef, currentCredential.version, refreshed.rotatedCredential);
    if (!swapped) {
      const latestCredential = await store.get(expectedCredentialRef);
      if (!latestCredential) {
        valid = false;
      } else {
        credentialVersion = latestCredential.version;
        const latestValidation = await provider.validateConnection({ platform: account.platform, credential: latestCredential.secret });
        valid = latestValidation.valid && !latestValidation.reconnectRequired;
        expiresAt = latestValidation.expiresAt === null ? null : new Date(latestValidation.expiresAt);
      }
    } else {
      credentialVersion += 1;
    }
  }

  const now = new Date();
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx.update(socialPlatformAccounts).set({
      authorizationState: valid ? "valid" : "reconnect_required",
      connectionState: valid ? "connected" : "verification_failed",
      reconnectRequired: !valid,
      expiresAt,
      lastVerifiedAt: now,
      updatedAt: now,
    }).where(and(
      eq(socialPlatformAccounts.id, account.id),
      eq(socialPlatformAccounts.venueId, input.venueId),
      eq(socialPlatformAccounts.credentialRef, expectedCredentialRef),
      eq(socialPlatformAccounts.connectionState, account.connectionState),
      eq(socialPlatformAccounts.authorizationState, account.authorizationState),
      eq(socialPlatformAccounts.updatedAt, account.updatedAt),
    )).returning({ authorizationState: socialPlatformAccounts.authorizationState, expiresAt: socialPlatformAccounts.expiresAt });
    if (!row) return null;
    await tx.insert(auditLogs).values({
      actorClerkUserId: actor.clerkUserId,
      actorRole: actor.role,
      entityType: "social_platform_account",
      entityId: account.publicId,
      action: valid ? "social_authorization_refreshed" : "social_authorization_expired",
      nextValuesJson: JSON.stringify({ authorizationState: valid ? "valid" : "reconnect_required", expiresAt: expiresAt?.toISOString() ?? null }),
      metadataJson: JSON.stringify({ venueId: input.venueId, platform: account.platform, credentialVersion }),
    });
    return row;
  });
  if (!updated) {
    const [latest] = await db.select({ credentialRef: socialPlatformAccounts.credentialRef, connectionState: socialPlatformAccounts.connectionState, authorizationState: socialPlatformAccounts.authorizationState, expiresAt: socialPlatformAccounts.expiresAt, updatedAt: socialPlatformAccounts.updatedAt })
      .from(socialPlatformAccounts)
      .where(and(eq(socialPlatformAccounts.id, account.id), eq(socialPlatformAccounts.venueId, input.venueId)))
      .limit(1);
    if (!latest || !socialAccountSnapshotMatches({
      expectedCredentialRef,
      currentCredentialRef: latest.credentialRef,
      expectedConnectionState: account.connectionState,
      currentConnectionState: latest.connectionState,
      expectedAuthorizationState: account.authorizationState,
      currentAuthorizationState: latest.authorizationState,
      expectedUpdatedAt: account.updatedAt,
      currentUpdatedAt: latest.updatedAt,
    })) {
      if (!latest || latest.connectionState === "disconnected" || latest.credentialRef !== expectedCredentialRef) throw new SocialPublishingError("account_not_connected", 409);
    }
    return { id: account.publicId, authorizationState: latest.authorizationState, expiresAt: latest.expiresAt?.toISOString() ?? null };
  }
  return { id: account.publicId, authorizationState: updated.authorizationState, expiresAt: updated.expiresAt?.toISOString() ?? null };
}

export async function setSocialPublishingPolicy(venueId: number, mode: SocialPublishingMode) {
  const actor = await requireSocialPublishingActor(venueId, "manage_policy");
  const now = new Date();
  const result = await db.transaction(async (tx) => {
    let [policy] = await tx.select().from(socialPublishingPolicies).where(eq(socialPublishingPolicies.venueId, venueId)).for("update").limit(1);
    if (!policy) {
      await tx.insert(socialPublishingPolicies).values({ venueId, mode: "review_before_post", revision: 1, updatedByUserId: actor.userId }).onConflictDoNothing({ target: socialPublishingPolicies.venueId });
      [policy] = await tx.select().from(socialPublishingPolicies).where(eq(socialPublishingPolicies.venueId, venueId)).for("update").limit(1);
    }
    if (!policy) throw new SocialPublishingError("internal_failure", 500);
    const [updated] = await tx.update(socialPublishingPolicies).set({ mode, revision: policy.revision + 1, updatedByUserId: actor.userId, updatedAt: now }).where(eq(socialPublishingPolicies.id, policy.id)).returning();
    if (mode === "disabled") {
      await tx.update(socialPublications)
        .set({ state: "cancelled", lastFailureCode: "policy_denied", updatedAt: now })
        .where(and(eq(socialPublications.venueId, venueId), inArray(socialPublications.state, ["queued", "waiting_for_review"])));
      await tx.update(socialDistributionRequests)
        .set({ state: "cancelled", completedAt: now, updatedAt: now })
        .where(and(eq(socialDistributionRequests.venueId, venueId), inArray(socialDistributionRequests.state, ["queued", "pending_review"])));
    }
    await tx.insert(auditLogs).values({ actorClerkUserId: actor.clerkUserId, actorRole: actor.role, entityType: "social_publishing_policy", entityId: String(venueId), action: "policy_changed", previousValuesJson: JSON.stringify({ mode: policy.mode, revision: policy.revision }), nextValuesJson: JSON.stringify({ mode, revision: updated.revision }), metadataJson: JSON.stringify({ venueId }) });
    return updated;
  });
  return { mode: result.mode, revision: result.revision, updatedAt: result.updatedAt.toISOString() };
}

export async function createSocialDistributionRequest(input: {
  venueId: number;
  hotReelPublicId: string;
  accountPublicIds: string[];
  idempotencyKey: string;
  caption?: string;
}) {
  const actor = await requireSocialPublishingActor(input.venueId, "publish");
  const accountPublicIds = [...new Set(input.accountPublicIds)];
  const caption = input.caption ?? "";
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(input.idempotencyKey) || !/^[A-Za-z0-9_-]{8,80}$/.test(input.hotReelPublicId) || accountPublicIds.length < 1 || accountPublicIds.length > MAX_DESTINATIONS || accountPublicIds.some((id) => typeof id !== "string" || id.length > 128) || caption.length > MAX_CAPTION_LENGTH) {
    throw new SocialPublishingError("invalid_request", 400);
  }

  const provider = getSocialPublishingProvider();
  if (!isSocialProviderAllowed(provider.providerKey)) throw new SocialPublishingError("provider_not_configured", 503);
  if (!provider.isConfigured()) throw new SocialPublishingError("provider_not_configured", 503);
  const fingerprint = distributionRequestFingerprint({ hotReelPublicId: input.hotReelPublicId, accountPublicIds, caption });
  const now = new Date();

  const requestPublicId = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(socialDistributionRequests).where(and(eq(socialDistributionRequests.venueId, input.venueId), eq(socialDistributionRequests.idempotencyKey, input.idempotencyKey))).limit(1);
    if (existing) {
      if (existing.requestFingerprint !== fingerprint) throw new SocialPublishingError("idempotency_conflict", 409);
      return existing.publicId;
    }

    const [storedPolicy] = await tx.select().from(socialPublishingPolicies).where(eq(socialPublishingPolicies.venueId, input.venueId)).for("update").limit(1);
    let policy = storedPolicy;
    if (!policy) {
      [policy] = await tx.insert(socialPublishingPolicies).values({ venueId: input.venueId, mode: "review_before_post", revision: 1 }).onConflictDoNothing({ target: socialPublishingPolicies.venueId }).returning();
      if (!policy) {
        [policy] = await tx.select().from(socialPublishingPolicies).where(eq(socialPublishingPolicies.venueId, input.venueId)).for("update").limit(1);
      }
    }
    if (!policy || policy.mode === "disabled") throw new SocialPublishingError("policy_disabled", 409);

    const [reel] = await tx.select({
      id: hotReels.id,
      publicId: hotReels.publicId,
      lifecycleState: hotReels.lifecycleState,
      reviewState: hotReels.reviewState,
      expiresAt: hotReels.expiresAt,
      deletedAt: hotReels.deletedAt,
      deviceLifecycleState: nightlyDevices.lifecycleState,
      serviceEntitlementState: nightlyDevices.serviceEntitlementState,
      serviceSuspendedAt: nightlyDevices.serviceSuspendedAt,
      contentEligibility: nightlyDevices.contentEligibility,
      hotReelEligible: nightlyDevices.hotReelEligible,
      publicPublishingEnabled: nightlyDevices.publicPublishingEnabled,
      privacyMode: nightlyDevices.privacyMode,
    }).from(hotReels).innerJoin(nightlyDevices, eq(hotReels.deviceId, nightlyDevices.id)).where(and(eq(hotReels.publicId, input.hotReelPublicId), eq(hotReels.venueId, input.venueId), eq(nightlyDevices.venueId, input.venueId))).limit(1);
    if (!reel || !eligible({
      reelState: reel.lifecycleState,
      reelReviewState: reel.reviewState,
      reelExpiresAt: reel.expiresAt,
      reelDeletedAt: reel.deletedAt,
      deviceLifecycleState: reel.deviceLifecycleState,
      serviceEntitlementState: reel.serviceEntitlementState,
      serviceSuspendedAt: reel.serviceSuspendedAt,
      contentEligibility: reel.contentEligibility,
      hotReelEligible: reel.hotReelEligible,
      publicPublishingEnabled: reel.publicPublishingEnabled,
      privacyMode: reel.privacyMode,
    }, now.getTime())) throw new SocialPublishingError("media_not_eligible", 409);

    const accounts = await tx.select().from(socialPlatformAccounts).where(and(eq(socialPlatformAccounts.venueId, input.venueId), inArray(socialPlatformAccounts.publicId, accountPublicIds)));
    if (accounts.length !== accountPublicIds.length) throw new SocialPublishingError("not_found", 404);
    const capabilitiesRequired = ["can_upload_video", "can_publish_video", "can_idempotently_publish"];
    for (const account of accounts) {
      if (account.connectionState !== "connected" || account.authorizationState !== "valid" || account.reconnectRequired || !account.credentialRef || (account.expiresAt && account.expiresAt.getTime() <= now.getTime())) {
        throw new SocialPublishingError("account_not_connected", 409);
      }
      const declared = new Set(parseStringArray(account.capabilitiesJson));
      const available = provider.getCapabilities(account.platform);
      if (capabilitiesRequired.some((capability) => !declared.has(capability) || !available.has(capability as never))) {
        throw new SocialPublishingError("unsupported_capability", 409);
      }
    }

    const startState = destinationStartState(policy.mode);
    if (!startState) throw new SocialPublishingError("policy_disabled", 409);
    const publicId = randomUUID();
    const [created] = await tx.insert(socialDistributionRequests).values({
      publicId,
      hotReelId: reel.id,
      venueId: input.venueId,
      actorUserId: actor.userId,
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: fingerprint,
      policyModeSnapshot: policy.mode,
      policyRevisionSnapshot: policy.revision,
      state: policy.mode === "review_before_post" ? "pending_review" : "queued",
      caption,
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing({ target: [socialDistributionRequests.venueId, socialDistributionRequests.idempotencyKey] }).returning({ id: socialDistributionRequests.id, publicId: socialDistributionRequests.publicId });

    if (!created) {
      const [concurrent] = await tx.select().from(socialDistributionRequests).where(and(eq(socialDistributionRequests.venueId, input.venueId), eq(socialDistributionRequests.idempotencyKey, input.idempotencyKey))).limit(1);
      if (!concurrent || concurrent.requestFingerprint !== fingerprint) throw new SocialPublishingError("idempotency_conflict", 409);
      return concurrent.publicId;
    }

    await tx.insert(socialPublications).values(accounts.map((account) => ({
      publicId: randomUUID(),
      requestId: created.id,
      hotReelId: reel.id,
      venueId: input.venueId,
      accountId: account.id,
      actorUserId: actor.userId,
      platform: account.platform,
      policyModeSnapshot: policy.mode,
      state: startState,
      providerKey: provider.providerKey,
      providerIdempotencyKey: `social:${created.publicId}:${account.publicId}`,
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      createdAt: now,
      updatedAt: now,
    })));

    await tx.insert(auditLogs).values({ actorClerkUserId: actor.clerkUserId, actorRole: actor.role, entityType: "social_distribution_request", entityId: created.publicId, action: "publication_requested", nextValuesJson: JSON.stringify({ hotReelId: reel.id, destinations: accounts.map((account) => ({ accountId: account.publicId, platform: account.platform })), policyMode: policy.mode, policyRevision: policy.revision }), metadataJson: JSON.stringify({ venueId: input.venueId }) });
    return created.publicId;
  });

  return getSocialDistribution(input.venueId, requestPublicId);
}

export async function reviewSocialDistribution(input: { venueId: number; requestPublicId: string; decision: "approve" | "reject" }) {
  const actor = await requireSocialPublishingActor(input.venueId, "review");
  const now = new Date();
  await db.transaction(async (tx) => {
    const [request] = await tx.select().from(socialDistributionRequests).where(and(eq(socialDistributionRequests.venueId, input.venueId), eq(socialDistributionRequests.publicId, input.requestPublicId))).for("update").limit(1);
    if (!request) throw new SocialPublishingError("not_found", 404);
    if (request.state !== "pending_review") throw new SocialPublishingError("invalid_request", 409);
    const [policy] = await tx.select().from(socialPublishingPolicies).where(eq(socialPublishingPolicies.venueId, input.venueId)).for("update").limit(1);
    const approve = input.decision === "approve" && policy?.mode !== "disabled";
    const nextState = approve ? "queued" : "cancelled";
    const selectedDestinations = await tx.select({ publicId: socialPlatformAccounts.publicId, platform: socialPlatformAccounts.platform })
      .from(socialPublications)
      .innerJoin(socialPlatformAccounts, eq(socialPublications.accountId, socialPlatformAccounts.id))
      .where(and(eq(socialPublications.requestId, request.id), eq(socialPublications.venueId, input.venueId)));
    await tx.update(socialDistributionRequests).set({ state: nextState, reviewedByUserId: actor.userId, reviewedAt: now, completedAt: approve ? null : now, updatedAt: now }).where(eq(socialDistributionRequests.id, request.id));
    await tx.update(socialPublications).set({ state: approve ? "queued" : "cancelled", lastFailureCode: approve ? null : "policy_denied", updatedAt: now }).where(and(eq(socialPublications.requestId, request.id), eq(socialPublications.state, "waiting_for_review")));
    await tx.insert(auditLogs).values({ actorClerkUserId: actor.clerkUserId, actorRole: actor.role, entityType: "social_distribution_request", entityId: request.publicId, action: approve ? "review_approved" : "review_rejected", nextValuesJson: JSON.stringify({ state: nextState, venueId: input.venueId, hotReelId: request.hotReelId, destinations: selectedDestinations }), metadataJson: JSON.stringify({ policyModeSnapshot: request.policyModeSnapshot, policyRevisionSnapshot: request.policyRevisionSnapshot }) });
  });
  return getSocialDistribution(input.venueId, input.requestPublicId);
}

export async function retrySocialDestination(input: { venueId: number; destinationPublicId: string }) {
  const actor = await requireSocialPublishingActor(input.venueId, "retry");
  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const [destination] = await tx.select().from(socialPublications).where(and(
      eq(socialPublications.venueId, input.venueId),
      eq(socialPublications.publicId, input.destinationPublicId),
    )).for("update").limit(1);
    if (!destination) throw new SocialPublishingError("not_found", 404);
    if (!canManuallyRetryDestination({ state: destination.state, attempts: destination.attempts, maxAttempts: destination.maxAttempts, nextRetryAt: destination.nextRetryAt, now })) {
      throw new SocialPublishingError("invalid_request", 409);
    }
    const [policy] = await tx.select().from(socialPublishingPolicies).where(eq(socialPublishingPolicies.venueId, input.venueId)).for("update").limit(1);
    if (policy?.mode === "disabled") throw new SocialPublishingError("policy_disabled", 409);
    const [account] = await tx.select().from(socialPlatformAccounts).where(and(
      eq(socialPlatformAccounts.id, destination.accountId),
      eq(socialPlatformAccounts.venueId, input.venueId),
    )).limit(1);
    if (!account || account.connectionState !== "connected" || account.authorizationState !== "valid" || account.reconnectRequired || !account.credentialRef || (account.expiresAt && account.expiresAt <= now)) {
      throw new SocialPublishingError("account_not_connected", 409);
    }
    const [media] = await tx.select({
      reel: hotReels,
      deviceLifecycleState: nightlyDevices.lifecycleState,
      serviceEntitlementState: nightlyDevices.serviceEntitlementState,
      serviceSuspendedAt: nightlyDevices.serviceSuspendedAt,
      contentEligibility: nightlyDevices.contentEligibility,
      hotReelEligible: nightlyDevices.hotReelEligible,
      publicPublishingEnabled: nightlyDevices.publicPublishingEnabled,
      privacyMode: nightlyDevices.privacyMode,
    }).from(hotReels)
      .innerJoin(nightlyDevices, eq(hotReels.deviceId, nightlyDevices.id))
      .where(and(eq(hotReels.id, destination.hotReelId), eq(hotReels.venueId, input.venueId), eq(nightlyDevices.venueId, input.venueId)))
      .limit(1);
    if (!media || !eligible({
      reelState: media.reel.lifecycleState,
      reelReviewState: media.reel.reviewState,
      reelExpiresAt: media.reel.expiresAt,
      reelDeletedAt: media.reel.deletedAt,
      deviceLifecycleState: media.deviceLifecycleState,
      serviceEntitlementState: media.serviceEntitlementState,
      serviceSuspendedAt: media.serviceSuspendedAt,
      contentEligibility: media.contentEligibility,
      hotReelEligible: media.hotReelEligible,
      publicPublishingEnabled: media.publicPublishingEnabled,
      privacyMode: media.privacyMode,
    }, now.getTime())) throw new SocialPublishingError("media_not_eligible", 409);

    const [updated] = await tx.update(socialPublications).set({ state: "queued", nextRetryAt: null, lastFailureCode: null, updatedAt: now }).where(and(
      eq(socialPublications.id, destination.id),
      eq(socialPublications.venueId, input.venueId),
      eq(socialPublications.state, "failed_retryable"),
      eq(socialPublications.attempts, destination.attempts),
      eq(socialPublications.maxAttempts, destination.maxAttempts),
      or(isNull(socialPublications.nextRetryAt), lte(socialPublications.nextRetryAt, now)),
      lt(socialPublications.attempts, socialPublications.maxAttempts),
    )).returning({ publicId: socialPublications.publicId, requestId: socialPublications.requestId });
    if (!updated) throw new SocialPublishingError("invalid_request", 409);
    await tx.insert(auditLogs).values({ actorClerkUserId: actor.clerkUserId, actorRole: actor.role, entityType: "social_publication", entityId: destination.publicId, action: "retry_scheduled", nextValuesJson: JSON.stringify({ state: "queued", hotReelId: media.reel.id }), metadataJson: JSON.stringify({ venueId: input.venueId }) });
    await refreshRequestStateInTransaction(tx, updated.requestId, now);
    return updated;
  });
  return { id: result.publicId, state: "queued" };
}

async function claimDestination(destinationId?: number) {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - 5 * 60_000);
  const available = or(
    eq(socialPublications.state, "queued"),
    and(eq(socialPublications.state, "failed_retryable"), or(isNull(socialPublications.nextRetryAt), lte(socialPublications.nextRetryAt, now))),
    and(inArray(socialPublications.state, ["authorized", "uploading"]), lte(socialPublications.updatedAt, staleBefore)),
  );
  const claimed = await db.transaction(async (tx) => {
    const [candidate] = await tx.select({ id: socialPublications.id, state: socialPublications.state, attempts: socialPublications.attempts })
      .from(socialPublications)
      .where(and(available, lt(socialPublications.attempts, socialPublications.maxAttempts), ...(destinationId ? [eq(socialPublications.id, destinationId)] : [])))
      .orderBy(asc(socialPublications.createdAt))
      .limit(1);
    if (!candidate) return null;
    const [claimedRow] = await tx.update(socialPublications).set({ state: "authorized", attempts: candidate.attempts + 1, statusChecks: 0, nextRetryAt: null, updatedAt: now })
      .where(and(eq(socialPublications.id, candidate.id), eq(socialPublications.state, candidate.state), eq(socialPublications.attempts, candidate.attempts)))
      .returning({ id: socialPublications.id, publicId: socialPublications.publicId, requestId: socialPublications.requestId, venueId: socialPublications.venueId, accountId: socialPublications.accountId, providerKey: socialPublications.providerKey, attempts: socialPublications.attempts, maxAttempts: socialPublications.maxAttempts, providerIdempotencyKey: socialPublications.providerIdempotencyKey });
    if (!claimedRow) return null;
    await tx.insert(auditLogs).values({ actorClerkUserId: "nightly-social-worker", actorRole: "system", entityType: "social_publication", entityId: claimedRow.publicId, action: "destination_started", nextValuesJson: JSON.stringify({ state: "authorized", attempt: claimedRow.attempts }), metadataJson: JSON.stringify({ venueId: claimedRow.venueId, provider: claimedRow.providerKey }) });
    await refreshRequestStateInTransaction(tx, claimedRow.requestId, now);
    return claimedRow;
  });
  if (claimed) {
    logger.info("social_destination_started", { venueId: claimed.venueId, destinationId: claimed.publicId, provider: claimed.providerKey, attempt: claimed.attempts });
  }
  return claimed ?? null;
}

function mapHotReel(row: typeof hotReels.$inferSelect): HotReelRecord {
  const parseMetadata = () => {
    try {
      const value: unknown = JSON.parse(row.metadataJson);
      return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
    } catch {
      return {};
    }
  };
  return {
    id: String(row.id), publicId: row.publicId, hotMomentId: row.hotMomentId, venueId: row.venueId,
    deviceId: row.deviceId, sourceId: row.sourceId, sessionId: row.sessionId,
    lifecycleState: row.lifecycleState as HotReelRecord["lifecycleState"],
    publicationState: row.publicationState as HotReelRecord["publicationState"],
    reviewState: row.reviewState as HotReelRecord["reviewState"], providerKey: row.providerKey,
    providerObjectKey: row.providerObjectKey, providerObjectVersion: row.providerObjectVersion,
    contentHash: row.contentHash, contentBytes: row.contentBytes, contentType: row.contentType,
    durationMs: row.durationMs, capturedAt: row.capturedAt?.getTime() ?? null,
    uploadedAt: row.uploadedAt?.getTime() ?? null, finalizedAt: row.finalizedAt?.getTime() ?? null,
    expiresAt: row.expiresAt?.getTime() ?? null, deletedAt: row.deletedAt?.getTime() ?? null,
    failureCode: row.failureCode, failureReason: row.failureReason, metadata: parseMetadata(),
    createdAt: row.createdAt.getTime(), updatedAt: row.updatedAt.getTime(),
  };
}

function providerRecord(destination: typeof socialPublications.$inferSelect, request: typeof socialDistributionRequests.$inferSelect, hotReelPublicId: string): SocialPublicationRecord {
  return {
    id: destination.publicId, entityType: "hot_reel", entityId: hotReelPublicId, venueId: destination.venueId,
    actorUserId: destination.actorUserId, platform: destination.platform, lifecycleState: "queued",
    publicationState: "scheduled", reviewState: "approved", contentText: request.caption,
    providerKey: destination.providerKey, providerPostId: destination.providerPublicationId,
    providerUrl: destination.providerUrl, publishedAt: destination.publishedAt?.getTime() ?? null,
    revokedAt: destination.revokedAt?.getTime() ?? null, createdAt: destination.createdAt.getTime(), updatedAt: destination.updatedAt.getTime(),
  };
}

type SocialPublishingTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function refreshRequestStateInTransaction(tx: SocialPublishingTransaction, requestId: number, now: Date) {
  const [request] = await tx.select({ id: socialDistributionRequests.id })
    .from(socialDistributionRequests)
    .where(eq(socialDistributionRequests.id, requestId))
    .for("update")
    .limit(1);
  if (!request) return;
  const rows = await tx.select({ state: socialPublications.state }).from(socialPublications).where(eq(socialPublications.requestId, requestId));
  const states = rows.map((row) => row.state);
  if (states.length === 0) return;
  const nextState = aggregateDistributionState(states);
  const active = states.some((state) => ["queued", "waiting_for_review", "authorized", "uploading", "processing", "failed_retryable", "revoke_requested"].includes(state));
  await tx.update(socialDistributionRequests).set({ state: nextState, completedAt: active ? null : now, updatedAt: now }).where(eq(socialDistributionRequests.id, requestId));
}

async function failClaimedDestination(input: { id: number; venueId: number; accountId: number; providerKey: string; attempts: number; maxAttempts: number; providerIdempotencyKey: string }, error: unknown) {
  const codeValue = error instanceof SocialProviderError ? error.code : error instanceof Error && error.name === "AbortError" ? "provider_timeout" : "internal_failure";
  const code = SAFE_PROVIDER_FAILURES.has(codeValue) ? codeValue : "internal_failure";
  const retryable = error instanceof SocialProviderError ? error.retryable : code === "provider_timeout" || code === "internal_failure";
  const canRetry = retryable && input.attempts < input.maxAttempts && !["authorization_expired", "authorization_revoked", "unsupported_capability", "policy_denied", "invalid_media", "media_not_eligible", "account_disconnected", "permanent_provider_rejection"].includes(code);
  const nextRetryAt = canRetry ? new Date(Date.now() + retryDelayMs(input.attempts, input.providerIdempotencyKey)) : null;
  const now = new Date();
  const destination = await db.transaction(async (tx) => {
    const [updated] = await tx.update(socialPublications).set({ state: canRetry ? "failed_retryable" : "failed_permanent", lastFailureCode: code, nextRetryAt, updatedAt: now }).where(and(
      eq(socialPublications.id, input.id),
      eq(socialPublications.attempts, input.attempts),
      inArray(socialPublications.state, ["authorized", "uploading", "processing"]),
    )).returning({ requestId: socialPublications.requestId, publicId: socialPublications.publicId });
    if (!updated) return null;
    if (code === "authorization_expired" || code === "authorization_revoked" || code === "account_disconnected") {
      const [invalidated] = await tx.update(socialPlatformAccounts).set({
        connectionState: code === "account_disconnected" ? "disconnected" : "verification_failed",
        authorizationState: code === "authorization_revoked" ? "revoked" : code === "authorization_expired" ? "expired" : "reconnect_required",
        reconnectRequired: true,
        updatedAt: now,
      }).where(and(
        eq(socialPlatformAccounts.id, input.accountId),
        eq(socialPlatformAccounts.venueId, input.venueId),
        eq(socialPlatformAccounts.connectionState, "connected"),
        eq(socialPlatformAccounts.authorizationState, "valid"),
      )).returning({ id: socialPlatformAccounts.id });
      if (invalidated) {
        await tx.insert(auditLogs).values({ actorClerkUserId: "nightly-social-worker", actorRole: "system", entityType: "social_platform_account", entityId: String(input.accountId), action: "social_authorization_expired", nextValuesJson: JSON.stringify({ authorizationState: code === "authorization_revoked" ? "revoked" : "reconnect_required", reconnectRequired: true }), metadataJson: JSON.stringify({ venueId: input.venueId, failureCode: code }) });
      }
    }
    await tx.insert(auditLogs).values({ actorClerkUserId: "nightly-social-worker", actorRole: "system", entityType: "social_publication", entityId: updated.publicId, action: canRetry ? "retry_scheduled" : "destination_failed", nextValuesJson: JSON.stringify({ state: canRetry ? "failed_retryable" : "failed_permanent", failureCode: code, nextRetryAt: nextRetryAt?.toISOString() ?? null }), metadataJson: JSON.stringify({ venueId: input.venueId, provider: input.providerKey, attempt: input.attempts }) });
    await refreshRequestStateInTransaction(tx, updated.requestId, now);
    return updated;
  });
  logger.warn("social_destination_failed", { venueId: input.venueId, destinationId: destination?.publicId, provider: input.providerKey, attempt: input.attempts, failureCode: code, retryable: canRetry });
  return { state: canRetry ? "failed_retryable" : "failed_permanent", failureCode: code, nextRetryAt: nextRetryAt?.toISOString() ?? null };
}

async function finalizePublished(input: { id: number; attempts: number; venueId: number; providerKey: string; providerPublicationId: string; providerUrl: string | null }) {
  const now = new Date();
  const providerPublicationId = safeProviderPublicationId(input.providerPublicationId);
  const providerUrl = safeProviderUrl(input.providerUrl);
  const result = await db.transaction(async (tx) => {
    const [current] = await tx.select({ id: socialPublications.id, publicId: socialPublications.publicId, requestId: socialPublications.requestId, state: socialPublications.state, attempts: socialPublications.attempts })
      .from(socialPublications)
      .where(eq(socialPublications.id, input.id))
      .for("update")
      .limit(1);
    if (!current) throw new SocialPublishingError("internal_failure", 500);
    if (current.state === "published") return { ...current, changed: false };
    if (current.attempts !== input.attempts || !canApplyPublishResult(current.state)) return { ...current, changed: false };
    const [updated] = await tx.update(socialPublications).set({ state: "published", providerPublicationId, providerUrl, publishedAt: now, lastFailureCode: null, nextRetryAt: null, updatedAt: now }).where(and(
      eq(socialPublications.id, input.id),
      eq(socialPublications.attempts, input.attempts),
      inArray(socialPublications.state, ["authorized", "uploading", "processing", "failed_retryable"]),
    )).returning({ requestId: socialPublications.requestId, publicId: socialPublications.publicId, state: socialPublications.state });
    if (!updated) throw new SocialPublishingError("internal_failure", 500);
    await tx.insert(auditLogs).values({ actorClerkUserId: "nightly-social-worker", actorRole: "system", entityType: "social_publication", entityId: updated.publicId, action: "destination_published", nextValuesJson: JSON.stringify({ providerPublicationId, publicUrl: providerUrl, publishedAt: now.toISOString() }), metadataJson: JSON.stringify({ venueId: input.venueId, provider: input.providerKey }) });
    await refreshRequestStateInTransaction(tx, updated.requestId, now);
    return { ...updated, changed: true };
  });
  if (result.changed) {
    logger.info("social_destination_published", { venueId: input.venueId, destinationId: result.publicId, provider: input.providerKey });
  }
  return { id: result.publicId, state: result.state, publishedAt: now.toISOString(), publicUrl: providerUrl };
}

async function cancelClaimedDestination(input: { id: number; venueId: number; providerKey: string }, reason: "policy_denied" | "authorization_revoked" | "feature_disabled" | "account_disconnected" | "media_not_eligible") {
  const now = new Date();
  const destination = await db.transaction(async (tx) => {
    const [updated] = await tx.update(socialPublications).set({ state: "cancelled", lastFailureCode: reason, nextRetryAt: null, updatedAt: now })
      .where(and(eq(socialPublications.id, input.id), or(
        inArray(socialPublications.state, ["authorized", "uploading"]),
        and(eq(socialPublications.state, "processing"), isNull(socialPublications.providerPublicationId)),
      )))
      .returning({ requestId: socialPublications.requestId, publicId: socialPublications.publicId });
    if (!updated) return null;
    await tx.insert(auditLogs).values({ actorClerkUserId: "nightly-social-worker", actorRole: "system", entityType: "social_publication", entityId: updated.publicId, action: "destination_cancelled", nextValuesJson: JSON.stringify({ state: "cancelled", failureCode: reason }), metadataJson: JSON.stringify({ venueId: input.venueId, provider: input.providerKey }) });
    await refreshRequestStateInTransaction(tx, updated.requestId, now);
    return updated;
  });
  if (!destination) return { state: "cancelled" };
  return { id: destination.publicId, state: "cancelled" };
}

async function beginProviderCreate(input: { id: number; attempts: number; venueId: number; authorityUserId: number; accountId: number; credentialRef: string; hotReelId: number; providerKey: string }) {
  const now = new Date();
  return db.transaction(async (tx) => {
    const [flag] = await tx.select().from(platformFeatureFlags).where(eq(platformFeatureFlags.key, "feature.social_publishing")).limit(1);
    if (!flag) return { started: false as const, reason: "feature_disabled" as const };
    const overrides = await tx.select({ scope: platformFeatureFlagOverrides.scope, scopeValue: platformFeatureFlagOverrides.scopeValue, enabled: platformFeatureFlagOverrides.enabled })
      .from(platformFeatureFlagOverrides)
      .where(and(eq(platformFeatureFlagOverrides.flagId, flag.id), inArray(platformFeatureFlagOverrides.scopeValue, [String(input.venueId), "owner"])));
    const featureState = evaluateFlagState({
      key: flag.key,
      enabled: flag.enabled,
      killSwitch: flag.killSwitch,
      rolloutPercentage: flag.rolloutPercentage,
      overrides,
      context: { role: "owner", venueId: String(input.venueId) },
    });
    if (!featureState.enabled) return { started: false as const, reason: "feature_disabled" as const };
    const [policy] = await tx.select({ mode: socialPublishingPolicies.mode })
      .from(socialPublishingPolicies)
      .where(eq(socialPublishingPolicies.venueId, input.venueId))
      .for("update")
      .limit(1);
    if (policy?.mode === "disabled") return { started: false as const, reason: "policy_denied" as const };
    const [authority] = await tx.select({ id: users.id })
      .from(users)
      .innerJoin(venueMembers, and(eq(venueMembers.clerkUserId, users.clerkUserId), eq(venueMembers.venueId, input.venueId), eq(venueMembers.role, "owner")))
      .where(and(eq(users.id, input.authorityUserId), eq(users.accountStatus, "active")))
      .for("update")
      .limit(1);
    if (!authority) return { started: false as const, reason: "authorization_revoked" as const };
    const [account] = await tx.select({
      connectionState: socialPlatformAccounts.connectionState,
      authorizationState: socialPlatformAccounts.authorizationState,
      reconnectRequired: socialPlatformAccounts.reconnectRequired,
      credentialRef: socialPlatformAccounts.credentialRef,
      expiresAt: socialPlatformAccounts.expiresAt,
    }).from(socialPlatformAccounts).where(and(
      eq(socialPlatformAccounts.id, input.accountId),
      eq(socialPlatformAccounts.venueId, input.venueId),
    )).for("update").limit(1);
    if (!account || account.credentialRef !== input.credentialRef || account.connectionState !== "connected" || account.authorizationState !== "valid" || account.reconnectRequired || (account.expiresAt && account.expiresAt <= now)) {
      return { started: false as const, reason: "account_disconnected" as const };
    }
    const [media] = await tx.select({
      reelState: hotReels.lifecycleState,
      reelReviewState: hotReels.reviewState,
      reelExpiresAt: hotReels.expiresAt,
      reelDeletedAt: hotReels.deletedAt,
      deviceLifecycleState: nightlyDevices.lifecycleState,
      serviceEntitlementState: nightlyDevices.serviceEntitlementState,
      serviceSuspendedAt: nightlyDevices.serviceSuspendedAt,
      contentEligibility: nightlyDevices.contentEligibility,
      hotReelEligible: nightlyDevices.hotReelEligible,
      publicPublishingEnabled: nightlyDevices.publicPublishingEnabled,
      privacyMode: nightlyDevices.privacyMode,
    }).from(hotReels)
      .innerJoin(nightlyDevices, eq(hotReels.deviceId, nightlyDevices.id))
      .where(and(eq(hotReels.id, input.hotReelId), eq(hotReels.venueId, input.venueId), eq(nightlyDevices.venueId, input.venueId)))
      .for("update")
      .limit(1);
    if (!media || !eligible({
      reelState: media.reelState,
      reelReviewState: media.reelReviewState,
      reelExpiresAt: media.reelExpiresAt,
      reelDeletedAt: media.reelDeletedAt,
      deviceLifecycleState: media.deviceLifecycleState,
      serviceEntitlementState: media.serviceEntitlementState,
      serviceSuspendedAt: media.serviceSuspendedAt,
      contentEligibility: media.contentEligibility,
      hotReelEligible: media.hotReelEligible,
      publicPublishingEnabled: media.publicPublishingEnabled,
      privacyMode: media.privacyMode,
    }, now.getTime())) return { started: false as const, reason: "media_not_eligible" as const };
    const [started] = await tx.update(socialPublications).set({
      state: "processing",
      nextRetryAt: new Date(now.getTime() + 30_000),
      updatedAt: now,
    }).where(and(
      eq(socialPublications.id, input.id),
      eq(socialPublications.venueId, input.venueId),
      eq(socialPublications.state, "uploading"),
      eq(socialPublications.attempts, input.attempts),
    )).returning({ requestId: socialPublications.requestId, publicId: socialPublications.publicId });
    if (!started) return { started: false as const, reason: "state_changed" as const };
    await tx.insert(auditLogs).values({
      actorClerkUserId: "nightly-social-worker",
      actorRole: "system",
      entityType: "social_publication",
      entityId: started.publicId,
      action: "provider_create_started",
      nextValuesJson: JSON.stringify({ state: "processing", remoteIdKnown: false }),
      metadataJson: JSON.stringify({ venueId: input.venueId, provider: input.providerKey, attempt: input.attempts }),
    });
    await refreshRequestStateInTransaction(tx, started.requestId, now);
    return { started: true as const, ...started };
  });
}

async function markDestinationProcessing(input: { id: number; attempts: number; venueId: number; providerKey: string; providerPublicationId: string; providerUrl: string | null }) {
  const now = new Date();
  const nextRetryAt = new Date(now.getTime() + 30_000);
  const providerPublicationId = safeProviderPublicationId(input.providerPublicationId);
  const providerUrl = safeProviderUrl(input.providerUrl);
  const result = await db.transaction(async (tx) => {
    const [current] = await tx.select({ id: socialPublications.id, publicId: socialPublications.publicId, requestId: socialPublications.requestId, state: socialPublications.state, attempts: socialPublications.attempts })
      .from(socialPublications)
      .where(eq(socialPublications.id, input.id))
      .for("update")
      .limit(1);
    if (!current) throw new SocialPublishingError("internal_failure", 500);
    if (current.attempts !== input.attempts || !canApplyPublishResult(current.state)) return { ...current, changed: false };
    const [updated] = await tx.update(socialPublications).set({
      state: "processing",
      providerPublicationId,
      providerUrl,
      nextRetryAt,
      updatedAt: now,
    }).where(and(
      eq(socialPublications.id, input.id),
      eq(socialPublications.attempts, input.attempts),
      inArray(socialPublications.state, ["authorized", "uploading", "processing", "failed_retryable"]),
    )).returning({ requestId: socialPublications.requestId, publicId: socialPublications.publicId, state: socialPublications.state });
    if (!updated) throw new SocialPublishingError("internal_failure", 500);
    await tx.insert(auditLogs).values({ actorClerkUserId: "nightly-social-worker", actorRole: "system", entityType: "social_publication", entityId: updated.publicId, action: "destination_processing", nextValuesJson: JSON.stringify({ state: "processing", nextCheckAt: nextRetryAt.toISOString() }), metadataJson: JSON.stringify({ venueId: input.venueId, provider: input.providerKey }) });
    await refreshRequestStateInTransaction(tx, updated.requestId, now);
    return { ...updated, changed: true };
  });
  return { id: result.publicId, state: result.state, nextCheckAt: nextRetryAt.toISOString() };
}

async function claimProcessingDestination(destinationId?: number) {
  const now = new Date();
  const [candidate] = await db.select({ id: socialPublications.id, statusChecks: socialPublications.statusChecks })
    .from(socialPublications)
    .where(and(eq(socialPublications.state, "processing"), lte(socialPublications.nextRetryAt, now), lt(socialPublications.statusChecks, socialPublications.maxStatusChecks), ...(destinationId ? [eq(socialPublications.id, destinationId)] : [])))
    .orderBy(asc(socialPublications.nextRetryAt))
    .limit(1);
  if (!candidate) return null;
  return (await db.update(socialPublications).set({
    statusChecks: candidate.statusChecks + 1,
    nextRetryAt: new Date(now.getTime() + 30_000),
    updatedAt: now,
  }).where(and(eq(socialPublications.id, candidate.id), eq(socialPublications.state, "processing"), eq(socialPublications.statusChecks, candidate.statusChecks)))
    .returning({ id: socialPublications.id, publicId: socialPublications.publicId, venueId: socialPublications.venueId, accountId: socialPublications.accountId, providerKey: socialPublications.providerKey, providerPublicationId: socialPublications.providerPublicationId, attempts: socialPublications.attempts, maxAttempts: socialPublications.maxAttempts, statusChecks: socialPublications.statusChecks, maxStatusChecks: socialPublications.maxStatusChecks }))[0] ?? null;
}

async function inspectProcessingDestination(claimed: NonNullable<Awaited<ReturnType<typeof claimProcessingDestination>>>) {
  const [destination] = await db.select({ destination: socialPublications, account: socialPlatformAccounts })
    .from(socialPublications)
    .innerJoin(socialPlatformAccounts, eq(socialPublications.accountId, socialPlatformAccounts.id))
    .where(eq(socialPublications.id, claimed.id)).limit(1);
  if (!destination) return failClaimedDestination({ ...claimed, providerIdempotencyKey: "status-check" }, new SocialProviderError("internal_failure", false));
  const provider = getSocialPublishingProvider();
  const credential = destination.account.credentialRef ? await getSocialCredentialStore().get(destination.account.credentialRef) : null;
  if (!credential || destination.account.connectionState !== "connected" || destination.account.authorizationState !== "valid") {
    return failClaimedDestination({ ...claimed, providerIdempotencyKey: "status-check" }, new SocialProviderError("authorization_expired", false));
  }

  if (!destination.destination.providerPublicationId) {
    if (!provider.getCapabilities(destination.destination.platform).has("can_idempotently_publish") || !parseStringArray(destination.account.capabilitiesJson).includes("can_idempotently_publish")) {
      return failClaimedDestination({ ...claimed, providerIdempotencyKey: destination.destination.providerIdempotencyKey }, new SocialProviderError("unsupported_capability", false));
    }
    try {
      const recovered = await provider.findPublicationByIdempotencyKey({ idempotencyKey: destination.destination.providerIdempotencyKey, credential: credential.secret });
      if (recovered.state === "published" && recovered.providerPublicationId) {
        return finalizePublished({ id: claimed.id, attempts: claimed.attempts, venueId: claimed.venueId, providerKey: claimed.providerKey, providerPublicationId: recovered.providerPublicationId, providerUrl: recovered.providerUrl });
      }
      if (recovered.state === "processing" && recovered.providerPublicationId) {
        return markDestinationProcessing({ id: claimed.id, attempts: claimed.attempts, venueId: claimed.venueId, providerKey: claimed.providerKey, providerPublicationId: recovered.providerPublicationId, providerUrl: recovered.providerUrl });
      }
      if (recovered.state === "failed") {
        const failureCode = recovered.failureCode ?? "permanent_provider_rejection";
        const retryable = failureCode === "retryable_provider_error" || failureCode === "provider_timeout" || failureCode === "internal_failure";
        return failClaimedDestination({ ...claimed, providerIdempotencyKey: destination.destination.providerIdempotencyKey }, new SocialProviderError(failureCode, retryable));
      }
      if (claimed.attempts >= claimed.maxAttempts) {
        return failClaimedDestination({ ...claimed, providerIdempotencyKey: destination.destination.providerIdempotencyKey }, new SocialProviderError("provider_timeout", false));
      }
      const now = new Date();
      const requeued = await db.transaction(async (tx) => {
        const [updated] = await tx.update(socialPublications).set({ state: "queued", nextRetryAt: null, statusChecks: 0, updatedAt: now }).where(and(
          eq(socialPublications.id, claimed.id),
          eq(socialPublications.attempts, claimed.attempts),
          eq(socialPublications.state, "processing"),
          isNull(socialPublications.providerPublicationId),
        )).returning({ requestId: socialPublications.requestId, publicId: socialPublications.publicId });
        if (!updated) return null;
        await tx.insert(auditLogs).values({ actorClerkUserId: "nightly-social-worker", actorRole: "system", entityType: "social_publication", entityId: updated.publicId, action: "provider_create_requeued", nextValuesJson: JSON.stringify({ state: "queued", remoteResult: "unknown" }), metadataJson: JSON.stringify({ venueId: claimed.venueId, provider: claimed.providerKey, attempt: claimed.attempts }) });
        await refreshRequestStateInTransaction(tx, updated.requestId, now);
        return updated;
      });
      return { id: claimed.publicId, state: requeued ? "queued" : "processing" };
    } catch {
      return { id: claimed.publicId, state: "processing", nextCheckAt: new Date(Date.now() + 30_000).toISOString() };
    }
  }

  if (!provider.getCapabilities(destination.destination.platform).has("can_read_status") || !parseStringArray(destination.account.capabilitiesJson).includes("can_read_status")) {
    return failClaimedDestination({ ...claimed, providerIdempotencyKey: "status-check" }, new SocialProviderError("unsupported_capability", false));
  }

  try {
    const status = await provider.inspectPublication({ providerPublicationId: destination.destination.providerPublicationId, credential: credential.secret });
    if (status.state === "published" && status.providerPublicationId) {
      return finalizePublished({ id: claimed.id, attempts: claimed.attempts, venueId: claimed.venueId, providerKey: claimed.providerKey, providerPublicationId: status.providerPublicationId, providerUrl: status.providerUrl });
    }
    if (status.state === "failed") {
      const failureCode = status.failureCode ?? "permanent_provider_rejection";
      const retryable = failureCode === "retryable_provider_error" || failureCode === "provider_timeout" || failureCode === "internal_failure";
      return failClaimedDestination({ ...claimed, providerIdempotencyKey: "status-check" }, new SocialProviderError(failureCode, retryable));
    }
    if (claimed.statusChecks >= claimed.maxStatusChecks) {
      return failClaimedDestination({ ...claimed, providerIdempotencyKey: "status-check" }, new SocialProviderError("provider_timeout", false));
    }
    logger.info("social_destination_processing", { venueId: claimed.venueId, destinationId: claimed.publicId, provider: claimed.providerKey, statusCheck: claimed.statusChecks });
    return { id: claimed.publicId, state: "processing", nextCheckAt: new Date(Date.now() + 30_000).toISOString() };
  } catch {
    if (claimed.statusChecks >= claimed.maxStatusChecks) {
      return failClaimedDestination({ ...claimed, providerIdempotencyKey: "status-check" }, new SocialProviderError("provider_timeout", false));
    }
    return { id: claimed.publicId, state: "processing", nextCheckAt: new Date(Date.now() + 30_000).toISOString() };
  }
}

async function runNextProcessingDestination() {
  const claimed = await claimProcessingDestination();
  return claimed ? inspectProcessingDestination(claimed) : null;
}

export async function runNextSocialDestination() {
  const processingResult = await runNextProcessingDestination();
  if (processingResult) return processingResult;
  const claimed = await claimDestination();
  if (!claimed) return null;
  return executeClaimedDestination(claimed);
}

export async function runSocialDestination(destinationPublicId: string) {
  const [candidate] = await db.select({ id: socialPublications.id, state: socialPublications.state }).from(socialPublications).where(eq(socialPublications.publicId, destinationPublicId)).limit(1);
  if (!candidate) throw new SocialPublishingError("not_found", 404);
  if (candidate.state === "processing") {
    const processing = await claimProcessingDestination(candidate.id);
    if (!processing) throw new SocialPublishingError("invalid_request", 409);
    return inspectProcessingDestination(processing);
  }
  const claimed = await claimDestination(candidate.id);
  if (!claimed) throw new SocialPublishingError("invalid_request", 409);
  return executeClaimedDestination(claimed);
}

async function executeClaimedDestination(claimed: NonNullable<Awaited<ReturnType<typeof claimDestination>>>) {
  try {
    const [row] = await db.select({
      destination: socialPublications,
      request: socialDistributionRequests,
      account: socialPlatformAccounts,
      reel: hotReels,
      deviceLifecycleState: nightlyDevices.lifecycleState,
      serviceEntitlementState: nightlyDevices.serviceEntitlementState,
      serviceSuspendedAt: nightlyDevices.serviceSuspendedAt,
      contentEligibility: nightlyDevices.contentEligibility,
      hotReelEligible: nightlyDevices.hotReelEligible,
      publicPublishingEnabled: nightlyDevices.publicPublishingEnabled,
      privacyMode: nightlyDevices.privacyMode,
    }).from(socialPublications)
      .innerJoin(socialDistributionRequests, eq(socialPublications.requestId, socialDistributionRequests.id))
      .innerJoin(socialPlatformAccounts, eq(socialPublications.accountId, socialPlatformAccounts.id))
      .innerJoin(hotReels, eq(socialPublications.hotReelId, hotReels.id))
      .innerJoin(nightlyDevices, eq(hotReels.deviceId, nightlyDevices.id))
      .where(eq(socialPublications.id, claimed.id)).limit(1);
    if (!row) throw new SocialPublishingError("not_found", 404);
    const { destination, request, account, reel } = row;
    const actor = { userId: destination.actorUserId, role: "owner" as const, venueId: destination.venueId };

    const featureEnabled = await isFeatureEnabled("feature.social_publishing", { role: "owner", venueId: destination.venueId });
    if (!featureEnabled) return cancelClaimedDestination(claimed, "policy_denied");
    const authorityUserId = distributionAuthorityUserId({ actorUserId: request.actorUserId, reviewedByUserId: request.reviewedByUserId });
    const [authority] = await db.select({ userId: users.id, clerkUserId: users.clerkUserId, accountStatus: users.accountStatus, venueRole: venueMembers.role })
      .from(users)
      .leftJoin(venueMembers, and(eq(venueMembers.clerkUserId, users.clerkUserId), eq(venueMembers.venueId, destination.venueId)))
      .where(eq(users.id, authorityUserId))
      .limit(1);
    if (!authority || !mayManageSocialPublishing({ isActiveUser: authority.accountStatus === "active", venueMembershipRole: authority.venueRole ?? null, venueMatches: authority.venueRole === "owner" })) {
      return cancelClaimedDestination(claimed, "authorization_revoked");
    }
    const [currentPolicy] = await db.select().from(socialPublishingPolicies).where(eq(socialPublishingPolicies.venueId, destination.venueId)).limit(1);
    if (currentPolicy?.mode === "disabled") return cancelClaimedDestination(claimed, "policy_denied");
    if (!eligible({
      reelState: reel.lifecycleState, reelReviewState: reel.reviewState, reelExpiresAt: reel.expiresAt, reelDeletedAt: reel.deletedAt,
      deviceLifecycleState: row.deviceLifecycleState, serviceEntitlementState: row.serviceEntitlementState, serviceSuspendedAt: row.serviceSuspendedAt,
      contentEligibility: row.contentEligibility, hotReelEligible: row.hotReelEligible, publicPublishingEnabled: row.publicPublishingEnabled, privacyMode: row.privacyMode,
    })) throw new SocialProviderError("media_not_eligible", false);
    if (account.venueId !== destination.venueId || account.connectionState !== "connected" || account.authorizationState !== "valid" || account.reconnectRequired || !account.credentialRef || (account.expiresAt && account.expiresAt <= new Date())) {
      throw new SocialProviderError("account_disconnected", false);
    }

    const provider = getSocialPublishingProvider();
    const capabilities = provider.getCapabilities(account.platform);
    for (const capability of ["can_upload_video", "can_publish_video", "can_idempotently_publish"] as const) {
      if (!capabilities.has(capability) || !parseStringArray(account.capabilitiesJson).includes(capability)) throw new SocialProviderError("unsupported_capability", false);
    }
    const credential = await getSocialCredentialStore().get(account.credentialRef);
    if (!credential) throw new SocialProviderError("authorization_expired", false);
    const validation = await provider.validateConnection({ platform: account.platform, credential: credential.secret });
    if (!validation.valid || validation.reconnectRequired) throw new SocialProviderError("authorization_expired", false);

    const recovered = await provider.findPublicationByIdempotencyKey({ idempotencyKey: destination.providerIdempotencyKey, credential: credential.secret });
    if (recovered.state === "published" && recovered.providerPublicationId) {
      return finalizePublished({ id: destination.id, attempts: claimed.attempts, venueId: destination.venueId, providerKey: destination.providerKey, providerPublicationId: recovered.providerPublicationId, providerUrl: recovered.providerUrl });
    }
    if (recovered.state === "processing" && recovered.providerPublicationId) {
      return markDestinationProcessing({ id: destination.id, attempts: claimed.attempts, venueId: destination.venueId, providerKey: destination.providerKey, providerPublicationId: recovered.providerPublicationId, providerUrl: recovered.providerUrl });
    }
    if (recovered.state === "failed") throw new SocialProviderError(recovered.failureCode ?? "permanent_provider_rejection", false);

    const preparationFeatureEnabled = await isFeatureEnabled("feature.social_publishing", { role: "owner", venueId: destination.venueId });
    if (!preparationFeatureEnabled) return cancelClaimedDestination(claimed, "feature_disabled");
    const [preparationAuthority] = await db.select({ accountStatus: users.accountStatus, venueRole: venueMembers.role })
      .from(users)
      .leftJoin(venueMembers, and(eq(venueMembers.clerkUserId, users.clerkUserId), eq(venueMembers.venueId, destination.venueId)))
      .where(eq(users.id, authorityUserId))
      .limit(1);
    if (!preparationAuthority || !mayManageSocialPublishing({ isActiveUser: preparationAuthority.accountStatus === "active", venueMembershipRole: preparationAuthority.venueRole ?? null, venueMatches: preparationAuthority.venueRole === "owner" })) {
      return cancelClaimedDestination(claimed, "authorization_revoked");
    }
    const [preparationPolicy] = await db.select({ mode: socialPublishingPolicies.mode }).from(socialPublishingPolicies).where(eq(socialPublishingPolicies.venueId, destination.venueId)).limit(1);
    if (preparationPolicy?.mode === "disabled") return cancelClaimedDestination(claimed, "policy_denied");

    await db.update(socialPublications).set({ state: "uploading", updatedAt: new Date() }).where(and(eq(socialPublications.id, destination.id), eq(socialPublications.state, "authorized")));
    const hotReelProvider = getHotReelProvider();
    if (process.env.NODE_ENV === "production" && process.env.HOT_REEL_PROVIDER !== "vercel_blob") throw new SocialProviderError("internal_failure", false);
    const playback = await authorizeHotReelPlayback({
      record: mapHotReel(reel),
      actor,
      provider: hotReelProvider,
      expiresAt: Date.now() + 60_000,
    });
    if (!playback.allowed || !playback.url) throw new SocialProviderError("media_not_eligible", false);

    const preparation = await provider.preparePublication({
      platform: account.platform,
      accountPublicId: account.publicId,
      credential: credential.secret,
      mediaObjectRef: `hot_reel:${reel.publicId}:${reel.providerObjectVersion}`,
      caption: request.caption,
      idempotencyKey: destination.providerIdempotencyKey,
    });
    const upload = await provider.uploadMedia({ preparationId: preparation.preparationId, credential: credential.secret, mediaUrl: playback.url });

    const [latestPolicy] = await db.select({ mode: socialPublishingPolicies.mode }).from(socialPublishingPolicies).where(eq(socialPublishingPolicies.venueId, destination.venueId)).limit(1);
    if (latestPolicy?.mode === "disabled") return cancelClaimedDestination(claimed, "policy_denied");
    const latestFeatureEnabled = await isFeatureEnabled("feature.social_publishing", { role: "owner", venueId: destination.venueId });
    if (!latestFeatureEnabled) return cancelClaimedDestination(claimed, "feature_disabled");
    await loadEligibleReel(destination.venueId, reel.publicId);
    const [latestAccount] = await db.select({ connectionState: socialPlatformAccounts.connectionState, authorizationState: socialPlatformAccounts.authorizationState, reconnectRequired: socialPlatformAccounts.reconnectRequired })
      .from(socialPlatformAccounts)
      .where(and(eq(socialPlatformAccounts.id, account.id), eq(socialPlatformAccounts.venueId, destination.venueId)))
      .limit(1);
    if (!latestAccount || latestAccount.connectionState !== "connected" || latestAccount.authorizationState !== "valid" || latestAccount.reconnectRequired) throw new SocialProviderError("account_disconnected", false);
    const [currentAuthority] = await db.select({ clerkUserId: users.clerkUserId, accountStatus: users.accountStatus, venueRole: venueMembers.role })
      .from(users)
      .leftJoin(venueMembers, and(eq(venueMembers.clerkUserId, users.clerkUserId), eq(venueMembers.venueId, destination.venueId)))
      .where(eq(users.id, authorityUserId))
      .limit(1);
    if (!currentAuthority || !mayManageSocialPublishing({ isActiveUser: currentAuthority.accountStatus === "active", venueMembershipRole: currentAuthority.venueRole ?? null, venueMatches: currentAuthority.venueRole === "owner" })) {
      return cancelClaimedDestination(claimed, "authorization_revoked");
    }
    const providerCreateStarted = await beginProviderCreate({ id: destination.id, attempts: claimed.attempts, venueId: destination.venueId, authorityUserId, accountId: account.id, credentialRef: account.credentialRef, hotReelId: destination.hotReelId, providerKey: provider.providerKey });
    if (!providerCreateStarted.started) {
      if (providerCreateStarted.reason !== "state_changed") {
        return cancelClaimedDestination(claimed, providerCreateStarted.reason);
      }
      const [current] = await db.select({ state: socialPublications.state }).from(socialPublications).where(eq(socialPublications.id, destination.id)).limit(1);
      return { id: destination.publicId, state: current?.state ?? "cancelled" };
    }
    const socialRecord = providerRecord(destination, request, reel.publicId);
    const published = await provider.publish(socialRecord, { idempotencyKey: destination.providerIdempotencyKey, providerMediaId: upload.providerMediaId, credential: credential.secret });
    if (!published.ok || !published.providerPostId) throw new SocialProviderError("permanent_provider_rejection", false);
    const providerStatus = published.providerStatus.toLowerCase();
    if (["processing", "pending", "accepted", "queued"].includes(providerStatus)) {
      return markDestinationProcessing({ id: destination.id, attempts: claimed.attempts, venueId: destination.venueId, providerKey: provider.providerKey, providerPublicationId: published.providerPostId, providerUrl: published.providerUrl ?? null });
    }
    if (!["published", "ready", "complete", "completed", "success"].includes(providerStatus)) {
      throw new SocialProviderError("permanent_provider_rejection", false);
    }
    return finalizePublished({ id: destination.id, attempts: claimed.attempts, venueId: destination.venueId, providerKey: provider.providerKey, providerPublicationId: published.providerPostId, providerUrl: published.providerUrl ?? null });
  } catch (error) {
    return failClaimedDestination(claimed, error);
  }
}

export async function revokeSocialDestination(input: { venueId: number; destinationPublicId: string }) {
  const actor: AuthorizedSocialActor = await requireSocialPublishingActor(input.venueId, "revoke");
  let [destination] = await db.select().from(socialPublications).where(and(eq(socialPublications.publicId, input.destinationPublicId), eq(socialPublications.venueId, input.venueId))).limit(1);
  if (!destination) throw new SocialPublishingError("not_found", 404);
  if (destination.state === "revoked") return { id: destination.publicId, state: "revoked" };
  const cancellableStates = ["waiting_for_review", "queued", "failed_retryable", "authorized", "uploading"] as const;
  if (cancellableStates.includes(destination.state as (typeof cancellableStates)[number])) {
    const now = new Date();
    const cancelled = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(socialPublications).where(and(
        eq(socialPublications.id, destination.id),
        eq(socialPublications.venueId, input.venueId),
      )).for("update").limit(1);
      if (!current || !cancellableStates.includes(current.state as (typeof cancellableStates)[number])) return null;
      const [updated] = await tx.update(socialPublications).set({ state: "cancelled", lastFailureCode: "revoked_before_publish", nextRetryAt: null, updatedAt: now }).where(and(
        eq(socialPublications.id, current.id),
        eq(socialPublications.venueId, input.venueId),
        eq(socialPublications.state, current.state),
        eq(socialPublications.attempts, current.attempts),
      )).returning({ publicId: socialPublications.publicId, requestId: socialPublications.requestId });
      if (!updated) return null;
      await tx.insert(auditLogs).values({ actorClerkUserId: actor.clerkUserId, actorRole: actor.role, entityType: "social_publication", entityId: updated.publicId, action: "publication_cancelled", nextValuesJson: JSON.stringify({ state: "cancelled", reason: "revoked_before_publish" }), metadataJson: JSON.stringify({ venueId: input.venueId }) });
      await refreshRequestStateInTransaction(tx, updated.requestId, now);
      return updated;
    });
    if (cancelled) return { id: cancelled.publicId, state: "cancelled" };
    [destination] = await db.select().from(socialPublications).where(and(eq(socialPublications.publicId, input.destinationPublicId), eq(socialPublications.venueId, input.venueId))).limit(1);
    if (!destination) throw new SocialPublishingError("not_found", 404);
    if (destination.state === "revoked") return { id: destination.publicId, state: "revoked" };
  }
  if (destination.state === "cancelled") return { id: destination.publicId, state: "cancelled" };
  if (destination.state === "processing" && !destination.providerPublicationId) throw new SocialPublishingError("publishing_in_progress", 409);
  const providerPublicationId = destination.providerPublicationId;
  if (!( ["published", "processing", "revoke_requested"] as const).includes(destination.state as "published" | "processing" | "revoke_requested") || !providerPublicationId) throw new SocialPublishingError("invalid_request", 409);
  const provider = getSocialPublishingProvider();
  const capabilities = provider.getCapabilities(destination.platform);
  if (!capabilities.has("can_delete_publication") || !capabilities.has("can_idempotently_delete_publication")) throw new SocialPublishingError("unsupported_capability", 409);
  const [account] = await db.select().from(socialPlatformAccounts).where(and(eq(socialPlatformAccounts.id, destination.accountId), eq(socialPlatformAccounts.venueId, input.venueId))).limit(1);
  if (!account?.credentialRef || account.connectionState !== "connected" || account.authorizationState !== "valid") throw new SocialPublishingError("account_not_connected", 409);
  const credential = await getSocialCredentialStore().get(account.credentialRef);
  if (!credential) throw new SocialPublishingError("account_not_connected", 409);
  const revokeRequestedAt = new Date();
  if (destination.state !== "revoke_requested") {
    await db.transaction(async (tx) => {
      const [requested] = await tx.update(socialPublications).set({ state: "revoke_requested", updatedAt: revokeRequestedAt })
        .where(and(
          eq(socialPublications.id, destination.id),
          eq(socialPublications.state, destination.state),
          eq(socialPublications.providerPublicationId, providerPublicationId),
        ))
        .returning({ publicId: socialPublications.publicId, requestId: socialPublications.requestId });
      if (requested) {
        await tx.insert(auditLogs).values({ actorClerkUserId: actor.clerkUserId, actorRole: actor.role, entityType: "social_publication", entityId: requested.publicId, action: "revoke_requested", nextValuesJson: JSON.stringify({ state: "revoke_requested" }), metadataJson: JSON.stringify({ venueId: input.venueId, platform: destination.platform }) });
        await refreshRequestStateInTransaction(tx, requested.requestId, revokeRequestedAt);
      }
    });
    [destination] = await db.select().from(socialPublications).where(and(eq(socialPublications.publicId, input.destinationPublicId), eq(socialPublications.venueId, input.venueId))).limit(1);
    if (!destination || destination.state !== "revoke_requested" || destination.providerPublicationId !== providerPublicationId) {
      if (destination?.state === "revoked") return { id: destination.publicId, state: "revoked" };
      if (destination?.state === "published") return revokeSocialDestination(input);
      throw new SocialPublishingError("publishing_in_progress", 409);
    }
  }
  const request = (await db.select().from(socialDistributionRequests).where(eq(socialDistributionRequests.id, destination.requestId)).limit(1))[0];
  const [reel] = await db.select({ publicId: hotReels.publicId }).from(hotReels).where(eq(hotReels.id, destination.hotReelId)).limit(1);
  if (!request || !reel) throw new SocialPublishingError("not_found", 404);
  const revokeRecord = providerRecord(destination, request, reel.publicId);
  revokeRecord.providerPostId = providerPublicationId;
  const result = await provider.revoke(revokeRecord, { credential: credential.secret });
  if (!result.ok) throw new SocialPublishingError("permanent_provider_rejection", 502);
  const now = new Date();
  const revoked = await db.transaction(async (tx) => {
    const [updated] = await tx.update(socialPublications).set({ state: "revoked", revokedAt: now, updatedAt: now }).where(and(
      eq(socialPublications.id, destination.id),
      eq(socialPublications.venueId, input.venueId),
      eq(socialPublications.state, "revoke_requested"),
    )).returning({ publicId: socialPublications.publicId, requestId: socialPublications.requestId });
    if (!updated) return null;
    await tx.insert(auditLogs).values({ actorClerkUserId: actor.clerkUserId, actorRole: actor.role, entityType: "social_publication", entityId: updated.publicId, action: "publication_revoked", nextValuesJson: JSON.stringify({ state: "revoked" }), metadataJson: JSON.stringify({ venueId: input.venueId, provider: provider.providerKey }) });
    await refreshRequestStateInTransaction(tx, updated.requestId, now);
    return updated;
  });
  if (!revoked) return { id: destination.publicId, state: "revoked" };
  return { id: destination.publicId, state: "revoked" };
}
