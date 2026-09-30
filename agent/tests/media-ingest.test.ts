import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFile, writeFile, stat } from "node:fs/promises";
import { platform } from "node:os";
import { dirname, join } from "node:path";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import { authenticatedMediaInput, deliverSegment, mediaInput, parseProbeJson, parseSegmentProbeJson, probeMedia, probeSegmentTiming, startCapture, stopProcess, type MediaProcess, type MediaSpawn } from "../src/media/engine";
import { MediaSupervisor } from "../src/media/supervisor";
import { SegmentTimeline, TimestampNormalizer } from "../src/media/timeline";
import type { AuthorizedMediaSource, MediaPolicy } from "../src/media/contracts";

const source: AuthorizedMediaSource = { deviceId: 1, venueId: 2, sourceId: 3, venueCameraId: 4, kind: "IP_CAMERA", audioRole: null, active: true, locator: "rtsp://camera.local/live", privacyMasksRequired: false };
const policy: MediaPolicy = { deviceId: 1, venueId: 2, serviceActive: true, commercialState: "active", commercialRevision: 1, offlineEntitlementExpiresAt: 1_000_000, allowedCapabilities: ["device.capture"], contentEligible: false, hotReelEligible: false, publicPublishingEnabled: false, privacyRestricted: true, masksApplied: false };
const probeJson = JSON.stringify({ streams: [
  { codec_type: "video", codec_name: "h264", pix_fmt: "yuv420p", width: 1920, height: 1080, avg_frame_rate: "30000/1001", time_base: "1/90000" },
  { codec_type: "audio", codec_name: "aac", sample_rate: "48000", channels: 2, time_base: "1/48000" },
] });

class FakeProcess extends EventEmitter implements MediaProcess {
  stdout = new PassThrough();
  stderr = new PassThrough();
  signals: NodeJS.Signals[] = [];
  kill(signal: NodeJS.Signals) { this.signals.push(signal); queueMicrotask(() => this.emit("exit", signal === "SIGKILL" ? 1 : 0)); return true; }
}

test("only authorized canonical inputs reach spawn; unsafe locators never appear in argv", async () => {
  let calls = 0;
  const runner: MediaSpawn = () => { calls++; return new FakeProcess(); };
  await assert.rejects(probeMedia({ ...source, active: false }, policy, runner), /authorized/);
  await assert.rejects(probeMedia({ ...source, venueCameraId: null }, policy, runner), /canonical/);
  for (const locator of ["rtsp://admin:secret@camera.local/live", "rtsp://camera.local/live?token=secret", "rtsp://camera.local/token123", "rtsp://camera.local/live\n-y"]) {
    await assert.rejects(probeMedia({ ...source, locator }, policy, runner));
  }
  assert.equal(calls, 0);
  assert.deepEqual(mediaInput({ ...source, kind: "HDMI", locator: "/dev/video12" }), { format: "v4l2", locator: "/dev/video12" });
  assert.deepEqual(mediaInput({ ...source, kind: "MIXER_AUDIO", locator: "hw:2,0" }), { format: "alsa", locator: "hw:2,0" });
  for (const locator of ["/dev/video0/../video2", "/dev/video9999", "hw:1,0;rm", "hw:01,0"]) {
    assert.throws(() => mediaInput({ ...source, kind: locator.startsWith("hw:") ? "MIXER_AUDIO" : "HDMI", locator }), /invalid/);
  }
});

test("bounded ffprobe parses codec, frame rate and timebases without exposing stderr", async () => {
  let args: string[] = [];
  const runner: MediaSpawn = (command, values) => {
    assert.equal(command, "ffprobe");
    args = values;
    const child = new FakeProcess();
    queueMicrotask(() => { child.stderr.write("rtsp://admin:secret@camera.local/live"); child.stdout.write(probeJson); child.emit("exit", 0); });
    return child;
  };
  const result = await probeMedia(source, policy, runner);
  assert.equal(result.video?.codec, "h264");
  assert.equal(result.video?.frameRate, 30000 / 1001);
  assert.equal(result.video?.timeBase, "1/90000");
  assert.equal(result.audio?.sampleRate, 48000);
  assert.equal(args.includes("rtsp://camera.local/live"), true);
  assert.equal(args.some((arg) => arg.includes("secret")), false);
  assert.throws(() => parseProbeJson("{"));
  assert.throws(() => parseProbeJson("x".repeat(262145)), /oversize/);
  assert.throws(() => parseProbeJson('{"streams":[]}'), /no_streams/);
});

