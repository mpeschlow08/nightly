import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, realpath, rm, stat, statfs, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { AuthorizedMediaSource, MediaCapabilities, MediaPolicy } from "./contracts";
import { assertAuthorizedSource } from "./contracts";

export interface MediaProcess {
  stdout: NodeJS.ReadableStream;
  stderr: NodeJS.ReadableStream;
  exitCode?: number | null;
  signalCode?: NodeJS.Signals | null;
  once(event: "error" | "exit", listener: (...args: unknown[]) => void): this;
  kill(signal: NodeJS.Signals): boolean;
}

export type MediaSpawn = (command: string, args: string[]) => MediaProcess;
export const linuxMediaSpawn: MediaSpawn = (command, args) =>
  spawn(command, args, { shell: false, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });

export type MediaInput = { format?: "v4l2" | "alsa" | "rtsp"; locator: string };

export type ResolvedStream = { streamUrl: string; expiresAt: string; configRevision: string; sourceId?: number };
export type StreamResolver = (sourceId: number, signal?: AbortSignal) => Promise<ResolvedStream>;
export type StreamAuthOptions = { resolveStream?: StreamResolver; configRevision?: string };

export function authenticatedMediaInput(source: AuthorizedMediaSource, response: ResolvedStream, revision: string): { input: MediaInput; authenticatedUrl: string; expiresAt: number } {
  const canonical = mediaInput(source);
  if (canonical.format !== "rtsp" || typeof revision !== "string" || !revision ||
      !response || typeof response.streamUrl !== "string" || response.streamUrl.length > 2048 ||
      response.configRevision !== revision || (response.sourceId !== undefined && response.sourceId !== source.sourceId)) throw new Error("media_auth_mismatch");
  const expiresAt = typeof response.expiresAt === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(response.expiresAt) ? Date.parse(response.expiresAt) : NaN;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || expiresAt > Date.now() + 300_000) throw new Error("media_auth_expired");
  try {
    const url = new URL(response.streamUrl);
    if (!url.username || !url.password || /%(?![0-9a-fA-F]{2})/.test(url.username + url.password)) throw new Error("media_auth_invalid");
    const username = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password);
    if (!username || !password || username.includes(":") || Buffer.byteLength(`${username}:${password}`) > 512 || /[\x00-\x1f\x7f]/.test(username + password)) throw new Error("media_auth_invalid");
    url.username = "";
    url.password = "";
    if (url.href !== new URL(canonical.locator).href || mediaInput({ ...source, locator: url.href }).format !== "rtsp") throw new Error("media_auth_invalid");
    return { input: { format: "rtsp", locator: canonical.locator }, authenticatedUrl: response.streamUrl, expiresAt };
  } catch { throw new Error("media_auth_invalid"); }
}

export function mediaInput(source: AuthorizedMediaSource): MediaInput {
  const locator = source.locator;
  if (source.kind === "HDMI" || source.kind === "MIXER_AUDIO" || source.kind === "AMBIENT_AUDIO") {
    if (source.kind === "HDMI" && /^\/dev\/video(?:0|[1-9]\d{0,2})$/.test(locator)) return { format: "v4l2", locator };
    if (source.kind !== "HDMI" && /^hw:(?:0|[1-9]\d{0,2}),(?:0|[1-9]\d{0,2})$/.test(locator)) return { format: "alsa", locator };
  } else if (source.kind === "IP_CAMERA") {
    try {
      const url = new URL(locator);
      if (url.protocol === "rtsp:" && url.hostname && !url.username && !url.password && !url.search && !url.hash &&
          /^[\/a-zA-Z0-9._~-]*$/.test(url.pathname) && !/(?:secret|token|password|auth|key)/i.test(url.pathname) &&
          (!url.port || (Number(url.port) > 0 && Number(url.port) <= 65535))) return { format: "rtsp", locator };
    } catch { /* Invalid URL is rejected below. */ }
  }
  throw new Error("media_locator_invalid");
}

function inputArgs(input: MediaInput, authenticatedUrl?: string): string[] {
  return [...(input.format === "rtsp" ? ["-rtsp_transport", "tcp"] : ["-f", input.format!]), "-i", authenticatedUrl ?? input.locator];
}

