import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { watch } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, readdir, rename, rm, statfs, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { AuthorizedMediaSource, MediaPolicy } from "../src/media/contracts";
import { RollingMediaBuffer } from "../src/media/buffer";
import { FfmpegMp4Muxer } from "../src/media/ffmpeg-muxer";
import { LocalHotMoments } from "../src/media/moments";
import { EncryptedMediaStorage, MAX_SEGMENT_BYTES } from "../src/media/storage";

const source: AuthorizedMediaSource = { deviceId: 1, venueId: 2, sourceId: 3, venueCameraId: null, kind: "HDMI", audioRole: null, active: true, locator: "/dev/video0", privacyMasksRequired: false };
const policy: MediaPolicy = { deviceId: 1, venueId: 2, serviceActive: true, commercialState: "active", commercialRevision: 1, offlineEntitlementExpiresAt: Date.now() + 86_400_000, allowedCapabilities: ["device.capture","device.hot_moments","venue.hot_reels"], contentEligible: true, hotReelEligible: true, publicPublishingEnabled: true, privacyRestricted: false, masksApplied: false };

function execute(command: string, args: string[], input?: Buffer): Buffer {
  const result = spawnSync(command, args, { input, timeout: 10_000, maxBuffer: 256 * 1024 });
  assert.equal(result.status, 0, `${command} failed`);
  assert.equal(result.error, undefined, `${command} timed out`);
  return result.stdout;
}

