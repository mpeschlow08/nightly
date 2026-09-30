import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { AuthorizedMediaSource, MediaPolicy } from "../src/media/contracts";
import { acceptsTrigger, LocalHotMoments, type MediaMuxer } from "../src/media/moments";
import { EncryptedMediaStorage } from "../src/media/storage";

const source: AuthorizedMediaSource = { deviceId: 1, venueId: 2, sourceId: 3, venueCameraId: 4, kind: "IP_CAMERA", audioRole: null, active: true, locator: "rtsp://private.local/live", privacyMasksRequired: true };
const policy: MediaPolicy = { deviceId: 1, venueId: 2, serviceActive: true, commercialState: "active", commercialRevision: 1, offlineEntitlementExpiresAt: 1_000_000, allowedCapabilities: ["device.capture","device.hot_moments","venue.hot_reels"], contentEligible: true, hotReelEligible: true, publicPublishingEnabled: true, privacyRestricted: false, masksApplied: true };

async function fixture(waitMs = 0) {
  const directory = await mkdtemp(join(tmpdir(), "nightly-moments-"));
  const key = randomBytes(32);
  let now = 100_000;
  let currentPolicy = policy;
  const storage = new EncryptedMediaStorage({ directory: join(directory, "media"), keyProvider: async () => key, now: () => now, maxAgeMs: 30_000, maxHotAgeMs: 60_000 });
  const muxer: MediaMuxer = { mux: async (segments) => Buffer.from(`CLIP:${segments.map((item) => item.data.toString()).join(",")}`), validate: async (clip) => clip.toString().startsWith("CLIP:") };
  const options = { directory: join(directory, "journal"), keyProvider: async () => key, storage, resolveCanonical: async () => ({ source, policy: currentPolicy }), muxer, now: () => now, waitMs, ttlMs: 20_000 };
  return { directory, storage, options, setPolicy: (value: MediaPolicy) => { currentPolicy = value; }, advance: (ms: number) => { now += ms; }, close: () => rm(directory, { force: true, recursive: true }) };
}

test("deterministic triggers and canonical policy gate candidate creation", async () => {
  const f = await fixture();
  try {
    const moments = new LocalHotMoments(f.options);
    assert.equal(acceptsTrigger({ kind: "synthetic", activity: 0.6, threshold: 0.7 }), false);
    assert.equal(acceptsTrigger({ kind: "synthetic", activity: 0.7, threshold: 0.7 }), true);
    await assert.rejects(moments.trigger(3, 1000, 100, 100, { kind: "synthetic", activity: 0.6, threshold: 0.7 }), /trigger_invalid/);
    f.setPolicy({ ...policy, masksApplied: false });
    await assert.rejects(moments.trigger(3, 1000, 100, 100, { kind: "manual", requested: true }), /ineligible/);
    f.setPolicy(policy);
    const candidate = await moments.trigger(3, 1000, 100, 100, { kind: "commissioning", verified: true });
    assert.equal(candidate.state, "pending");
    const disk = await readFile(join(f.options.directory, "moments.enc"), "utf8");
    assert.ok(!disk.includes(source.locator) && !disk.includes(candidate.id) && !disk.includes('"sourceId":3'));
    assert.deepEqual(await new LocalHotMoments(f.options).get(candidate.id), candidate);
  } finally { await f.close(); }
});

test("selects actual normalized windows, persists verified hot data, and deletes idempotently", async () => {
  const f = await fixture();
  try {
    const moments = new LocalHotMoments(f.options);
    const before = await f.storage.appendSegment(3, Buffer.from("before"));
    const first = await f.storage.appendSegment(3, Buffer.from("first"));
    const second = await f.storage.appendSegment(3, Buffer.from("second"));
    await moments.registerSegment(before, 700, 900);
    await moments.registerSegment(first, 900, 1000);
    await moments.registerSegment(second, 1000, 1100);
    const candidate = await moments.trigger(3, 1000, 100, 100, { kind: "manual", requested: true });
    const result = await moments.extract(candidate.id);
    assert.equal(result.state, "ready");
    assert.equal(result.coverage, "complete");
    assert.equal((await f.storage.read(result.hotId!)).toString(), "CLIP:first,second");
    await moments.delete(candidate.id);
    await moments.delete(candidate.id);
    assert.equal((await moments.get(candidate.id))?.state, "deleted");
    assert.deepEqual(await f.storage.list("hot"), []);
  } finally { await f.close(); }
});