function assertLaunchAuth(input: MediaInput, auth: ReturnType<typeof authenticatedMediaInput> | undefined): void {
  if (!auth) return;
  if (input.format !== "rtsp" || auth.input?.locator !== input.locator || !Number.isFinite(auth.expiresAt) ||
      auth.expiresAt <= Date.now() || auth.expiresAt > Date.now() + 300_000 ||
      typeof auth.authenticatedUrl !== "string" || auth.authenticatedUrl.length > 2048) throw new Error("media_auth_invalid");
  try {
    const url = new URL(auth.authenticatedUrl);
    if (url.protocol !== "rtsp:" || !url.username || !url.password || url.search || url.hash ||
        /%(?![0-9a-fA-F]{2})/.test(url.username + url.password) ||
        /[\x00-\x1f\x7f]/.test(decodeURIComponent(url.username) + decodeURIComponent(url.password))) throw new Error();
    url.username = "";
    url.password = "";
    if (url.href !== new URL(input.locator).href) throw new Error();
  } catch { throw new Error("media_auth_invalid"); }
}

export async function resolveStreamAuth(source: AuthorizedMediaSource, options: StreamAuthOptions, signal?: AbortSignal): Promise<ReturnType<typeof authenticatedMediaInput> | undefined> {
  if (!options.resolveStream) {
    if (options.configRevision) throw new Error("media_auth_mismatch");
    return undefined;
  }
  if (source.kind !== "IP_CAMERA" || !options.configRevision || signal?.aborted) throw new Error("media_auth_mismatch");
  let response: ResolvedStream;
  try { response = await options.resolveStream(source.sourceId, signal); }
  catch { throw new Error("media_auth_resolve_failed"); }
  if (signal?.aborted) throw new Error("media_auth_resolve_failed");
  return authenticatedMediaInput(source, response, options.configRevision);
}

export function parseProbeJson(text: string): MediaCapabilities {
  if (Buffer.byteLength(text) > 256 * 1024) throw new Error("media_probe_oversize");
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { streams?: unknown }).streams)) throw new Error("media_probe_invalid");
  const streams = (parsed as { streams: unknown[] }).streams;
  const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const video = record(streams.find((value) => record(value).codec_type === "video"));
  const audio = record(streams.find((value) => record(value).codec_type === "audio"));
  const string = (value: unknown) => typeof value === "string" && value.length <= 80 && /^[\w.\/-]+$/.test(value) ? value : null;
  const number = (value: unknown) => Number.isSafeInteger(value) && (value as number) > 0 && (value as number) <= 100_000 ? value as number : null;
  const ratio = (value: unknown): number | null => {
    if (typeof value !== "string" || !/^\d{1,7}\/\d{1,7}$/.test(value)) return null;
    const [numerator, denominator] = value.split("/").map(Number);
    return denominator && numerator / denominator <= 1000 ? numerator / denominator : null;
  };
  if (!Object.keys(video).length && !Object.keys(audio).length) throw new Error("media_probe_no_streams");
  return {
    video: Object.keys(video).length ? { codec: string(video.codec_name), pixelFormat: string(video.pix_fmt), width: number(video.width), height: number(video.height), frameRate: ratio(video.avg_frame_rate) ?? ratio(video.r_frame_rate), timeBase: string(video.time_base), hardwareDecode: "NOT_TESTED", hardwareEncode: "NOT_TESTED" } : null,
    audio: Object.keys(audio).length ? { codec: string(audio.codec_name), sampleFormat: string(audio.sample_fmt), sampleRate: typeof audio.sample_rate === "string" ? number(Number(audio.sample_rate)) : number(audio.sample_rate), channels: number(audio.channels), channelLayout: string(audio.channel_layout), timeBase: string(audio.time_base) } : null,
  };
}

export type ProcessLimits = { probeMs?: number; startupMs?: number; shutdownMs?: number };
function limit(value: number | undefined, fallback: number, max: number) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 100 || value > max) throw new Error("media_limit_invalid");
  return value;
}

export async function stopProcess(child: MediaProcess, shutdownMs = 500): Promise<void> {
  const ms = limit(shutdownMs, 500, 2000);
  if (child.exitCode !== undefined && (child.exitCode !== null || child.signalCode !== null)) return;
  await new Promise<void>((resolve, reject) => {
    let done = false;
    let forceTimer: NodeJS.Timeout | undefined;
    const finish = (error?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (forceTimer) clearTimeout(forceTimer);
      if (error) reject(error);
      else resolve();
    };
    child.once("exit", () => finish());
    child.once("error", () => finish(new Error("media_shutdown_failed")));
    const timer = setTimeout(() => {
      try { child.kill("SIGKILL"); }
      catch { finish(new Error("media_shutdown_failed")); return; }
      forceTimer = setTimeout(() => finish(new Error("media_shutdown_timeout")), ms);
    }, ms);
    try { child.kill("SIGTERM"); }
    catch { finish(new Error("media_shutdown_failed")); }
  });
}

