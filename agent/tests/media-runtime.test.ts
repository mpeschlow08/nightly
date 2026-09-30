import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { AuthorizedMediaSource, MediaPolicy } from "../src/media/contracts";
import type { MediaSegment } from "../src/media/engine";
import { AgentMediaRuntime } from "../src/media/runtime";
import type { SupervisorOptions } from "../src/media/supervisor";

const source: AuthorizedMediaSource = {
  deviceId: 1, venueId: 2, sourceId: 3, venueCameraId: 4, kind: "IP_CAMERA", audioRole: "CAMERA_AUDIO",
  active: true, locator: "rtsp://camera.invalid/live", privacyMasksRequired: false,
};
const policy: MediaPolicy = {
  deviceId: 1, venueId: 2, serviceActive: true, commercialState: "active", commercialRevision: 1, offlineEntitlementExpiresAt: 1_000_000, allowedCapabilities: ["device.capture","device.hot_moments","venue.hot_reels"], contentEligible: true, hotReelEligible: true,
  publicPublishingEnabled: true, privacyRestricted: false, masksApplied: false,
};

test("authorized simulation buffers encrypted media and recovers a privacy-gated local moment", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nightly-media-integration-"));
  const key = randomBytes(32);
  let currentPolicy = policy;
  let clock = 100_000;
  const events: string[] = [];
  const options = {
    directory,
    keyProvider: async () => key,
    bindings: { list: async () => [3], resolve: async () => ({ source, policy: currentPolicy }) },
    logger: { log: (_level: string, event: string) => { events.push(event); } },
    simulation: true,
    now: () => clock,
    muxer: {
      mux: async (segments: readonly { data: Buffer }[]) => Buffer.from(`SIMULATED:${segments.map((item) => item.data.toString()).join("|")}`),
      validate: async (clip: Buffer) => clip.toString().startsWith("SIMULATED:"),
    },
  };
  const media = new AgentMediaRuntime(options);
  try {
    await media.start();
    await media.ingestSimulation(3, Buffer.from("VIDEO+AUDIO-PRE"), 900, 1000);
    await media.ingestSimulation(3, Buffer.from("VIDEO+AUDIO-POST"), 1000, 1100);
    const files = await readdir(join(directory, "segments"));
    for (const name of files) assert.equal((await readFile(join(directory, "segments", name))).includes("VIDEO+AUDIO"), false);
    const candidate = await media.trigger(3, 1000, 100, 100, { kind: "manual", requested: true });
    const ready = await media.moments.extract(candidate.id);
    assert.equal(ready.state, "ready");
    assert.equal(ready.coverage, "complete");
    assert.equal((await media.storage.read(ready.hotId!)).toString(), "SIMULATED:VIDEO+AUDIO-PRE|VIDEO+AUDIO-POST");
    currentPolicy = { ...policy, hotReelEligible: false };
    await assert.rejects(media.trigger(3, 1000, 100, 100, { kind: "manual", requested: true }), /ineligible/);
    await media.stop();
    assert.equal(media.health().length, 0);
    currentPolicy = policy;
    const restarted = new AgentMediaRuntime(options);
    await restarted.start();
    assert.equal((await restarted.moments.get(candidate.id))?.state, "ready");
    assert.equal((await restarted.storage.read(ready.hotId!)).toString().startsWith("SIMULATED:"), true);
    clock += 5 * 60_000 + 1;
    assert.deepEqual(await restarted.storage.list("segment"), []);
    assert.ok(events.every((event) => !event.includes(source.locator)));
    await restarted.stop();
  } finally {
    await media.stop();
    await rm(directory, { recursive: true, force: true });
  }
});

test("unbound or inactive canonical source cannot start capture", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nightly-media-denied-"));
  const key = randomBytes(32);
  const media = new AgentMediaRuntime({
    directory, keyProvider: async () => key, simulation: true,
    logger: { log: () => {} },
    bindings: { list: async () => [3], resolve: async () => ({ source: { ...source, active: false }, policy }) },
  });
  try {
    await media.start();
    assert.equal(media.health().length, 0);
    await assert.rejects(media.ingestSimulation(3, Buffer.from("sample"), 900, 1000), /unavailable/);
  } finally {
    await media.stop();
    await rm(directory, { recursive: true, force: true });
  }
});