test("missing, partial, policy revocation and absent muxer fail honestly", async () => {
  const f = await fixture();
  try {
    const moments = new LocalHotMoments(f.options);
    const missing = await moments.trigger(3, 1000, 100, 100, { kind: "manual", requested: true });
    await assert.rejects(moments.extract(missing.id), /moment_missing/);
    assert.equal((await moments.get(missing.id))?.state, "failed");
    const segment = await f.storage.appendSegment(3, Buffer.from("part"));
    await moments.registerSegment(segment, 950, 1000);
    const part = await moments.trigger(3, 1000, 100, 100, { kind: "manual", requested: true });
    assert.equal((await moments.extract(part.id)).coverage, "partial");
    const revoked = await moments.trigger(3, 1000, 100, 100, { kind: "manual", requested: true });
    f.setPolicy({ ...policy, privacyRestricted: true });
    await assert.rejects(moments.extract(revoked.id), /ineligible/);
    f.setPolicy(policy);
    const noMux = new LocalHotMoments({ ...f.options, muxer: undefined });
    const candidate = await noMux.trigger(3, 1000, 100, 100, { kind: "manual", requested: true });
    await assert.rejects(noMux.extract(candidate.id), /mux_failed/);
    assert.equal((await noMux.get(candidate.id))?.state, "failed");
    assert.equal((await readdir(f.options.directory)).some((name) => name.endsWith(".enc")), true);
  } finally { await f.close(); }
});

test("waits for post-roll, then selects newly registered segments", async () => {
  const f = await fixture(250);
  try {
    const moments = new LocalHotMoments({ ...f.options, pollMs: 10 });
    const first = await f.storage.appendSegment(3, Buffer.from("pre"));
    await moments.registerSegment(first, 900, 1000);
    const candidate = await moments.trigger(3, 1000, 100, 100, { kind: "manual", requested: true });
    const extraction = moments.extract(candidate.id);
    const second = await f.storage.appendSegment(3, Buffer.from("post"));
    await moments.registerSegment(second, 1000, 1100);
    const ready = await extraction;
    assert.equal(ready.coverage, "complete");
    assert.equal((await f.storage.read(ready.hotId!)).toString(), "CLIP:pre,post");
  } finally { await f.close(); }
});

test("abort and mux timeout leave retryable failures without hot objects", async () => {
  const f = await fixture(250);
  try {
    const moments = new LocalHotMoments({ ...f.options, pollMs: 10, muxMs: 20 });
    const candidate = await moments.trigger(3, 1000, 100, 100, { kind: "manual", requested: true });
    const abort = new AbortController();
    const extraction = moments.extract(candidate.id, abort.signal);
    abort.abort();
    await assert.rejects(extraction, /moment_timeout/);
    assert.equal((await moments.get(candidate.id))?.state, "failed");
    const segment = await f.storage.appendSegment(3, Buffer.from("all"));
    await moments.registerSegment(segment, 900, 1100);
    const hanging = new LocalHotMoments({ ...f.options, muxMs: 20, muxer: { mux: () => new Promise<Buffer>(() => undefined), validate: async () => true } });
    await assert.rejects(hanging.extract(candidate.id), /moment_timeout/);
    assert.deepEqual(await f.storage.list("hot"), []);
    assert.equal((await moments.extract(candidate.id)).state, "ready");
  } finally { await f.close(); }
});

