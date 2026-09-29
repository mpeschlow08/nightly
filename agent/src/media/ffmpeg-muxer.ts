import { randomBytes } from "node:crypto";
import { lstat, mkdir, open, readFile, readdir, realpath, rm, statfs } from "node:fs/promises";
import { join } from "node:path";
import { linuxMediaSpawn, type MediaSpawn } from "./engine";
import type { MediaMuxer, MuxInput } from "./moments";
import { MAX_SEGMENT_BYTES } from "./storage";

const MAX_INPUTS = 32;
const MAX_DURATION_MS = 60_000;
const MAX_TOTAL_BYTES = 64 * 1024 * 1024;
const WORKSPACE = /^nightly-mux-[0-9a-f]{32}$/;
const STALE_MS = 120_000;
const MAX_PROBE_BYTES = 64 * 1024;

export type FfmpegMuxerOptions = {
  tmpRoot?: string;
  runner?: MediaSpawn;
  filesystem?: (path: string) => Promise<number>;
  ffmpegMs?: number;
  ffprobeMs?: number;
};

function timeout(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 100 || value > 30_000) throw new Error("moment_mux_config_invalid");
  return value;
}

function seconds(ms: number): string { return (ms / 1000).toFixed(3); }

async function writePrivate(path: string, contents: Buffer | string): Promise<void> {
  const file = await open(path, "wx", 0o600);
  try { await file.writeFile(contents); } finally { await file.close(); }
}

function inspectProbe(raw: string, maxDurationMs: number): boolean {
  try {
    const parsed = JSON.parse(raw) as { format?: { format_name?: unknown; duration?: unknown }; streams?: { codec_type?: unknown; codec_name?: unknown }[] };
    const names = parsed.format?.format_name;
    const duration = Number(parsed.format?.duration);
    return typeof names === "string" && names.split(",").some((name) => name === "mp4" || name === "mov") &&
      Number.isFinite(duration) && duration > 0 && duration <= maxDurationMs / 1000 + 1 &&
      Array.isArray(parsed.streams) && parsed.streams.length > 0 && parsed.streams.length <= 4 &&
      parsed.streams.some((stream) => stream.codec_type === "video" || stream.codec_type === "audio") &&
      parsed.streams.every((stream) => (stream.codec_type === "video" && stream.codec_name === "h264") ||
        (stream.codec_type === "audio" && stream.codec_name === "aac"));
  } catch { return false; }
}

function checkInputs(segments: readonly MuxInput[], window: { startMs: number; endMs: number }): void {
  if (!Number.isSafeInteger(window.startMs) || window.startMs < 0 || !Number.isSafeInteger(window.endMs) ||
      window.endMs <= window.startMs || window.endMs - window.startMs > MAX_DURATION_MS ||
      !segments.length || segments.length > MAX_INPUTS) throw new Error("moment_mux_invalid_input");
  let total = 0;
  let previous = -1;
  for (const segment of segments) {
    if (!Buffer.isBuffer(segment.data) || !segment.data.length || segment.data.length > MAX_SEGMENT_BYTES ||
        !Number.isSafeInteger(segment.startMs) || !Number.isSafeInteger(segment.endMs) ||
        segment.startMs < 0 || segment.startMs < previous || segment.endMs <= segment.startMs || segment.endMs - segment.startMs > MAX_DURATION_MS ||
        segment.startMs >= window.endMs || segment.endMs <= window.startMs) {
      throw new Error("moment_mux_invalid_input");
    }
    total += segment.data.length;
    previous = segment.startMs;
  }
  if (total > MAX_TOTAL_BYTES) throw new Error("moment_mux_invalid_input");
}

export class FfmpegMp4Muxer implements MediaMuxer {
  private readonly runner: MediaSpawn;
  private readonly ffmpegMs: number;
  private readonly ffprobeMs: number;

  constructor(private readonly options: FfmpegMuxerOptions = {}) {
    this.runner = options.runner ?? linuxMediaSpawn;
    this.ffmpegMs = timeout(options.ffmpegMs, 3000);
    this.ffprobeMs = timeout(options.ffprobeMs, 1000);
    if (options.filesystem && !options.runner) throw new Error("moment_mux_config_invalid");
  }

  private async root(): Promise<string> {
    if (process.platform !== "linux" && !(this.options.runner && this.options.filesystem)) throw new Error("moment_mux_linux_required");
    const root = await realpath(this.options.tmpRoot ?? "/dev/shm");
    const info = await lstat(root);
    const fsType = process.platform === "linux" || !this.options.filesystem ? Number((await statfs(root)).type) : await this.options.filesystem(root);
    if (!info.isDirectory() || fsType !== 0x1021994) throw new Error("moment_mux_tmpfs_required");
    return root;
  }

  private async cleanAbandoned(root: string): Promise<void> {
    const names = await readdir(root);
    for (const name of names) {
      if (!WORKSPACE.test(name)) continue;
      const path = join(root, name);
      let info;
      try { info = await lstat(path); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }
      if (info.isDirectory() && !info.isSymbolicLink() && (process.platform !== "linux" || (info.mode & 0o077) === 0) &&
          (process.getuid?.() === undefined || info.uid === process.getuid()) && Date.now() - info.mtimeMs > STALE_MS) {
        await rm(path, { recursive: true, force: true });
      }
    }
  }

