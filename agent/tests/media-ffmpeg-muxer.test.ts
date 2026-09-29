import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import { FfmpegMp4Muxer } from "../src/media/ffmpeg-muxer";
import type { MediaProcess, MediaSpawn } from "../src/media/engine";

const validProbe = JSON.stringify({ format: { format_name: "mov,mp4,m4a,3gp,3g2,mj2", duration: "0.200" }, streams: [{ codec_type: "video", codec_name: "h264" }] });
const segments = [{ data: Buffer.from("private transport stream"), startMs: 900, endMs: 1100 }];
const window = { startMs: 900, endMs: 1100 };

class FakeChild extends EventEmitter implements MediaProcess {
  stdout = new PassThrough();
  stderr = new PassThrough();
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  kills: NodeJS.Signals[] = [];

  kill(signal: NodeJS.Signals): boolean {
    this.kills.push(signal);
    this.signalCode = signal;
    queueMicrotask(() => this.emit("exit", null));
    return true;
  }

  done(output = "", code = 0): void {
    this.stdout.end(output);
    this.stderr.end();
    this.exitCode = code;
    this.emit("exit", code);
  }
}

async function fixture(run?: (command: string, args: string[], child: FakeChild) => Promise<void> | void) {
  const root = await mkdtemp(join(process.platform === "linux" ? "/dev/shm" : tmpdir(), "nightly-mux-test-"));
  const calls: { command: string; args: string[]; child: FakeChild }[] = [];
  const runner: MediaSpawn = (command, args) => {
    const child = new FakeChild();
    calls.push({ command, args, child });
    if (run) queueMicrotask(() => { Promise.resolve(run(command, args, child)).catch(() => child.done("", 1)); });
    else queueMicrotask(async () => {
      if (command === "ffmpeg") {
        await writeFile(args.at(-1)!, Buffer.from("mp4 output"));
        child.done();
      } else child.done(validProbe);
    });
    return child;
  };
  const muxer = new FfmpegMp4Muxer({ tmpRoot: root, runner, filesystem: async () => 0x1021994, ffmpegMs: 150, ffprobeMs: 150 });
  return { root, calls, muxer, close: () => rm(root, { recursive: true, force: true }) };
}

test("mux writes only private tmpfs files, bounds processes, probes MP4, and removes plaintext", async () => {
  let inspected = false;
  const f = await fixture(async (command, args, child) => {
    if (command === "ffmpeg") {
      assert.deepEqual(args.slice(0, 4), ["-nostdin", "-hide_banner", "-loglevel", "error"]);
      assert.ok(args.includes("-fs") && args.includes("8388609"));
      const directory = dirname(args.at(-1)!);
      if (process.platform === "linux") {
        assert.equal((await lstat(directory)).mode & 0o777, 0o700);
        assert.equal((await lstat(join(directory, "input-00.ts"))).mode & 0o777, 0o600);
        assert.equal((await lstat(join(directory, "concat.txt"))).mode & 0o777, 0o600);
        assert.equal((await lstat(args.at(-1)!)).mode & 0o777, 0o600);
      }
      assert.deepEqual(await readFile(join(directory, "input-00.ts")), segments[0].data);
      assert.equal(await readFile(join(directory, "concat.txt"), "utf8"), "file 'input-00.ts'\n");
      inspected = true;
      await writeFile(args.at(-1)!, Buffer.from("mp4 output"));
      child.done();
    } else child.done(validProbe);
  });
  try {
    assert.equal((await f.muxer.mux(segments, window, new AbortController().signal)).toString(), "mp4 output");
    assert.equal(inspected, true);
    assert.deepEqual(f.calls.map((call) => call.command), ["ffmpeg", "ffprobe"]);
    assert.deepEqual(await readdir(f.root), []);
    assert.equal(await f.muxer.validate(Buffer.from("mp4 output")), true);
    assert.deepEqual(await readdir(f.root), []);
  } finally { await f.close(); }
});