test("revocation during muxing, expiry and journal authentication fail closed", async () => {
  const f = await fixture();
  try {
    const moments = new LocalHotMoments(f.options);
    const segment = await f.storage.appendSegment(3, Buffer.from("all"));
    await moments.registerSegment(segment, 900, 1100);
    const revoked = await moments.trigger(3, 1000, 100, 100, { kind: "manual", requested: true });
    const changing = new LocalHotMoments({ ...f.options, muxer: { ...f.options.muxer, mux: async () => {
      f.setPolicy({ ...policy, hotReelEligible: false });
      return Buffer.from("CLIP:all");
    } } });
    await assert.rejects(changing.extract(revoked.id), /moment_ineligible/);
    assert.deepEqual(await f.storage.list("hot"), []);
    f.setPolicy(policy);
    const ready = await moments.extract(revoked.id);
    f.advance(20_001);
    assert.equal((await moments.get(ready.id))?.state, "expired");
    await moments.expire();
    assert.equal((await new LocalHotMoments(f.options).get(ready.id))?.state, "expired");
    assert.deepEqual(await f.storage.list("hot"), []);
    const path = join(f.options.directory, "moments.enc");
    const envelope = JSON.parse(await readFile(path, "utf8"));
    envelope.data = "AAAA" + envelope.data.slice(4);
    await writeFile(path, JSON.stringify(envelope));
    await assert.rejects(new LocalHotMoments(f.options).get(ready.id), /authentication_failed/);
    const badKey = new LocalHotMoments({ ...f.options, keyProvider: async () => randomBytes(32) });
    await assert.rejects(badKey.get(ready.id), /authentication_failed/);
  } finally { await f.close(); }
});

test("missing segment bytes downgrade coverage and protected hot quota stays separate", async () => {
  const f = await fixture();
  try {
    const moments = new LocalHotMoments(f.options);
    const first = await f.storage.appendSegment(3, Buffer.from("first"));
    const second = await f.storage.appendSegment(3, Buffer.from("second"));
    await moments.registerSegment(first, 900, 1000);
    await moments.registerSegment(second, 1000, 1100);
    await rm(join(f.directory, "media", `${first.id}.enc`));
    const candidate = await moments.trigger(3, 1000, 100, 100, { kind: "manual", requested: true });
    const partial = await moments.extract(candidate.id);
    assert.equal(partial.coverage, "partial");
    assert.equal((await f.storage.read(partial.hotId!)).toString(), "CLIP:second");
    const full = await f.storage.appendSegment(3, Buffer.from("full"));
    await moments.registerSegment(full, 900, 1100);
    const blocked = await moments.trigger(3, 1000, 100, 100, { kind: "manual", requested: true });
    const quotaStorage = new EncryptedMediaStorage({ directory: join(f.directory, "media"), keyProvider: f.options.keyProvider,
      now: f.options.now, maxAgeMs: 30_000, maxHotAgeMs: 60_000, maxHotCount: 1 });
    const quotaMoments = new LocalHotMoments({ ...f.options, storage: quotaStorage });
    await assert.rejects(quotaMoments.extract(blocked.id), /moment_storage_failed/);
    assert.equal((await quotaMoments.get(blocked.id))?.state, "failed");
    assert.equal((await quotaStorage.list("hot")).length, 1);
    await quotaMoments.delete(partial.id);
    assert.equal((await quotaMoments.extract(blocked.id)).coverage, "complete");
  } finally { await f.close(); }
});

test("missing pre-roll and interior holes remain partial despite post-roll", async () => {
  const f = await fixture();
  try {
    const moments = new LocalHotMoments(f.options);
    const late = await f.storage.appendSegment(3, Buffer.from("late"));
    await moments.registerSegment(late, 950, 1100);
    const missingPre = await moments.trigger(3, 1000, 100, 100, { kind: "manual", requested: true });
    assert.equal((await moments.extract(missingPre.id)).coverage, "partial");
    const early = await f.storage.appendSegment(3, Buffer.from("early"));
    await moments.registerSegment(early, 900, 940);
    const hole = await moments.trigger(3, 1000, 100, 100, { kind: "manual", requested: true });
    assert.equal((await moments.extract(hole.id)).coverage, "partial");
  } finally { await f.close(); }
});