export async function probeMedia(source: AuthorizedMediaSource, policy: MediaPolicy, runner: MediaSpawn = linuxMediaSpawn, limits: ProcessLimits = {}, auth?: ReturnType<typeof authenticatedMediaInput>): Promise<MediaCapabilities> {
  assertAuthorizedSource(source, policy);
  const input = mediaInput(source);
  assertLaunchAuth(input, auth);
  const ms = limit(limits.probeMs, 4000, 10000);
  let child: MediaProcess;
  try { child = runner("ffprobe", ["-v", "error", "-show_streams", "-of", "json", ...inputArgs(input, auth?.authenticatedUrl)]); }
  catch { throw new Error("media_probe_spawn_failed"); }
  let output = "";
  let oversized = false;
  child.stdout.on("data", (chunk: Buffer) => {
    if (Buffer.byteLength(output) + chunk.length > 256 * 1024) { oversized = true; child.kill("SIGKILL"); }
    else output += chunk.toString("utf8");
  });
  let stderrBytes = 0;
  child.stderr.on("data", (chunk: Buffer) => { stderrBytes = Math.min(4096, stderrBytes + chunk.length); });
  const code = await new Promise<number>((resolve, reject) => {
    let settled = false;
    const finish = (value: number | Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (value instanceof Error) reject(value);
      else resolve(value);
    };
    child.once("exit", (exitCode) => finish(typeof exitCode === "number" ? exitCode : 1));
    child.once("error", () => finish(new Error("media_probe_spawn_failed")));
    const timer = setTimeout(() => { child.kill("SIGKILL"); finish(new Error(auth ? "media_auth_expired" : "media_probe_timeout")); }, auth ? Math.min(ms, Math.max(1, auth.expiresAt - Date.now())) : ms);
  });
  if (oversized) throw new Error("media_probe_oversize");
  if (code !== 0) throw new Error("media_probe_failed");
  try { return parseProbeJson(output); }
  catch { throw new Error("media_probe_invalid"); }
}

export type Capture = { process: MediaProcess | null; directory: string | null; acceleration: "SOFTWARE" | "VAAPI"; stop(): Promise<void> };
export type SegmentTimingEvidence = {
  sourcePts: number | null; timeBase: string | null; durationMs: number | null;
  ptsOrigin: "encoded_segment" | null; observedMonotonicMs: number; observedWallMs: number;
};
export type MediaSegment = { source: AuthorizedMediaSource; sequence: number; bytes: Buffer; timing?: SegmentTimingEvidence };
export type CaptureOptions = ProcessLimits & StreamAuthOptions & { runner?: MediaSpawn; simulation?: boolean; fixture?: string; tmpRoot?: string; onSegment?: (segment: MediaSegment) => Promise<void> | void; vaapi?: { h264Encode: boolean | null; vaapi: string; renderNode: string | null; encodeSmokeTestPassed: boolean } };

export async function deliverSegment(segment: MediaSegment, onSegment: CaptureOptions["onSegment"]): Promise<void> {
  await onSegment?.({ ...segment, source: { ...segment.source }, timing: segment.timing ? { ...segment.timing } : undefined });
}

export async function probeSegmentTiming(file: string, runner: MediaSpawn = linuxMediaSpawn): Promise<SegmentProbeTiming | null> {
  let child: MediaProcess;
  try { child = runner("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,start_pts,time_base:format=duration", "-of", "json", file]); }
  catch { return null; }
  let output = "";
  let oversized = false;
  child.stdout.on("data", (chunk: Buffer) => {
    if (Buffer.byteLength(output) + chunk.length > 256 * 1024) { oversized = true; child.kill("SIGKILL"); }
    else output += chunk.toString("utf8");
  });
  child.stderr.on("data", () => {});
  const code = await new Promise<number>((resolve) => {
    let settled = false;
    const finish = (value: number) => { if (settled) return; settled = true; clearTimeout(timer); resolve(value); };
    child.once("exit", (value) => finish(typeof value === "number" ? value : 1));
    child.once("error", () => finish(1));
    const timer = setTimeout(() => { child.kill("SIGKILL"); finish(1); }, 1000);
  });
  if (code !== 0 || oversized) return null;
  try { return parseSegmentProbeJson(output); }
  catch { return null; }
}

