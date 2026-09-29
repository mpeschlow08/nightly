import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { ControlPlaneConfig } from "../src/core/types";
import { DeviceMediaBindings } from "../src/media/device-bindings";
import { AgentMediaRuntime } from "../src/media/runtime";

const config: ControlPlaneConfig = {
  ok: true, deviceId: 7, model: "nightly-box", venueId: 9, configRevision: "rev-1", configAvailable: true,
  timestamp: "2026-01-01T00:00:00.000Z",
  sections: {
    privacy: { mode: "private", contentEligibility: "approved", publicPublishingEnabled: true, revision: 1 },
    service: { entitlementState: "active", hotReelEligible: true, liveEligible: false, revision: 1 },
    media: { revision: "rev-1", ttlSeconds: 300, sources: [{ sourceId: 3, deviceId: 7, venueId: 9, sourceType: "ip_camera", venueCameraId: 5, enabled: true, capability: "rtsp" }] },
    recovery: { enabled: false },
  },
};

test("only canonical device bindings are exposed and the snapshot expires after 300 seconds", async () => {
  let now = 100_000;
  const bindings = new DeviceMediaBindings(undefined, () => now);
  bindings.bindIdentity(7, 9);
  bindings.update(config);
  assert.deepEqual(await bindings.list(), [3]);
  assert.equal((await bindings.resolve(3)).source.locator, "rtsp://nightly-source-3.invalid/live");
  assert.equal(JSON.stringify(await bindings.resolve(3)).includes("password"), false);
  now += 300_000;
  await assert.rejects(bindings.list(), /expired/);
});

test("binding validation fails closed on identity, revision, TTL and duplicate source mismatches", () => {
  const bindings = new DeviceMediaBindings();
  bindings.bindIdentity(7, 9);
  const invalid: ControlPlaneConfig[] = [
    { ...config, deviceId: 8 },
    { ...config, venueId: 10 },
    { ...config, sections: { ...config.sections, media: { ...config.sections.media, revision: "rev-old" } } },
    { ...config, sections: { ...config.sections, media: { ...config.sections.media, ttlSeconds: 301 } } },
    { ...config, sections: { ...config.sections, media: { ...config.sections.media, sources: [...config.sections.media.sources, config.sections.media.sources[0]] } } },
    { ...config, sections: { ...config.sections, media: { ...config.sections.media, sources: [{ ...config.sections.media.sources[0], venueId: 10 }] } } },
  ];
  for (const response of invalid) assert.throws(() => bindings.update(response));
  assert.equal(bindings.revision, null);
});

test("transient credential checks response identity, revision, URL and 60 second lifetime", async () => {
  let now = 100_000;
  const reply = { ok: true, sourceId: 3, configRevision: "rev-1", streamUrl: "rtsp://user:secret@camera.invalid/live", ttlSeconds: 60, expiresAt: new Date(now + 60_000).toISOString() };
  let response: unknown = reply;
  const bindings = new DeviceMediaBindings(async () => response, () => now);
  bindings.bindIdentity(7, 9);
  bindings.update(config);
  assert.deepEqual(await bindings.credential(3), { sourceId: 3, configRevision: "rev-1", streamUrl: reply.streamUrl, expiresAt: reply.expiresAt });
  assert.equal((await bindings.resolve(3)).source.locator, "rtsp://camera.invalid/live");
  for (response of [{ ...reply, sourceId: 4 }, { ...reply, configRevision: "rev-old" }, { ...reply, ttlSeconds: 61 },
    { ...reply, expiresAt: new Date(now + 61_000).toISOString() }, { ...reply, streamUrl: "http://camera.invalid/live" },
    { ...reply, streamUrl: "rtsp://user:secret@camera.invalid/live?token=abc" }]) {
    await assert.rejects(bindings.credential(3), /media_credential_invalid/);
  }
  response = reply;
  now += 60_000;
  await assert.rejects(bindings.credential(3), /media_credential_invalid/);
});

test("revision changes remove old sources and start only new authorized bindings", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nightly-bindings-"));
  const bindings = new DeviceMediaBindings();
  bindings.bindIdentity(7, 9);
  bindings.update(config);
  const key = randomBytes(32);
  const media = new AgentMediaRuntime({
    directory, keyProvider: async () => key, bindings, simulation: true, logger: { log: () => {} },
  });
  try {
    await media.start();
    assert.deepEqual(media.health().map((source) => source.sourceId), [3]);
    bindings.update({ ...config, configRevision: "rev-2", sections: { ...config.sections, media: {
      revision: "rev-2", ttlSeconds: 300, sources: [{ ...config.sections.media.sources[0], sourceId: 4, venueCameraId: 6 }],
    } } });
    await media.reconcile();
    assert.deepEqual(media.health().map((source) => source.sourceId), [4]);
    await assert.rejects(bindings.resolve(3), /unavailable/);
  } finally {
    await media.stop();
    await rm(directory, { recursive: true, force: true });
  }
});