test("invalid and oversized input never reaches a process", async () => {
  const f = await fixture();
  try {
    for (const [caseIndex, input] of [[], Array(33).fill(segments[0]), [{ ...segments[0], data: Buffer.alloc(8 * 1024 * 1024 + 1) }],
      Array(9).fill(null).map((_, index) => ({ data: Buffer.alloc(8 * 1024 * 1024), startMs: 900 + index, endMs: 1100 + index })),
      [{ ...segments[0], startMs: -1 }], [{ ...segments[0], startMs: 1100, endMs: 1200 }]].entries()) {
      await assert.rejects(f.muxer.mux(input, window, new AbortController().signal), /moment_mux_invalid_input/, `invalid input case ${caseIndex}`);
    }
    await assert.rejects(f.muxer.mux(segments, { startMs: 0, endMs: 60_001 }, new AbortController().signal), /moment_mux_invalid_input/);
    assert.equal(f.calls.length, 0);
    assert.deepEqual(await readdir(f.root), []);
  } finally { await f.close(); }
});

test("abort and timeout kill ffmpeg and remove the workspace", async () => {
  const f = await fixture(() => {});
  try {
    const controller = new AbortController();
    const pending = f.muxer.mux(segments, window, controller.signal);
    while (!f.calls.length) await new Promise((resolve) => setImmediate(resolve));
    controller.abort();
    await assert.rejects(pending, /moment_mux_aborted/);
    assert.deepEqual(f.calls[0].child.kills, ["SIGKILL"]);
    assert.deepEqual(await readdir(f.root), []);
    await assert.rejects(f.muxer.mux(segments, window, new AbortController().signal), /moment_mux_failed/);
    assert.deepEqual(f.calls[1].child.kills, ["SIGKILL"]);
    assert.deepEqual(await readdir(f.root), []);
  } finally { await f.close(); }
});

test("invalid probe, oversized output, and spawn errors fail closed without plaintext remnants", async () => {
  for (const variant of ["bad-probe", "large-output", "spawn-error"]) {
    const f = await fixture(async (command, args, child) => {
      if (variant === "spawn-error") { child.emit("error", new Error("SECRET")); return; }
      if (command === "ffmpeg") {
        await writeFile(args.at(-1)!, Buffer.alloc(variant === "large-output" ? 8 * 1024 * 1024 + 1 : 16));
        child.done();
      } else child.done(JSON.stringify({ format: { format_name: "mpegts", duration: "0.2" }, streams: [{ codec_type: "video", codec_name: "h264" }] }));
    });
    try {
      await assert.rejects(f.muxer.mux(segments, window, new AbortController().signal), (error: Error) => error.message === "moment_mux_failed");
      assert.deepEqual(await readdir(f.root), []);
    } finally { await f.close(); }
  }
});

test("startup removes only old private owned mux directories and rejects non-tmpfs", async () => {
  const f = await fixture();
  try {
    const stale = join(f.root, `nightly-mux-${"a".repeat(32)}`);
    const publicDirectory = join(f.root, `nightly-mux-${"b".repeat(32)}`);
    const active = join(f.root, `nightly-mux-${"c".repeat(32)}`);
    const unrelated = join(f.root, "unrelated");
    await mkdir(stale, { mode: 0o700 });
    await writeFile(join(stale, "plaintext"), "SECRET");
    await utimes(stale, new Date(0), new Date(0));
    if (process.platform === "linux") {
      await mkdir(publicDirectory, { mode: 0o755 });
      await chmod(publicDirectory, 0o755);
      await utimes(publicDirectory, new Date(0), new Date(0));
    }
    await mkdir(active, { mode: 0o700 });
    await mkdir(unrelated);
    await f.muxer.recover();
    const retained = ["unrelated", `nightly-mux-${"c".repeat(32)}`, ...(process.platform === "linux" ? [`nightly-mux-${"b".repeat(32)}`] : [])].sort();
    assert.deepEqual((await readdir(f.root)).sort(), retained);
    assert.equal(await f.muxer.validate(Buffer.from("mp4")), true);
    const blocked = new FfmpegMp4Muxer({ tmpRoot: process.platform === "linux" ? tmpdir() : f.root,
      runner: () => { throw new Error("unexpected spawn"); }, filesystem: async () => 0 });
    assert.equal(await blocked.validate(Buffer.from("mp4")), false);
    await assert.rejects(blocked.mux(segments, window, new AbortController().signal), /moment_mux_failed/);
    assert.deepEqual((await readdir(f.root)).sort(), retained);
  } finally { await f.close(); }
});