import { createHash } from "node:crypto";

import type { HotReelActor, HotReelLifecycleState, HotReelPlaybackAuthorization, HotReelProvider, HotReelPublicationState, HotReelRecord, HotReelReviewState } from "./types";

export const HOT_REEL_TRANSITIONS: Record<HotReelLifecycleState, HotReelLifecycleState[]> = {
  local_ready: ["upload_pending"],
  upload_pending: ["uploading", "ready", "failed", "expired", "deleting"],
  uploading: ["uploaded", "ready", "failed", "expired", "deleting"],
  uploaded: ["processing", "ready", "failed", "expired", "deleting"],
  processing: ["ready", "failed", "expired", "deleting"],
  ready: ["expired", "deleting", "failed"],
  failed: ["upload_pending", "expired", "deleting"],
  expired: [],
  deleting: [],
  deleted: [],
};

export function transitionHotReelState(currentState: HotReelLifecycleState, nextState: HotReelLifecycleState): HotReelLifecycleState {
  const allowed = HOT_REEL_TRANSITIONS[currentState] ?? [];
  if (currentState === nextState) return currentState;
  if (!allowed.includes(nextState)) {
    throw new Error(`invalid_transition:${currentState}->${nextState}`);
  }
  return nextState;
}

function stableHotReelId(hotMomentId: string, venueId: number, deviceId: number, sourceId: number): string {
  return createHash("sha256")
    .update(`${hotMomentId}:${venueId}:${deviceId}:${sourceId}`)
    .digest("hex")
    .slice(0, 32);
}

export async function promoteHotMomentToHotReel(input: {
  hotMomentId: string;
  venueId: number;
  deviceId: number;
  sourceId: number;
  durationMs: number | null;
  sessionId?: number | null;
  provider: HotReelProvider;
  now?: number;
  contentType?: string;
}): Promise<HotReelRecord> {
  const provider = input.provider;
  const now = input.now ?? Date.now();
  const publicId = `hotreel-${stableHotReelId(input.hotMomentId, input.venueId, input.deviceId, input.sourceId)}`;
  const auth = await provider.createUploadAuthorization({
    hotMomentId: input.hotMomentId,
    venueId: input.venueId,
    deviceId: input.deviceId,
    sourceId: input.sourceId,
    durationMs: input.durationMs,
    contentType: input.contentType ?? "video/mp4",
  });

  return {
    id: publicId,
    publicId,
    hotMomentId: input.hotMomentId,
    venueId: input.venueId,
    deviceId: input.deviceId,
    sourceId: input.sourceId,
    sessionId: input.sessionId ?? null,
    lifecycleState: "upload_pending",
    publicationState: "private",
    reviewState: "pending",
    providerKey: provider.providerKey,
    providerObjectKey: auth.objectKey,
    providerObjectVersion: 1,
    contentHash: auth.expectedSha256 ?? null,
    contentBytes: auth.expectedBytes ?? null,
    contentType: auth.contentType ?? input.contentType ?? "video/mp4",
    durationMs: input.durationMs,
    capturedAt: now,
    uploadedAt: null,
    finalizedAt: null,
    expiresAt: null,
    deletedAt: null,
    failureCode: null,
    failureReason: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
}

export async function finalizeHotReelUpload(input: {
  record: HotReelRecord;
  provider: HotReelProvider;
  expectedBytes?: number;
  expectedSha256?: string;
  now?: number;
}): Promise<HotReelRecord> {
  const now = input.now ?? Date.now();
  if (input.record.lifecycleState === "ready") return input.record;
  const objectKey = input.record.providerObjectKey ?? input.record.publicId;
  const verification = await input.provider.verifyObject(objectKey, {
    expectedBytes: input.expectedBytes ?? input.record.contentBytes ?? undefined,
    expectedSha256: input.expectedSha256 ?? input.record.contentHash ?? undefined,
  });

  if (!verification.ok || !verification.providerStatus || verification.providerStatus === "missing") {
    throw new Error("integrity_check_failed");
  }

  await input.provider.finalizeUpload(objectKey).catch(() => undefined);
  const nextState = transitionHotReelState(input.record.lifecycleState, "ready");
  return {
    ...input.record,
    lifecycleState: nextState,
    contentHash: verification.sha256 ?? input.record.contentHash,
    contentBytes: verification.sizeBytes ?? input.record.contentBytes,
    uploadedAt: input.record.uploadedAt ?? now,
    finalizedAt: now,
    updatedAt: now,
    failureCode: null,
    failureReason: null,
  };
}

export async function authorizeHotReelPlayback(input: {
  record: HotReelRecord;
  actor: HotReelActor;
  provider: HotReelProvider;
  expiresAt: number;
}): Promise<{ allowed: true; url: string; token: string; expiresAt: number } | { allowed: false; reason: string; expiresAt: number }> {
  const record = input.record;

  if (record.lifecycleState !== "ready") {
    return { allowed: false, reason: "media_not_ready", expiresAt: input.expiresAt };
  }
  if (record.reviewState === "hidden") {
    return { allowed: false, reason: "media_hidden", expiresAt: input.expiresAt };
  }

  const privateReviewAllowed: Record<string, boolean> = { owner: true, tech: true, artist: true };
  const isPrivateReviewActor = privateReviewAllowed[input.actor.role] === true && input.actor.venueId === record.venueId;
  const isPublished = record.publicationState === "published";

  if (!isPublished && !isPrivateReviewActor) {
    return { allowed: false, reason: "media_not_published", expiresAt: input.expiresAt };
  }

  if (input.actor.role === "consumer" && input.actor.venueId !== record.venueId) {
    return { allowed: false, reason: "media_not_published", expiresAt: input.expiresAt };
  }

  const auth = await input.provider.createPlaybackAuthorization({ objectKey: record.providerObjectKey ?? record.publicId, expiresAt: input.expiresAt });
  return {
    allowed: true,
    url: auth.url,
    token: auth.token,
    expiresAt: auth.expiresAt,
  };
}

export async function expireHotReel(input: {
  record: HotReelRecord;
  provider: HotReelProvider;
  now?: number;
}): Promise<HotReelRecord> {
  const now = input.now ?? Date.now();
  const nextState = transitionHotReelState(input.record.lifecycleState, "expired");
  await input.provider.deleteObject(input.record.providerObjectKey ?? input.record.publicId).catch(() => undefined);
  return {
    ...input.record,
    lifecycleState: nextState,
    expiresAt: now,
    deletedAt: now,
    updatedAt: now,
    publicationState: "unpublished" as HotReelPublicationState,
  };
}