test("runtime keeps timing per source and rejects segment delivery after rebinding", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nightly-media-timing-"));
  const key = randomBytes(32);
  const second = { ...source, sourceId: 5, venueCameraId: 6 };
  const bindings = new Map([[3, source], [5, second]]);
  const sinks = new Map<number, NonNullable<SupervisorOptions["onSegment"]>>();
  const events: string[] = [];
  const media = new AgentMediaRuntime({
    directory, keyProvider: async () => key, simulation: true, now: () => 100_000,
    logger: { log: (_level, event) => { events.push(event); } },
    bindings: { list: async () => [3, 5], resolve: async (sourceId) => ({ source: bindings.get(sourceId)!, policy }) },
  });
  media.supervisor.start = (bound, _policy, options) => {
    sinks.set(bound.sourceId, options!.onSegment!);
    return { health: () => ({ state: "RUNNING", acceleration: "SOFTWARE", reconnects: 0, discontinuities: 0, lastErrorCode: null }), stop: async () => {} };
  };
  const segment = (bound: AuthorizedMediaSource, sequence: number): MediaSegment => ({
    source: bound, sequence, bytes: Buffer.from("recording"), timing: {
      sourcePts: sequence * 90000, timeBase: "1/90000", durationMs: 1000, ptsOrigin: "encoded_segment",
      observedMonotonicMs: 5000 + sequence * 1000, observedWallMs: 100_000 + sequence * 1000,
    },
  });
  try {
    await media.start();
    await sinks.get(3)!(segment(source, 0));
    await sinks.get(5)!(segment(second, 0));
    assert.equal(media.timingEvidence(3)?.discontinuity, true);
    assert.equal(media.timingEvidence(5)?.sourcePts, 0);
    assert.equal(media.timingEvidence(3)?.startMs, 99_000);
    assert.equal((await media.storage.list("segment")).length, 2);
    await sinks.get(5)!({ ...segment(second, 1), timing: { ...segment(second, 1).timing!, durationMs: null } });
    assert.equal(media.timingEvidence(5)?.sourcePts, 90000);
    assert.equal(media.timingEvidence(5)?.startMs, null);
    assert.equal((await media.storage.list("segment")).length, 2);
    await assert.rejects(Promise.resolve().then(() => sinks.get(5)!(segment(source, 1))), /identity_mismatch/);
    bindings.set(3, { ...source, locator: "rtsp://other.invalid/live" });
    await assert.rejects(Promise.resolve().then(() => sinks.get(3)!(segment(source, 1))), /identity_mismatch/);
    await assert.rejects(media.ingestSimulation(3, Buffer.from("sample"), 100_000, 101_000), /ineligible/);
    await assert.rejects(media.trigger(3, 100_000, 100, 100, { kind: "manual", requested: true }), /ineligible/);
    assert.equal((await media.storage.list("segment")).length, 2);
    assert.ok(events.every((event) => !event.includes("rtsp:")));
  } finally {
    await media.stop();
    await rm(directory, { recursive: true, force: true });
  }
});

test("Hot Moment attribution keeps its capture-time session through delayed extraction", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nightly-session-attribution-"));
  const key = randomBytes(32);
  let sessionActive = true;
  const references: Array<{ publicId: string; mediaRevision: number; sourceId: number; candidateId: string;
    hotId: string; configRevision: string; windowStartAt: string; windowEndAt: string }> = [];
  const media = new AgentMediaRuntime({
    directory, keyProvider: async () => key, simulation: true, now: () => 100_000,
    logger: { log: () => {} },
    bindings: { revision: "rev-1", list: async () => [3], resolve: async () => ({ source, policy }) },
    performanceSession: () => sessionActive ? { publicId: "123e4567-e89b-42d3-a456-426614174000",
      mediaRevision: 1, includeMicrophone: false } : null,
    reportSessionMedia: async (reference) => { references.push(reference); },
    muxer: {
      mux: async (segments) => Buffer.from(`CLIP:${segments.map((item) => item.data.toString()).join(",")}`),
      validate: async (clip) => clip.toString().startsWith("CLIP:"),
    },
  });
  try {
    await media.start();
    await media.ingestSimulation(3, Buffer.from("pre"), 900, 1000);
    await media.ingestSimulation(3, Buffer.from("post"), 1000, 1100);
    const candidate = await media.trigger(3, 1000, 100, 100, { kind: "manual", requested: true });
    sessionActive = false;
    const ready = await media.extractMoment(candidate.id);
    assert.equal(ready.state, "ready");
    assert.equal(references.length, 1);
    assert.equal(references[0].publicId, "123e4567-e89b-42d3-a456-426614174000");
    assert.equal(references[0].windowStartAt, new Date(900).toISOString());
    assert.equal(references[0].windowEndAt, new Date(1100).toISOString());
  } finally {
    await media.stop();
    await rm(directory, { recursive: true, force: true });
  }
});