test("restart promotes verified creating clips and fails interrupted clips without bytes", async () => {
  const f = await fixture();
  try {
    const moments = new LocalHotMoments(f.options);
    const segment = await f.storage.appendSegment(3, Buffer.from("full"));
    await moments.registerSegment(segment, 900, 1100);
    const candidate = await moments.trigger(3, 1000, 100, 100, { kind: "manual", requested: true });
    let reachedRead!: () => void;
    const reading = new Promise<void>((resolve) => { reachedRead = resolve; });
    const stalledStorage = new Proxy(f.storage, {
      get(target, property) {
        if (property === "read") return (id: string) => id === segment.id ? target.read(id) : (reachedRead(), new Promise<Buffer>(() => undefined));
        const value = Reflect.get(target, property);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    void new LocalHotMoments({ ...f.options, storage: stalledStorage }).extract(candidate.id);
    await reading;
    const ready = await new LocalHotMoments(f.options).get(candidate.id);
    assert.equal(ready?.state, "ready");
    assert.equal(ready?.coverage, "complete");
    assert.equal((await f.storage.read(ready!.hotId!)).toString(), "CLIP:full");

    const interrupted = await moments.trigger(3, 1000, 100, 100, { kind: "manual", requested: true });
    let reachedMux!: () => void;
    let releaseMux!: (clip: Buffer) => void;
    const muxing = new Promise<void>((resolve) => { reachedMux = resolve; });
    const extraction = new LocalHotMoments({ ...f.options, muxer: { mux: () => (reachedMux(), new Promise<Buffer>((resolve) => { releaseMux = resolve; })), validate: async () => true } }).extract(interrupted.id);
    await muxing;
    assert.equal((await moments.get(interrupted.id))?.state, "creating");
    const failed = await new LocalHotMoments(f.options).get(interrupted.id);
    assert.equal(failed?.state, "failed");
    assert.equal(failed?.failure, "moment_storage_failed");
    releaseMux(Buffer.from("CLIP:full"));
    await assert.rejects(extraction, /moment_storage_failed/);
  } finally { await f.close(); }
});

test("restart removes hot objects not referenced by a ready candidate", async () => {
  const f = await fixture();
  try {
    const moments = new LocalHotMoments(f.options);
    const orphan = await f.storage.createHotMoment(3, Buffer.from("orphan"), f.options.now() + 1000);
    await moments.recover();
    assert.deepEqual(await f.storage.list("hot"), []);
    await assert.rejects(f.storage.read(orphan.id), /not available/);
  } finally { await f.close(); }
});

test("restart downgrades a ready candidate whose encrypted clip is missing", async () => {
  const f = await fixture();
  try {
    const moments = new LocalHotMoments(f.options);
    const segment = await f.storage.appendSegment(3, Buffer.from("full"));
    await moments.registerSegment(segment, 900, 1100);
    const candidate = await moments.trigger(3, 1000, 100, 100, { kind: "manual", requested: true });
    const ready = await moments.extract(candidate.id);
    assert.equal(ready.state, "ready");
    await rm(join(f.directory, "media", `${ready.hotId}.enc`));
    await f.storage.recover();
    const restarted = new LocalHotMoments(f.options);
    await restarted.recover();
    const recovered = await restarted.get(candidate.id);
    assert.equal(recovered?.state, "failed");
    assert.equal(recovered.hotId, null);
    assert.equal(recovered.failure, "moment_storage_failed");
  } finally { await f.close(); }
});

test("expired candidates release bounded journal capacity", async () => {
  const fixtureState = await fixture();
  try {
    const moments = new LocalHotMoments(fixtureState.options);
    for (let count = 0; count < 64; count++) {
      await moments.trigger(3, 1000, 100, 100, { kind: "manual", requested: true });
    }
    await assert.rejects(moments.trigger(3, 1000, 100, 100, { kind: "manual", requested: true }), /candidate_quota/);
    fixtureState.advance(20_001);
    const next = await moments.trigger(3, 1000, 100, 100, { kind: "manual", requested: true });
    assert.equal(next.state, "pending");
  } finally { await fixtureState.close(); }
});