test("probe timeout kills child and reports a fixed error code", async () => {
  const child = new FakeProcess();
  await assert.rejects(probeMedia(source, policy, () => child, { probeMs: 100 }), /media_probe_timeout/);
  assert.deepEqual(child.signals, ["SIGKILL"]);
});

test("shutdown escalates to SIGKILL when termination is ignored", async () => {
  const child = new FakeProcess();
  child.kill = (signal) => { child.signals.push(signal); if (signal === "SIGKILL") queueMicrotask(() => child.emit("exit", 1)); return true; };
  await stopProcess(child, 100);
  assert.deepEqual(child.signals, ["SIGTERM", "SIGKILL"]);
});

test("shutdown fails closed when even SIGKILL has not exited", async () => {
  const child = new FakeProcess();
  child.kill = (signal) => { child.signals.push(signal); return true; };
  await assert.rejects(stopProcess(child, 100), /media_shutdown_timeout/);
  assert.deepEqual(child.signals, ["SIGTERM", "SIGKILL"]);
});

test("simulation requires an explicit fixture and never starts a process", async () => {
  const runner: MediaSpawn = () => { throw new Error("unexpected spawn"); };
  await assert.rejects(startCapture(source, policy, { simulation: true, runner }), /fixture_required/);
  const capture = await startCapture(source, policy, { simulation: true, fixture: "SIMULATED", runner });
  assert.equal(capture.directory, null);
  await capture.stop();
});

test("segment delivery isolates source identity and awaits the injected sink", async () => {
  const mutableSource = { ...source };
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  let received: { sourceId: number; bytes: string } | null = null;
  let finished = false;
  const delivery = deliverSegment({ source: mutableSource, sequence: 7, bytes: Buffer.from("sealed") }, async (segment) => {
    received = { sourceId: segment.source.sourceId, bytes: segment.bytes.toString() };
    segment.source.sourceId = 999;
    await blocked;
  }).then(() => { finished = true; });
  assert.deepEqual(received, { sourceId: source.sourceId, bytes: "sealed" });
  assert.equal(mutableSource.sourceId, source.sourceId);
  assert.equal(finished, false);
  release();
  await delivery;
  assert.equal(finished, true);
});

test("Linux capture hands off only completed tmpfs segments and preserves camera audio", { skip: platform() !== "linux" }, async () => {
  let args: string[] = [];
  const child = new FakeProcess();
  const received: { sourceId: number; sequence: number; bytes: string }[] = [];
  const mutableSource = { ...source };
  let complete!: () => Promise<void>;
  let ready!: () => void;
  const spawned = new Promise<void>((resolve) => { ready = resolve; });
  const runner: MediaSpawn = (command, values) => {
    if (command === "ffprobe") {
      const probe = new FakeProcess();
      queueMicrotask(() => { probe.stdout.write(JSON.stringify({ streams: [{ codec_type: "video", start_pts: 90000, time_base: "1/90000" }], format: { duration: "2.000000" } })); probe.emit("exit", 0); });
      return probe;
    }
    assert.equal(command, "ffmpeg");
    args = values;
    const directory = dirname(values.at(-1)!);
    complete = async () => {
      await writeFile(join(directory, "segment-000000000.ts"), "complete");
      await writeFile(join(directory, "segment-000000001.ts"), "still open");
      await writeFile(join(directory, "completed.txt"), join(directory, "segment-000000000.ts") + "\n");
    };
    ready();
    return child;
  };
  const starting = startCapture(mutableSource, policy, { runner, startupMs: 1000, onSegment: (segment) => {
    received.push({ sourceId: segment.source.sourceId, sequence: segment.sequence, bytes: segment.bytes.toString() });
  }, vaapi: { vaapi: "SUPPORTED", h264Encode: true, renderNode: "/dev/dri/renderD128", encodeSmokeTestPassed: false } });
  await spawned;
  mutableSource.sourceId = 999;
  assert.deepEqual(received, []);
  await complete();
  const capture = await starting;
  assert.equal(capture.acceleration, "SOFTWARE");
  assert.ok(capture.directory?.startsWith("/dev/shm/nightly-media-"));
  assert.equal(args.includes("-segment_wrap"), false);
  assert.ok(args.includes("-segment_list") && args.includes("-segment_list_size"));
  assert.ok(args.includes("libx264"));
  assert.equal(args.includes("-an"), false);
  assert.ok(args.includes("-c:a") && args.includes("aac"));
  assert.deepEqual(received, [{ sourceId: source.sourceId, sequence: 0, bytes: "complete" }]);
  await assert.rejects(stat(join(capture.directory!, "segment-000000000.ts")));
  assert.equal(await readFile(join(capture.directory!, "segment-000000001.ts"), "utf8"), "still open");
  await capture.stop();
  await assert.rejects(stat(capture.directory!));
});