  async recover(): Promise<void> {
    await this.cleanAbandoned(await this.root());
  }

  private async workspace<T>(action: (directory: string) => Promise<T>): Promise<T> {
    const root = await this.root();
    await this.cleanAbandoned(root);
    const directory = join(root, `nightly-mux-${randomBytes(16).toString("hex")}`);
    await mkdir(directory, { mode: 0o700 });
    try { return await action(directory); }
    finally { await rm(directory, { recursive: true, force: true }); }
  }

  private async run(command: "ffmpeg" | "ffprobe", args: string[], ms: number, signal?: AbortSignal): Promise<string> {
    if (signal?.aborted) throw new Error("moment_mux_aborted");
    return new Promise<string>((resolve, reject) => {
      let child: ReturnType<MediaSpawn>;
      try { child = this.runner(command, args); }
      catch { reject(new Error("moment_mux_process_failed")); return; }
      let output = "";
      let settled = false;
      let stopping = false;
      let killTimer: NodeJS.Timeout | undefined;
      const finish = (error?: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearTimeout(killTimer);
        signal?.removeEventListener("abort", abort);
        if (error) reject(new Error(error)); else resolve(output);
      };
      const stop = (reason: string) => {
        if (settled || stopping) return;
        stopping = true;
        try { child.kill("SIGKILL"); } catch {}
        killTimer = setTimeout(() => finish(reason), 500);
      };
      const abort = () => stop("moment_mux_aborted");
      child.stdout.on("data", (chunk: Buffer) => {
        if (command === "ffprobe" && !stopping && !settled) {
          if (Buffer.byteLength(output) + chunk.length > MAX_PROBE_BYTES) stop("moment_mux_probe_failed");
          else output += chunk.toString("utf8");
        }
      });
      child.stderr.on("data", () => {});
      child.once("error", () => finish("moment_mux_process_failed"));
      child.once("exit", (code) => finish(stopping ? signal?.aborted ? "moment_mux_aborted" : "moment_mux_process_failed" :
        code === 0 ? undefined : "moment_mux_process_failed"));
      const timer = setTimeout(() => stop("moment_mux_process_failed"), ms);
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
    });
  }

  private async probe(path: string, maxDurationMs: number, signal?: AbortSignal): Promise<boolean> {
    try {
      const output = await this.run("ffprobe", ["-v", "error", "-show_entries", "format=format_name,duration:stream=codec_type,codec_name", "-of", "json", path], this.ffprobeMs, signal);
      return inspectProbe(output, maxDurationMs);
    } catch {
      if (signal?.aborted) throw new Error("moment_mux_aborted");
      return false;
    }
  }

  async mux(segments: readonly MuxInput[], window: { startMs: number; endMs: number }, signal: AbortSignal): Promise<Buffer> {
    checkInputs(segments, window);
    if (signal.aborted) throw new Error("moment_mux_aborted");
    try {
      return await this.workspace(async (directory) => {
        const files: string[] = [];
        for (const [index, segment] of segments.entries()) {
          if (signal.aborted) throw new Error("moment_mux_aborted");
          const name = `input-${index.toString().padStart(2, "0")}.ts`;
          await writePrivate(join(directory, name), segment.data);
          files.push(name);
        }
        await writePrivate(join(directory, "concat.txt"), files.map((name) => `file '${name}'\n`).join(""));
        const output = join(directory, "output.mp4");
        await writePrivate(output, "");
        const start = Math.max(window.startMs, segments[0].startMs);
        const end = Math.min(window.endMs, Math.max(...segments.map((segment) => segment.endMs)));
        if (end <= start) throw new Error("moment_mux_invalid_input");
        await this.run("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "1", "-i", join(directory, "concat.txt"),
          "-ss", seconds(start - segments[0].startMs), "-t", seconds(end - start), "-map", "0:v?", "-map", "0:a?",
          "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", "-movflags", "+faststart", "-f", "mp4", "-fs", String(MAX_SEGMENT_BYTES + 1), "-y", output], this.ffmpegMs, signal);
        const info = await lstat(output);
        if (!info.isFile() || info.isSymbolicLink() || (process.platform === "linux" && (info.mode & 0o077) !== 0) || !info.size || info.size > MAX_SEGMENT_BYTES) throw new Error("moment_mux_output_invalid");
        if (!await this.probe(output, end - start, signal)) throw new Error("moment_mux_output_invalid");
        if (signal.aborted) throw new Error("moment_mux_aborted");
        const bytes = await readFile(output);
        if (!bytes.length || bytes.length > MAX_SEGMENT_BYTES) throw new Error("moment_mux_output_invalid");
        return bytes;
      });
    } catch { throw new Error(signal.aborted ? "moment_mux_aborted" : "moment_mux_failed"); }
  }

  async validate(clip: Buffer): Promise<boolean> {
    if (!Buffer.isBuffer(clip) || !clip.length || clip.length > MAX_SEGMENT_BYTES) return false;
    try {
      return await this.workspace(async (directory) => {
        const path = join(directory, "validation.mp4");
        await writePrivate(path, clip);
        return this.probe(path, MAX_DURATION_MS);
      });
    } catch { return false; }
  }
}