test("Linux production media encrypts TS, extracts MP4 with real processes, and cleans tmpfs", { skip: process.platform !== "linux", timeout: 25_000 }, async () => {
  const tmpRoot = await mkdtemp("/dev/shm/nightly-proof-");
  const state = await mkdtemp(join(tmpdir(), "nightly-proof-state-"));
  const seen = new Set<string>();
  const observer = watch(tmpRoot, (_, filename) => { if (filename) seen.add(filename.toString()); });
  try {
    assert.equal(Number((await statfs(tmpRoot)).type), 0x1021994);
    const mediaFile = join(tmpRoot, "source.ts");
    execute("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=160x90:rate=10", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=16000", "-t", "1", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-f", "mpegts", "-fs", "1048576", "-y", mediaFile]);
    const media = await readFile(mediaFile);
    assert.ok(media.length > 0 && media.length < 1024 * 1024);
    await rm(mediaFile);

    const key = randomBytes(32);
    const storage = new EncryptedMediaStorage({ directory: join(state, "segments"), keyProvider: async () => key });
    const muxer = new FfmpegMp4Muxer({ tmpRoot });
    const moments = new LocalHotMoments({ directory: join(state, "moments"), keyProvider: async () => key, storage, muxer,
      resolveCanonical: async () => ({ source, policy }), waitMs: 0, muxMs: 10_000 });
    const [record] = await new RollingMediaBuffer(storage, media.length).push(source.sourceId, media);
    assert.ok(record);
    const encrypted = await readFile(join(state, "segments", `${record.id}.enc`));
    assert.ok(!encrypted.includes(media) && !encrypted.toString().includes(media.toString("base64")));
    assert.deepEqual(await storage.read(record.id), media);

    let failReplacement = false;
    const replacement = new EncryptedMediaStorage({ directory: join(state, "replacement"), keyProvider: async () => key, maxCount: 1,
      filesystem: { rename: async (from, to) => {
        if (failReplacement && String(to).endsWith(".enc") && !String(to).endsWith("index.enc")) throw new Error("fixture_write_failed");
        await rename(from, to);
      } },
    });
    const original = await replacement.appendSegment(source.sourceId, media);
    const originalIndex = await readFile(join(state, "replacement", "index.enc"));
    failReplacement = true;
    await assert.rejects(replacement.appendSegment(source.sourceId, Buffer.from("replacement")), /fixture_write_failed/);
    assert.deepEqual(await replacement.read(original.id), media);
    assert.deepEqual(await readFile(join(state, "replacement", "index.enc")), originalIndex);
    assert.deepEqual((await readdir(join(state, "replacement"))).sort(), [`${original.id}.enc`, "index.enc"].sort());
    failReplacement = false;
    const committed = await replacement.appendSegment(source.sourceId, Buffer.from("replacement"));
    assert.equal((await replacement.read(committed.id)).toString(), "replacement");
    assert.deepEqual((await replacement.list("segment")).map((item) => item.id), [committed.id]);
    await moments.registerSegment(record, 900, 1900);
    const candidate = await moments.trigger(source.sourceId, 1400, 500, 500, { kind: "manual", requested: true });
    const ready = await moments.extract(candidate.id);
    assert.equal(ready.state, "ready");
    assert.equal(ready.coverage, "complete");
    assert.ok(ready.hotId);
    const clip = await storage.read(ready.hotId);
    assert.ok(clip.length > 0 && clip.length < MAX_SEGMENT_BYTES);
    assert.equal(await muxer.validate(clip), true);
    const probe = JSON.parse(execute("ffprobe", ["-v", "error", "-show_entries", "format=format_name,duration:stream=codec_type,codec_name", "-of", "json", "-i", "pipe:0"], clip).toString()) as {
      format: { format_name: string; duration: string }; streams: { codec_type: string; codec_name: string }[];
    };
    assert.match(probe.format.format_name, /mp4/);
    assert.ok(Number(probe.format.duration) > 0 && Number(probe.format.duration) <= 2);
    assert.ok(probe.streams.some((stream) => stream.codec_type === "video" && stream.codec_name === "h264"));
    assert.ok(probe.streams.some((stream) => stream.codec_type === "audio" && stream.codec_name === "aac"));
    assert.ok([...seen].some((name) => /^nightly-mux-[0-9a-f]{32}$/.test(name)));
    assert.deepEqual(await readdir(tmpRoot), []);
    assert.deepEqual(await storage.read(record.id), media);

    const missingCandidate = await moments.trigger(source.sourceId, 1400, 500, 500, { kind: "manual", requested: true });
    const corruptCandidate = await moments.trigger(source.sourceId, 1400, 500, 500, { kind: "manual", requested: true });
    const missingReady = await moments.extract(missingCandidate.id);
    const corruptReady = await moments.extract(corruptCandidate.id);
    assert.equal(missingReady.state, "ready");
    assert.equal(corruptReady.state, "ready");
    await rm(join(state, "segments", `${missingReady.hotId}.enc`));
    await writeFile(join(state, "segments", `${corruptReady.hotId}.enc`), "invalid encrypted envelope");
    await writeFile(join(state, "segments", "unrelated.txt"), "fixture-only");
    const recoveredStorage = await storage.recover();
    assert.ok(recoveredStorage.missing >= 2 && recoveredStorage.corrupt >= 1);
    const restarted = new LocalHotMoments({ directory: join(state, "moments"), keyProvider: async () => key, storage, muxer,
      resolveCanonical: async () => ({ source, policy }), waitMs: 0, muxMs: 10_000 });
    await restarted.recover();
    assert.equal((await restarted.get(ready.id))?.state, "ready");
    assert.deepEqual(await storage.read(ready.hotId), clip);
    for (const missing of [missingReady, corruptReady]) {
      const candidate = await restarted.get(missing.id);
      assert.equal(candidate?.state, "failed");
      assert.equal(candidate.hotId, null);
      assert.equal(candidate.coverage, null);
      assert.equal(candidate.failure, "moment_storage_failed");
      await assert.rejects(storage.read(missing.hotId!));
    }
    assert.deepEqual((await storage.list("hot")).map((item) => item.id), [ready.hotId]);
    assert.equal(await readFile(join(state, "segments", "unrelated.txt"), "utf8"), "fixture-only");
    const settledJournal = await readFile(join(state, "moments", "moments.enc"));
    await restarted.recover();
    assert.deepEqual(await readFile(join(state, "moments", "moments.enc")), settledJournal);
    assert.equal((await restarted.get(ready.id))?.state, "ready");
    assert.deepEqual(await storage.read(ready.hotId), clip);
    assert.deepEqual(await readdir(tmpRoot), []);

    const malformed = Buffer.from("invalid synthetic transport stream");
    const badRecord = await storage.appendSegment(source.sourceId, malformed);
    assert.ok(!(await readFile(join(state, "segments", `${badRecord.id}.enc`))).includes(malformed));
    await moments.registerSegment(badRecord, 3000, 4000);
    const badCandidate = await moments.trigger(source.sourceId, 3500, 500, 500, { kind: "manual", requested: true });
    const failureStart = Date.now();
    await assert.rejects(moments.extract(badCandidate.id), /moment_mux_failed/);
    assert.ok(Date.now() - failureStart < 5000);
    const failed = await moments.get(badCandidate.id);
    assert.equal(failed?.state, "failed");
    assert.equal(failed.hotId, null);
    assert.deepEqual((await storage.list("hot")).map((item) => item.id), [ready.hotId]);
    assert.deepEqual(await readdir(tmpRoot), []);
    assert.ok([...seen].filter((name) => /^nightly-mux-[0-9a-f]{32}$/.test(name)).length >= 4);

    const stale = join(tmpRoot, `nightly-mux-${"a".repeat(32)}`);
    const active = join(tmpRoot, `nightly-mux-${"b".repeat(32)}`);
    const insecure = join(tmpRoot, `nightly-mux-${"c".repeat(32)}`);
    const unrelated = join(tmpRoot, "unrelated");
    await mkdir(stale, { mode: 0o700 });
    await writeFile(join(stale, "synthetic.txt"), "fixture-only");
    await utimes(stale, new Date(0), new Date(0));
    await mkdir(active, { mode: 0o700 });
    await mkdir(insecure, { mode: 0o755 });
    await chmod(insecure, 0o755);
    await utimes(insecure, new Date(0), new Date(0));
    await mkdir(unrelated, { mode: 0o700 });
    await muxer.recover();
    assert.deepEqual((await readdir(tmpRoot)).sort(), ["unrelated", `nightly-mux-${"b".repeat(32)}`, `nightly-mux-${"c".repeat(32)}`].sort());
    console.log(JSON.stringify({ result: "PASS", durationSeconds: Number(probe.format.duration), mp4Bytes: clip.length, video: "h264", audio: "aac", encrypted: true, rollingBuffer: true, failedReplacementPreserved: true, replacementRecovered: true, validReadyPreserved: true, missingReadyFailed: true, corruptReadyFailed: true, recoveryIdempotent: true, successCleanup: true, failureCleanup: true, staleRecovery: true }));
  } finally {
    observer.close();
    await rm(tmpRoot, { recursive: true, force: true });
    await rm(state, { recursive: true, force: true });
  }
});