test("ffprobe spawn failures never expose runner errors", async () => {
  await assert.rejects(probeMedia(source, policy, () => { throw new Error("rtsp://private-camera/secret"); }), /^Error: media_probe_spawn_failed$/);
  await assert.rejects(probeMedia(source, policy, () => { throw new Error("unexpected spawn"); }, { probeMs: 1 }), /media_limit_invalid/);
});

test("Linux FFmpeg spawn errors clean tmpfs without leaking process details", { skip: platform() !== "linux" }, async () => {
  let directory = "";
  const runner: MediaSpawn = (_command, args) => {
    directory = dirname(args.at(-1)!);
    const child = new FakeProcess();
    child.kill = () => { throw new Error("never spawned"); };
    queueMicrotask(() => child.emit("error", new Error("rtsp://private-camera/secret")));
    return child;
  };
  await assert.rejects(startCapture(source, policy, { runner, startupMs: 1000 }), /^Error: media_capture_spawn_failed$/);
  await assert.rejects(stat(directory));
});

test("supervisor bounds concurrent sources and keeps session state isolated", async () => {
  const supervisor = new MediaSupervisor();
  const sessions = [10, 11, 12, 13].map((sourceId) => supervisor.start({ ...source, sourceId }, policy, { simulation: true, fixture: "SIMULATED" }));
  assert.throws(() => supervisor.start({ ...source, sourceId: 14 }, policy, { simulation: true, fixture: "SIMULATED" }), /media_source_limit_reached/);
  await sessions[0].stop();
  assert.equal(sessions[0].health().state, "STOPPED");
  assert.equal(sessions[1].health().state, "RUNNING");
  const replacement = supervisor.start({ ...source, sourceId: 14 }, policy, { simulation: true, fixture: "SIMULATED" });
  await supervisor.stopAll();
  assert.equal(replacement.health().state, "STOPPED");
});

test("Linux slow segment sink fails closed before a queue can grow", { skip: platform() !== "linux" }, async () => {
  const child = new FakeProcess();
  let directory = "";
  let release!: () => void;
  let ready!: () => void;
  const spawned = new Promise<void>((resolve) => { ready = resolve; });
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const runner: MediaSpawn = (command, args) => {
    if (command === "ffprobe") {
      const probe = new FakeProcess();
      queueMicrotask(() => { probe.stdout.write(JSON.stringify({ streams: [{ codec_type: "video", start_pts: 90000, time_base: "1/90000" }], format: { duration: "2" } })); probe.emit("exit", 0); });
      return probe;
    }
    directory = dirname(args.at(-1)!); ready(); return child;
  };
  const starting = startCapture(source, policy, { runner, startupMs: 1000, onSegment: () => blocked });
  await spawned;
  await writeFile(join(directory, "segment-000000000.ts"), "one");
  await writeFile(join(directory, "completed.txt"), join(directory, "segment-000000000.ts") + "\n");
  const capture = await starting;
  await writeFile(join(directory, "segment-000000001.ts"), "two");
  await writeFile(join(directory, "segment-000000002.ts"), "three");
  await writeFile(join(directory, "completed.txt"), [0, 1, 2].map((sequence) => join(directory, `segment-${String(sequence).padStart(9, "0")}.ts`)).join("\n") + "\n");
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.ok(child.signals.includes("SIGKILL"));
  release();
  await capture.stop();
  await assert.rejects(stat(directory));
});

test("supervisor isolates sources, bounds crash retries and stops simulated sessions", async () => {
  let attempts = 0;
  const runner: MediaSpawn = () => { attempts++; throw new Error("private camera detail"); };
  const supervisor = new MediaSupervisor();
  const failing = supervisor.start(source, policy, { runner, maxRestarts: 1, backoffMs: 100 });
  const simulated = supervisor.start({ ...source, sourceId: 5 }, policy, { simulation: true, fixture: "SIMULATED" });
  assert.throws(() => supervisor.start(source, policy), /already_running/);
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal(attempts, 2);
  assert.equal(failing.health().state, "FAILED");
  assert.equal(failing.health().lastErrorCode, "media_probe_spawn_failed");
  assert.equal(simulated.health().state, "RUNNING");
  await supervisor.stopAll();
  assert.equal(simulated.health().state, "STOPPED");
});

