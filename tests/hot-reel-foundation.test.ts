import assert from "node:assert/strict";
import test from "node:test";

import { MockHotReelProvider } from "@/lib/hot-reel/provider/mock";
import {
  authorizeHotReelPlayback,
  finalizeHotReelUpload,
  promoteHotMomentToHotReel,
  transitionHotReelState,
} from "@/lib/hot-reel/core";

const provider = new MockHotReelProvider();

test("Hot Reel lifecycle transitions reject invalid paths and allow idempotent promotion", async () => {
  assert.throws(() => transitionHotReelState("local_ready", "deleted"), /invalid_transition/);
  assert.equal(transitionHotReelState("upload_pending", "uploading"), "uploading");

  const first = await promoteHotMomentToHotReel({
    hotMomentId: "hot-27",
    venueId: 11,
    deviceId: 5,
    sourceId: 9,
    durationMs: 18_000,
    provider,
  });

  const second = await promoteHotMomentToHotReel({
    hotMomentId: "hot-27",
    venueId: 11,
    deviceId: 5,
    sourceId: 9,
    durationMs: 18_000,
    provider,
  });

  assert.equal(first.id, second.id);
  assert.equal(first.lifecycleState, "upload_pending");
  assert.equal(first.providerKey, "mock");
});

test("Finalization fails closed when provider integrity verification fails", async () => {
  const record = await promoteHotMomentToHotReel({
    hotMomentId: "hot-90",
    venueId: 22,
    deviceId: 12,
    sourceId: 18,
    durationMs: 12_000,
    provider,
  });

  await assert.rejects(
    () => finalizeHotReelUpload({
      record,
      provider,
      expectedBytes: 999,
      expectedSha256: "deadbeef",
    }),
    /integrity_check_failed/
  );

  const ready = await finalizeHotReelUpload({
    record,
    provider,
    expectedBytes: 128,
    expectedSha256: "abc123",
  });

  assert.equal(ready.lifecycleState, "ready");
});

test("Playback authorization is bounded and secret-free", async () => {
  const record = await promoteHotMomentToHotReel({
    hotMomentId: "hot-111",
    venueId: 33,
    deviceId: 7,
    sourceId: 14,
    durationMs: 21_000,
    provider,
  });

  const finalized = await finalizeHotReelUpload({
    record,
    provider,
    expectedBytes: 128,
    expectedSha256: "abc123",
  });

  const granted = await authorizeHotReelPlayback({
    record: { ...finalized, publicationState: "published", reviewState: "approved" },
    actor: { userId: "u-99", role: "consumer", venueId: 33 },
    provider,
    expiresAt: Date.now() + 30_000,
  });

  assert.equal(granted.allowed, true);
  assert.equal(granted.url.includes("secret"), false);
  assert.equal(JSON.stringify(granted).includes("provider-secret"), false);

  const denied = await authorizeHotReelPlayback({
    record: { ...finalized, publicationState: "private" },
    actor: { userId: "u-99", role: "consumer", venueId: 33 },
    provider,
    expiresAt: Date.now() + 30_000,
  });

  assert.equal(denied.allowed, false);
  assert.equal(denied.reason, "media_not_published");
});
