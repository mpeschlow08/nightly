import { finalizeHotReelUpload, promoteHotMomentToHotReel, authorizeHotReelPlayback as authorizeHotReelCore, expireHotReel } from "./core";
import type { HotReelActor, HotReelRecord, HotReelProvider } from "./types";

export type HotReelServiceInput = {
  hotMomentId: string;
  venueId: number;
  deviceId: number;
  sourceId: number;
  durationMs: number | null;
  sessionId?: number | null;
  provider: HotReelProvider;
  contentType?: string;
  expectedBytes?: number;
  expectedSha256?: string;
  now?: number;
};

export async function requestHotReelUpload(input: HotReelServiceInput): Promise<HotReelRecord> {
  return promoteHotMomentToHotReel({
    hotMomentId: input.hotMomentId,
    venueId: input.venueId,
    deviceId: input.deviceId,
    sourceId: input.sourceId,
    durationMs: input.durationMs,
    sessionId: input.sessionId ?? null,
    provider: input.provider,
    now: input.now,
    contentType: input.contentType ?? "video/mp4",
  });
}

export async function finalizeHotReel(record: HotReelRecord, provider: HotReelProvider, now?: number): Promise<HotReelRecord> {
  return finalizeHotReelUpload({
    record,
    provider,
    expectedBytes: record.contentBytes ?? undefined,
    expectedSha256: record.contentHash ?? undefined,
    now,
  });
}

export async function authorizeHotReelPlayback(input: {
  record: HotReelRecord;
  actor: HotReelActor;
  provider: HotReelProvider;
  expiresAt: number;
}): Promise<{ allowed: true; url: string; token: string; expiresAt: number } | { allowed: false; reason: string; expiresAt: number }> {
  return authorizeHotReelCore({
    record: input.record,
    actor: input.actor,
    provider: input.provider,
    expiresAt: input.expiresAt,
  });
}

export async function unpublishHotReel(record: HotReelRecord, provider: HotReelProvider, now?: number): Promise<HotReelRecord> {
  return {
    ...record,
    lifecycleState: record.lifecycleState === "expired" ? "expired" : record.lifecycleState,
    publicationState: "unpublished",
    updatedAt: now ?? Date.now(),
    expiresAt: record.expiresAt ?? (now ?? Date.now()),
  };
}

export async function deleteHotReel(record: HotReelRecord, provider: HotReelProvider, now?: number): Promise<HotReelRecord> {
  return expireHotReel({ record, provider, now });
}

export function isHotReelPlayable(record: HotReelRecord, actor: HotReelActor): boolean {
  if (record.lifecycleState !== "ready") return false;
  if (record.reviewState === "hidden") return false;
  if (record.publicationState === "published") return true;
  if (actor.role === "owner" || actor.role === "tech" || actor.role === "artist") {
    return actor.venueId === record.venueId;
  }
  return false;
}
