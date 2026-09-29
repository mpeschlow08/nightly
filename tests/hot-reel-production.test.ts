import assert from "node:assert/strict";
import { test } from "node:test";

import { authorizeHotReelPlayback, deleteHotReel, finalizeHotReel, requestHotReelUpload } from "@/lib/hot-reel/service";
import { MockHotReelProvider } from "@/lib/hot-reel/provider/mock";
import { HotReelUploadQueue } from "../agent/src/hot-reel/queue";

const provider = new MockHotReelProvider();

test("request and finalize hot reel upload completes production lifecycle", async () => {
  const record = await requestHotReelUpload({
    hotMomentId: "hot-moment-123",
    venueId: 42,
    deviceId: 7,
    sourceId: 9,
    durationMs: 125000,
    provider,
    contentType: "video/mp4",
  });

  assert.equal(record.lifecycleState, "upload_pending");
  assert.equal(record.providerObjectKey !== null, true);

  const finalized = await finalizeHotReel(record, provider, Date.now());
  assert.equal(finalized.lifecycleState, "ready");
  assert.equal(finalized.finalizedAt !== null, true);
});

test("playback authorization is restricted to published or venue-authorized actors", async () => {
  const record = await requestHotReelUpload({
    hotMomentId: "hot-moment-pub",
    venueId: 11,
    deviceId: 3,
    sourceId: 2,
    durationMs: 90000,
    provider,
  });

  const finalized = await finalizeHotReel({ ...record, publicationState: "published" }, provider, Date.now());
  const playback = await authorizeHotReelPlayback({
    record: finalized,
    actor: { userId: "consumer-1", role: "consumer", venueId: 99 },
    provider,
    expiresAt: Date.now() + 60_000,
  });

  assert.equal(playback.allowed, false);
  assert.equal(playback.reason, "media_not_published");

  const venuePlayback = await authorizeHotReelPlayback({
    record: finalized,
    actor: { userId: "owner-1", role: "owner", venueId: 11 },
    provider,
    expiresAt: Date.now() + 60_000,
  });

  assert.equal(venuePlayback.allowed, true);
  assert.ok("url" in venuePlayback && typeof venuePlayback.url === "string");
});

test("queued hot reel work retries and recovers after restart", async () => {
  const queue = new HotReelUploadQueue("tmp/hot-reel-queue.json", 2);
  const item = queue.enqueue({ hotMomentId: "hot-moment-retry", action: "upload" });

  assert.equal(item.status, "queued");
  const claimed = queue.claimNext();
  assert.notEqual(claimed, null);

  queue.markRetry(claimed!.id, "transient_network_error", Date.now(), 10_000);
  const pending = queue.listPending(Date.now() + 100_000);
  assert.equal(pending.length >= 1, true);

  const recovered = queue.recover();
  assert.ok(recovered.some((entry) => entry.hotMomentId === "hot-moment-retry"));

  const deleted = await deleteHotReel({
    ...await requestHotReelUpload({ hotMomentId: "hot-moment-delete", venueId: 2, deviceId: 1, sourceId: 1, durationMs: 30000, provider }),
    lifecycleState: "ready",
  }, provider, Date.now());
  assert.equal(deleted.lifecycleState, "expired");
});