test("timestamp normalizer bounds drift, resets offset on reconnect and never goes backward", () => {
  const timeline = new TimestampNormalizer(100);
  const first = timeline.normalize(0, "1/1000", 1000);
  const second = timeline.normalize(1000, "1/1000", 2010);
  assert.equal(first.discontinuity, true);
  assert.ok(second.monotonicMs <= 2000.1);
  assert.ok(second.uncertaintyMs > first.uncertaintyMs);
  const reset = timeline.normalize(0, "1/1000", 3000, true);
  assert.equal(reset.discontinuity, true);
  assert.equal(reset.monotonicMs, 3000);
  assert.equal(timeline.normalize(0, "1/1000", 100, true).monotonicMs, 3000);
  assert.throws(() => timeline.normalize(0, "1/0", 100));
});

test("completed segment probe reports muxed PTS and duration, or explicit missing evidence", async () => {
  const runner: MediaSpawn = (command, args) => {
    assert.equal(command, "ffprobe");
    assert.equal(args.at(-1), "/tmp/completed.ts");
    const child = new FakeProcess();
    queueMicrotask(() => {
      child.stderr.write("rtsp://admin:secret@camera.local/live");
      child.stdout.write(JSON.stringify({ streams: [{ codec_type: "video", start_pts: 180000, time_base: "1/90000" }], format: { duration: "2.040000" } }));
      child.emit("exit", 0);
    });
    return child;
  };
  assert.deepEqual(await probeSegmentTiming("/tmp/completed.ts", runner), { sourcePts: 180000, timeBase: "1/90000", durationMs: 2040 });
  assert.deepEqual(parseSegmentProbeJson('{"streams":[{"codec_type":"video","start_pts":-1,"time_base":"1/90000"}],"format":{"duration":"2"}}'),
    { sourcePts: null, timeBase: null, durationMs: 2000 });
  assert.equal(parseSegmentProbeJson('{"streams":[],"format":{"duration":"N/A"}}'), null);
  assert.deepEqual(parseSegmentProbeJson('{"streams":[{"codec_type":"video","start_pts":90000,"time_base":"1/90000"}],"format":{"duration":"N/A"}}'),
    { sourcePts: 90000, timeBase: "1/90000", durationMs: null });
  assert.deepEqual(parseSegmentProbeJson('{"streams":[],"format":{"duration":"2"}}'),
    { sourcePts: null, timeBase: null, durationMs: 2000 });
  assert.throws(() => parseSegmentProbeJson("x".repeat(262145)), /oversize/);
  assert.equal(await probeSegmentTiming("/tmp/completed.ts", () => { throw new Error("secret"); }), null);
});

test("segment timeline separates observation from uncertain wall interval and detects reconnects", () => {
  const timeline = new SegmentTimeline();
  const segment = (sequence: number, sourcePts: number, observedMonotonicMs: number, observedWallMs: number) => ({
    source, sequence, bytes: Buffer.from("media"), timing: { sourcePts, timeBase: "1/90000", durationMs: 2000, ptsOrigin: "encoded_segment" as const, observedMonotonicMs, observedWallMs },
  });
  const first = timeline.observe(segment(0, 90000, 5000, 100000));
  assert.deepEqual([first?.startMs, first?.endMs, first?.discontinuity, first?.uncertaintyMs], [98000, 100000, true, null]);
  assert.equal(timeline.observe(segment(1, 270000, 7000, 102000))?.discontinuity, false);
  const reset = timeline.observe(segment(0, 0, 9000, 104000));
  assert.equal(reset?.discontinuity, true);
  assert.equal(reset?.sourcePts, 0);
  assert.equal(reset?.startMs, 102001);
  assert.equal(timeline.observe(segment(1, 180000, 10000, 103000))?.endMs, null);
  assert.equal(new SegmentTimeline().observe({ source, sequence: 0, bytes: Buffer.alloc(1) }), null);
});