export async function startCapture(source: AuthorizedMediaSource, policy: MediaPolicy, options: CaptureOptions = {}, resolvedAuth?: ReturnType<typeof authenticatedMediaInput>): Promise<Capture> {
  const canonical = { ...source };
  assertAuthorizedSource(canonical, policy);
  const input = mediaInput(canonical);
  if (options.simulation) {
    if (options.fixture !== "SIMULATED") throw new Error("media_simulation_fixture_required");
    return { process: null, directory: null, acceleration: "SOFTWARE", stop: async () => {} };
  }
  if (process.platform !== "linux" && !options.runner) throw new Error("media_linux_only");
  const startupMs = limit(options.startupMs, 8000, 30000);
  const shutdownMs = limit(options.shutdownMs, 500, 2000);
  const auth = resolvedAuth ?? await resolveStreamAuth(canonical, options);
  assertLaunchAuth(input, auth);
  const root = await realpath(options.tmpRoot ?? "/dev/shm");
  const fs = await statfs(root);
  if (Number(fs.type) !== 0x1021994) throw new Error("media_tmpfs_required");
  const directory = await mkdtemp(join(root, "nightly-media-"));
  let child: MediaProcess | undefined;
  let spawnFailed = false;
  let poll: NodeJS.Timeout | undefined;
  let expiryTimer: NodeJS.Timeout | undefined;
  let inFlightScan: Promise<void> | undefined;
  try {
    const proven = options.vaapi?.vaapi === "SUPPORTED" && options.vaapi.h264Encode === true && options.vaapi.encodeSmokeTestPassed === true &&
      options.vaapi.renderNode !== null && /^\/dev\/dri\/renderD\d+$/.test(options.vaapi.renderNode);
    const acceleration = proven ? "VAAPI" : "SOFTWARE";
    const args = ["-nostdin", "-hide_banner", "-loglevel", "error", ...(proven ? ["-vaapi_device", options.vaapi!.renderNode!] : []), ...inputArgs(input, auth?.authenticatedUrl),
      ...(input.format === "alsa" ? ["-vn"] : ["-vf", proven
        ? "scale=w=1280:h=720:force_original_aspect_ratio=decrease,format=nv12,hwupload"
        : "scale=w=1280:h=720:force_original_aspect_ratio=decrease"]),
      ...(input.format === "alsa" ? [] : proven ? ["-c:v", "h264_vaapi", "-b:v", "1500k", "-maxrate", "2000k", "-bufsize", "4000k"] : ["-c:v", "libx264", "-preset", "veryfast", "-b:v", "1500k", "-maxrate", "2000k", "-bufsize", "4000k"]),
      "-c:a", "aac", "-b:a", "128k", "-f", "segment", "-segment_time", "2", "-segment_list", join(directory, "completed.txt"),
      "-segment_list_type", "flat", "-segment_list_size", "4", "-segment_format", "mpegts", "-y", join(directory, "segment-%09d.ts")];
    try { child = (options.runner ?? linuxMediaSpawn)("ffmpeg", args); }
    catch { throw new Error("media_capture_spawn_failed"); }
    const running = child;
    if (auth) expiryTimer = setTimeout(() => { try { running.kill("SIGKILL"); } catch {} }, Math.max(0, auth.expiresAt - Date.now()));
    let stderrBytes = 0;
    running.stderr.on("data", (chunk: Buffer) => { stderrBytes = Math.min(4096, stderrBytes + chunk.length); });
    let nextSequence = 0;
    let scanning = false;
    let dispatching: Promise<void> | null = null;
    let failure: Error | null = null;
    const pending: MediaSegment[] = [];
    const dispatch = () => {
      if (dispatching || !pending.length) return;
      dispatching = (async () => {
        while (pending.length && !failure) {
          const segment = pending.shift()!;
          await deliverSegment(segment, options.onSegment);
        }
      })().catch(() => { fail("media_segment_sink_failed"); }).finally(() => { dispatching = null; if (pending.length && !failure) dispatch(); });
    };
    const fail = (code: string) => {
      if (failure) return;
      failure = new Error(code);
      try { running.kill("SIGKILL"); } catch {}
    };
    const scan = async () => {
      if (scanning || failure) return;
      scanning = true;
      try {
        const files = await readdir(directory);
        const segments = files.filter((file) => /^segment-\d+\.ts$/.test(file));
        if (segments.length > 4) throw new Error("media_segment_backpressure");
        for (const file of segments) {
          const info = await stat(join(directory, file));
          if (!info.isFile() || info.size > 8 * 1024 * 1024) throw new Error("media_segment_oversize");
        }
        let list: string;
        try { list = await readFile(join(directory, "completed.txt"), "utf8"); }
        catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
        if (Buffer.byteLength(list) > 4096) throw new Error("media_segment_list_oversize");
        for (const entry of list.split("\n").slice(0, -1)) {
          const name = entry.startsWith(`${directory}/`) ? entry.slice(directory.length + 1) : entry;
          const match = /^segment-(\d{9})\.ts$/.exec(name);
          if (!match) throw new Error("media_segment_list_invalid");
          const sequence = Number(match[1]);
          if (sequence < nextSequence) continue;
          if (sequence !== nextSequence || pending.length + (dispatching ? 1 : 0) >= 2) throw new Error("media_segment_backpressure");
          const file = join(directory, match[0]);
          const bytes = await readFile(file);
          if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw new Error("media_segment_oversize");
          const observedMonotonicMs = Number(process.hrtime.bigint()) / 1_000_000;
          const observedWallMs = Date.now();
          const probed = await probeSegmentTiming(file, options.runner ?? linuxMediaSpawn);
          await unlink(file);
          nextSequence++;
          pending.push({ source: { ...canonical }, sequence, bytes, timing: {
            sourcePts: probed?.sourcePts ?? null, timeBase: probed?.timeBase ?? null, durationMs: probed?.durationMs ?? null,
            ptsOrigin: probed?.sourcePts != null ? "encoded_segment" : null, observedMonotonicMs, observedWallMs,
          } });
          dispatch();
        }
      } catch { fail("media_segment_failed"); }
      finally { scanning = false; }
    };
    poll = setInterval(() => { if (!scanning) inFlightScan = scan(); }, 50);
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => { if (settled) return; settled = true; clearInterval(startupPoll); clearTimeout(timer); if (error) reject(error); else resolve(); };
      running.once("error", () => { if (!settled) spawnFailed = true; finish(new Error("media_capture_spawn_failed")); });
      running.once("exit", () => finish(new Error("media_capture_exited")));
      const startupPoll = setInterval(() => { if (failure) finish(failure); else if (nextSequence > 0) finish(); }, 50);
      const timer = setTimeout(() => finish(new Error("media_capture_startup_timeout")), startupMs);
    });
    let stopped = false;
    return { process: running, directory, acceleration, stop: async () => {
      if (stopped) return;
      stopped = true;
      clearInterval(poll);
      if (expiryTimer) clearTimeout(expiryTimer);
      await stopProcess(running, shutdownMs);
      if (inFlightScan) await inFlightScan;
      await scan();
      if (dispatching) {
        let timer: NodeJS.Timeout | undefined;
        await Promise.race([dispatching, new Promise<void>((resolve) => { timer = setTimeout(resolve, shutdownMs); })]);
        clearTimeout(timer);
      }
      pending.length = 0;
      await rm(directory, { recursive: true, force: true });
    } };
  } catch (error) {
    if (poll) clearInterval(poll);
    if (expiryTimer) clearTimeout(expiryTimer);
    if (child && !spawnFailed) await stopProcess(child, shutdownMs);
    if (inFlightScan) await inFlightScan;
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

export type SegmentProbeTiming = { sourcePts: number | null; timeBase: string | null; durationMs: number | null };

export function parseSegmentProbeJson(text: string): SegmentProbeTiming | null {
  if (Buffer.byteLength(text) > 256 * 1024) throw new Error("media_probe_oversize");
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object") throw new Error("media_probe_invalid");
  const value = parsed as { streams?: unknown; format?: unknown };
  if (!Array.isArray(value.streams)) throw new Error("media_probe_invalid");
  const streams = value.streams.filter((stream): stream is Record<string, unknown> => !!stream && typeof stream === "object" && !Array.isArray(stream));
  const stream = streams.find((item) => item.codec_type === "video") ?? streams.find((item) => item.codec_type === "audio");
  const format = value.format && typeof value.format === "object" ? value.format as Record<string, unknown> : {};
  const hasPts = !!stream && Number.isSafeInteger(stream.start_pts) && (stream.start_pts as number) >= 0 &&
    typeof stream.time_base === "string" && /^[1-9]\d{0,8}\/[1-9]\d{0,8}$/.test(stream.time_base);
  const duration = typeof format.duration === "string" && /^\d{1,8}(?:\.\d{1,6})?$/.test(format.duration)
    ? Number(format.duration) * 1000 : null;
  const durationMs = duration !== null && Number.isFinite(duration) && duration > 0 && duration <= 30_000 ? duration : null;
  if (!hasPts && durationMs === null) return null;
  return { sourcePts: hasPts ? stream!.start_pts as number : null, timeBase: hasPts ? stream!.time_base as string : null, durationMs };
}