import { createHash } from "node:crypto";

import type { SocialDestinationState, SocialPublishingMode } from "./types";

export function isSocialPublicationMediaEligible(input: {
  reelState: string;
  reelReviewState: string;
  reelExpiresAt: Date | null;
  reelDeletedAt: Date | null;
  deviceLifecycleState: string;
  serviceEntitlementState: string;
  serviceSuspendedAt: Date | null;
  contentEligibility: string;
  hotReelEligible: boolean;
  publicPublishingEnabled: boolean;
  privacyMode: string;
}, now = Date.now()): boolean {
  return input.reelState === "ready" && input.reelReviewState === "approved" &&
    input.reelDeletedAt === null && (input.reelExpiresAt === null || input.reelExpiresAt.getTime() > now) &&
    (input.deviceLifecycleState === "active" || input.deviceLifecycleState === "degraded") &&
    input.serviceEntitlementState === "active" && input.serviceSuspendedAt === null &&
    input.contentEligibility === "approved" && input.hotReelEligible && input.publicPublishingEnabled &&
    input.privacyMode === "public";
}

export function destinationStartState(mode: SocialPublishingMode): "queued" | "waiting_for_review" | null {
  if (mode === "disabled") return null;
  return mode === "auto_publish" ? "queued" : "waiting_for_review";
}

export function aggregateDistributionState(states: readonly SocialDestinationState[]): "pending_review" | "queued" | "processing" | "completed" | "partial" | "failed" | "cancelled" {
  if (states.length === 0) return "failed";
  if (states.includes("waiting_for_review")) return "pending_review";
  const active = states.some((state) => ["queued", "authorized", "uploading", "processing", "failed_retryable", "revoke_requested"].includes(state));
  if (active) return states.some((state) => ["authorized", "uploading", "processing"].includes(state)) ? "processing" : "queued";
  if (states.every((state) => state === "published")) return "completed";
  if (states.some((state) => state === "published")) return "partial";
  if (states.every((state) => state === "cancelled")) return "cancelled";
  return "failed";
}

export function hasActiveRemoteProviderWork(states: readonly SocialDestinationState[]): boolean {
  return states.some((state) => ["authorized", "uploading", "processing", "revoke_requested"].includes(state));
}
export function canManuallyRetryDestination(input: { state: SocialDestinationState; attempts: number; maxAttempts: number; nextRetryAt: Date | null; now: Date }): boolean {
  return input.state === "failed_retryable" && input.attempts < input.maxAttempts &&
    (input.nextRetryAt === null || input.nextRetryAt <= input.now);
}

export function canApplyPublishResult(state: SocialDestinationState): boolean {
  return ["queued", "authorized", "uploading", "processing", "failed_retryable"].includes(state);
}

export function socialAccountSnapshotMatches(input: {
  expectedCredentialRef: string;
  currentCredentialRef: string | null;
  expectedConnectionState: string;
  currentConnectionState: string;
  expectedAuthorizationState: string;
  currentAuthorizationState: string;
  expectedUpdatedAt: Date;
  currentUpdatedAt: Date;
}) {
  return input.currentCredentialRef === input.expectedCredentialRef &&
    input.currentConnectionState === input.expectedConnectionState &&
    input.currentAuthorizationState === input.expectedAuthorizationState &&
    input.currentUpdatedAt.getTime() === input.expectedUpdatedAt.getTime();
}

export function distributionAuthorityUserId(input: { actorUserId: number; reviewedByUserId: number | null }): number {
  return input.reviewedByUserId ?? input.actorUserId;
}

export function socialAccountReconnectDecision(input: { existingVenueId: number | null; requestedVenueId: number; hasActiveRemoteWork: boolean }): "new_account" | "reconnect" | "venue_conflict" | "publishing_in_progress" {
  if (input.existingVenueId === null) return "new_account";
  if (input.existingVenueId !== input.requestedVenueId) return "venue_conflict";
  if (input.hasActiveRemoteWork) return "publishing_in_progress";
  return "reconnect";
}

export function retryDelayMs(attempt: number, stableKey: string): number {
  const base = 30_000;
  const max = 6 * 60 * 60 * 1000;
  const exponential = Math.min(max, base * 2 ** Math.max(0, attempt - 1));
  const jitterSeed = createHash("sha256").update(`${stableKey}:${attempt}`).digest().readUInt16BE(0);
  const jitter = 0.8 + (jitterSeed / 0xffff) * 0.4;
  return Math.min(max, Math.round(exponential * jitter));
}

export function distributionRequestFingerprint(input: {
  hotReelPublicId: string;
  accountPublicIds: string[];
  caption: string;
}): string {
  const normalized = JSON.stringify({
    hotReelPublicId: input.hotReelPublicId,
    accountPublicIds: [...input.accountPublicIds].sort(),
    caption: input.caption,
  });
  return createHash("sha256").update(normalized).digest("hex");
}