test("resolved RTSP credentials stay out of canonical input and only enter the bounded process argument", async () => {
  const response = { sourceId: source.sourceId, configRevision: "revision-1", streamUrl: "rtsp://alice:p%40ss@camera.local/live", expiresAt: new Date(Date.now() + 60_000).toISOString() };
  const before = JSON.stringify(source);
  const auth = authenticatedMediaInput(source, response, "revision-1");
  assert.deepEqual(mediaInput(source), { format: "rtsp", locator: source.locator });
  assert.equal(auth.input.locator, source.locator);
  assert.equal(JSON.stringify(source), before);
  assert.equal(auth.authenticatedUrl, response.streamUrl);
  assert.throws(() => mediaInput({ ...source, locator: response.streamUrl }), /media_locator_invalid/);
  const runner: MediaSpawn = (command, args) => {
    assert.equal(command, "ffprobe");
    assert.deepEqual(args.slice(-4), ["-rtsp_transport", "tcp", "-i", response.streamUrl]);
    assert.equal(args.filter((arg) => arg === response.streamUrl).length, 1);
    const child = new FakeProcess();
    queueMicrotask(() => { child.stderr.write(response.streamUrl); child.stdout.write(probeJson); child.emit("exit", 0); });
    return child;
  };
  await probeMedia(source, policy, runner, {}, auth);
  await assert.rejects(probeMedia(source, policy, () => { throw new Error("must not spawn"); }, {},
    { ...auth, authenticatedUrl: "rtsp://alice:p%40ss@other.local/live" }), /media_auth_invalid/);
  await assert.rejects(probeMedia(source, policy, () => { throw new Error("must not spawn"); }, {},
    { ...auth, expiresAt: Date.now() - 1 }), /media_auth_invalid/);
});

test("resolver responses reject stale, mismatched, or unsafe endpoints without copying secrets to health", async () => {
  const valid = { sourceId: source.sourceId, configRevision: "r1", streamUrl: "rtsp://user:pass@camera.local/live", expiresAt: new Date(Date.now() + 60_000).toISOString() };
  assert.throws(() => authenticatedMediaInput(source, { ...valid, expiresAt: new Date(Date.now() - 1).toISOString() }, "r1"), /media_auth_expired/);
  assert.throws(() => authenticatedMediaInput(source, valid, "r2"), /media_auth_mismatch/);
  assert.throws(() => authenticatedMediaInput(source, { ...valid, sourceId: 99 }, "r1"), /media_auth_mismatch/);
  for (const streamUrl of ["http://user:pass@camera.local/live", "rtsp://user:pass@other.local/live", "rtsp://user:pass@camera.local/live?token=x", "rtsp://user:pass@camera.local/live#x", "rtsp://user:pass@camera.local/password", "rtsp://user:pa%0Dss@camera.local/live"]) {
    assert.throws(() => authenticatedMediaInput(source, { ...valid, streamUrl }, "r1"), /media_auth_invalid/);
  }
  const supervisor = new MediaSupervisor();
  const session = supervisor.start(source, policy, { configRevision: "r1", resolveStream: async () => { throw new Error(valid.streamUrl); }, maxRestarts: 0 });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(session.health().lastErrorCode, "media_auth_resolve_failed");
  assert.ok(!JSON.stringify(session.health()).includes("pass"));
  await session.stop();
});

test("shutdown aborts a pending device resolver without launching media", async () => {
  let signal: AbortSignal | undefined;
  const supervisor = new MediaSupervisor();
  const session = supervisor.start(source, policy, { resolveStream: async (_sourceId, abortSignal) => {
    signal = abortSignal;
    return new Promise(() => {});
  }, configRevision: "r1", runner: () => { throw new Error("unexpected launch"); } });
  await session.stop();
  assert.equal(signal?.aborted, true);
  assert.equal(session.health().state, "STOPPED");
});

test("Linux authenticated capture expires the ffmpeg process and removes its tmpfs directory", { skip: platform() !== "linux" }, async () => {
  const child = new FakeProcess();
  let directory = "";
  let resolveCount = 0;
  let ready!: () => void;
  const spawned = new Promise<void>((resolve) => { ready = resolve; });
  const runner: MediaSpawn = (command, args) => {
    assert.equal(command, "ffmpeg");
    assert.equal(args.includes("-headers"), false);
    assert.equal(args[args.indexOf("-i") + 1], "rtsp://user:pass@camera.local/live");
    directory = dirname(args.at(-1)!);
    ready();
    return child;
  };
  const starting = startCapture(source, policy, { runner, startupMs: 1000, configRevision: "r1", resolveStream: async () => {
    resolveCount++;
    return { sourceId: source.sourceId, configRevision: "r1", streamUrl: "rtsp://user:pass@camera.local/live", expiresAt: new Date(Date.now() + 200).toISOString() };
  } });
  await spawned;
  await assert.rejects(starting, /media_capture_exited/);
  assert.equal(resolveCount, 1);
  assert.ok(child.signals.includes("SIGKILL"));
  await assert.rejects(stat(directory));
});