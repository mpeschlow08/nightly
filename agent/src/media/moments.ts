import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { lstat, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { isHotMomentEligible, type AuthorizedMediaSource, type MediaPolicy } from "./contracts";
import { EncryptedMediaStorage, MAX_SEGMENT_BYTES, type MediaRecord } from "./storage";

export type MomentTrigger =
  | { kind: "manual"; requested: true }
  | { kind: "synthetic"; activity: number; threshold: number }
  | { kind: "commissioning"; verified: true };
export type MomentState = "pending" | "creating" | "ready" | "failed" | "expired" | "deleted";
export type MomentCoverage = "partial" | "complete";
export type MomentCandidate = {
  id: string; sourceId: number; kind: MomentTrigger["kind"]; state: MomentState;
  startMs: number; endMs: number; createdAt: number; expiresAt: number;
  coverage: MomentCoverage | null; hotId: string | null; failure: string | null;
};
export type TimedSegment = { id: string; sourceId: number; startMs: number; endMs: number; expiresAt: number };
export type MuxInput = { data: Buffer; startMs: number; endMs: number };
export type MediaMuxer = {
  mux(segments: readonly MuxInput[], window: { startMs: number; endMs: number }, signal: AbortSignal): Promise<Buffer>;
  validate(clip: Buffer): Promise<boolean>;
};
type Journal = { version: 1; segments: TimedSegment[]; candidates: MomentCandidate[] };
export type MomentOptions = {
  directory: string;
  keyProvider: () => Promise<Buffer>;
  storage: EncryptedMediaStorage;
  resolveCanonical: (sourceId: number) => Promise<{ source: AuthorizedMediaSource; policy: MediaPolicy }>;
  muxer?: MediaMuxer;
  now?: () => number;
  waitMs?: number;
  pollMs?: number;
  muxMs?: number;
  ttlMs?: number;
};

const empty = (): Journal => ({ version: 1, segments: [], candidates: [] });
const idPattern = /^[0-9a-f]{32}$/;
const integer = (value: number) => Number.isSafeInteger(value) && value >= 0;

export function acceptsTrigger(trigger: MomentTrigger): boolean {
  if (trigger.kind === "manual") return trigger.requested === true;
  if (trigger.kind === "commissioning") return trigger.verified === true;
  return trigger.kind === "synthetic" && Number.isFinite(trigger.activity) && Number.isFinite(trigger.threshold) &&
    trigger.activity >= 0 && trigger.activity <= 1 && trigger.threshold > 0 && trigger.threshold <= 1 && trigger.activity >= trigger.threshold;
}

export class LocalHotMoments {
  private readonly directory: string;
  private readonly now: () => number;
  private readonly waitMs: number;
  private readonly pollMs: number;
  private readonly muxMs: number;
  private readonly ttlMs: number;
  private pending: Promise<unknown> = Promise.resolve();
  private recovered = false;

  constructor(private readonly options: MomentOptions) {
    this.directory = resolve(options.directory);
    this.now = options.now ?? Date.now;
    this.waitMs = options.waitMs ?? 5000;
    this.pollMs = options.pollMs ?? 50;
    this.muxMs = options.muxMs ?? 5000;
    this.ttlMs = options.ttlMs ?? 60_000;
    if (!options.keyProvider || !options.storage || !options.resolveCanonical ||
        !integer(this.waitMs) || this.waitMs > 30_000 || !integer(this.pollMs) || this.pollMs < 1 || this.pollMs > 1000 ||
        !integer(this.muxMs) || this.muxMs < 1 || this.muxMs > 30_000 ||
        !integer(this.ttlMs) || this.ttlMs < 1 || this.ttlMs > 60 * 60_000) throw new Error("moment_config_invalid");
  }

  private serial<T>(action: () => Promise<T>): Promise<T> {
    const result = this.pending.then(action);
    this.pending = result.catch(() => undefined);
    return result;
  }

  private async key(): Promise<Buffer> {
    const key = await this.options.keyProvider();
    if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error("moment_key_unavailable");
    return key;
  }

  private async journal(): Promise<Journal> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const info = await lstat(this.directory);
    if (!info.isDirectory() || info.isSymbolicLink() || (process.platform === "linux" && (info.mode & 0o077) !== 0)) throw new Error("moment_directory_unsafe");
    let raw: Buffer;
    try {
      const path = join(this.directory, "moments.enc");
      const file = await lstat(path);
      if (!file.isFile() || file.isSymbolicLink()) throw new Error("moment_journal_unsafe");
      raw = await readFile(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") { await this.key(); return empty(); }
      throw error;
    }
    if (raw.length > 256 * 1024) throw new Error("moment_journal_invalid");
    try {
      const envelope = JSON.parse(raw.toString("utf8")) as { version: number; iv: string; tag: string; data: string };
      if (envelope.version !== 1) throw new Error();
      const iv = Buffer.from(envelope.iv, "base64");
      const tag = Buffer.from(envelope.tag, "base64");
      if (iv.length !== 12 || tag.length !== 16) throw new Error();
      const cipher = createDecipheriv("aes-256-gcm", await this.key(), iv);
      cipher.setAAD(Buffer.from("nightly-hot-moments:1"));
      cipher.setAuthTag(tag);
      const value = JSON.parse(Buffer.concat([cipher.update(Buffer.from(envelope.data, "base64")), cipher.final()]).toString("utf8")) as Journal;
      if (value.version !== 1 || !Array.isArray(value.segments) || !Array.isArray(value.candidates) ||
          value.segments.length > 256 || value.candidates.length > 64 ||
          !value.segments.every((item) => idPattern.test(item.id) && integer(item.sourceId) && item.sourceId > 0 && integer(item.startMs) && integer(item.endMs) && item.endMs > item.startMs && integer(item.expiresAt)) ||
          !value.candidates.every((item) => idPattern.test(item.id) && integer(item.sourceId) && item.sourceId > 0 && integer(item.startMs) && integer(item.endMs) && item.endMs > item.startMs && integer(item.createdAt) && integer(item.expiresAt) &&
            ["manual", "synthetic", "commissioning"].includes(item.kind) && ["pending", "creating", "ready", "failed", "expired", "deleted"].includes(item.state) &&
            (item.hotId === null || idPattern.test(item.hotId)) && (item.coverage === null || item.coverage === "partial" || item.coverage === "complete") &&
            (item.failure === null || ["moment_ineligible", "moment_missing", "moment_timeout", "moment_mux_failed", "moment_storage_failed"].includes(item.failure)))) throw new Error();
      return value;
    } catch { throw new Error("moment_journal_authentication_failed"); }
  }

  private async save(value: Journal): Promise<void> {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", await this.key(), iv);
    cipher.setAAD(Buffer.from("nightly-hot-moments:1"));
    const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
    const contents = JSON.stringify({ version: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") });
    if (Buffer.byteLength(contents) > 256 * 1024) throw new Error("moment_journal_full");
    const temporary = join(this.directory, `${randomBytes(16).toString("hex")}.tmp`);
    const handle = await open(temporary, "wx", 0o600);
    try { await handle.writeFile(contents); await handle.sync(); } finally { await handle.close(); }
    try {
      await rename(temporary, join(this.directory, "moments.enc"));
      if (process.platform !== "win32") {
        const dir = await open(this.directory, "r");
        try { await dir.sync(); } finally { await dir.close(); }
      }
    } catch (error) { await rm(temporary, { force: true }); throw error; }
  }

  private async eligible(sourceId: number): Promise<boolean> {
    try {
      const { source, policy } = await this.options.resolveCanonical(sourceId);
      return source.sourceId === sourceId && isHotMomentEligible(source, policy);
    } catch { return false; }
  }

  async recover(): Promise<void> {
    await this.serial(async () => {
      const journal = await this.journal();
      const hot = await this.options.storage.list("hot");
      const indexed = new Map(hot.map((record) => [record.id, record]));
      let changed = false;
      for (const candidate of journal.candidates) {
        if (candidate.state !== "creating" && candidate.state !== "ready") continue;
        const record = candidate.hotId ? indexed.get(candidate.hotId) : undefined;
        let valid = false;
        if (record && record.sourceId === candidate.sourceId && record.expiresAt === candidate.expiresAt && candidate.coverage) {
          try {
            const bytes = await this.options.storage.read(record.id);
            valid = createHash("sha256").update(bytes).digest("hex") === record.sha256 && await this.eligible(candidate.sourceId);
          } catch { /* unavailable objects cannot become ready */ }
        }
        if (candidate.state !== (valid ? "ready" : "failed")) changed = true;
        candidate.state = valid ? "ready" : "failed";
        candidate.failure = valid ? null : "moment_storage_failed";
        if (!valid) { candidate.hotId = null; candidate.coverage = null; }
      }
      if (changed) await this.save(journal);
      const referenced = new Set(journal.candidates.filter((item) => item.state === "ready" && item.hotId).map((item) => item.hotId));
      for (const record of hot) if (!referenced.has(record.id)) await this.options.storage.deleteHotMoment(record.id);
      this.recovered = true;
    });
  }

  private async ensureRecovered(): Promise<void> {
    if (!this.recovered) await this.recover();
  }

  async registerSegment(record: MediaRecord, startMs: number, endMs: number): Promise<void> {
    if (record.kind !== "segment" || !idPattern.test(record.id) || !integer(startMs) || !integer(endMs) || endMs <= startMs ||
        !integer(record.sourceId) || record.sourceId < 1 || !integer(record.expiresAt)) throw new Error("moment_segment_invalid");
    await this.serial(async () => {
      const journal = await this.journal();
      const listed = (await this.options.storage.list("segment")).find((item) => item.id === record.id);
      if (!listed || JSON.stringify(listed) !== JSON.stringify(record)) throw new Error("moment_segment_missing");
      const existing = journal.segments.find((item) => item.id === record.id);
      if (existing && (existing.startMs !== startMs || existing.endMs !== endMs)) throw new Error("moment_segment_invalid");
      journal.segments = journal.segments.filter((item) => item.expiresAt > this.now() && item.id !== record.id);
      if (journal.segments.length >= 256) journal.segments.shift();
      journal.segments.push({ id: record.id, sourceId: record.sourceId, startMs, endMs, expiresAt: record.expiresAt });
      await this.save(journal);
    });
  }

  async trigger(sourceId: number, atMs: number, preMs: number, postMs: number, trigger: MomentTrigger): Promise<MomentCandidate> {
    if (!integer(sourceId) || sourceId < 1 || !integer(atMs) || !integer(preMs) || !integer(postMs) ||
        preMs > 30_000 || postMs > 30_000 || preMs > atMs || !integer(atMs + postMs) || !acceptsTrigger(trigger)) throw new Error("moment_trigger_invalid");
    await this.ensureRecovered();
    await this.expire();
    return this.serial(async () => {
      if (!await this.eligible(sourceId)) throw new Error("moment_ineligible");
      const journal = await this.journal();
      journal.candidates = journal.candidates.filter((item) => item.state !== "deleted" && item.state !== "expired");
      if (journal.candidates.length >= 64) throw new Error("moment_candidate_quota");
      const createdAt = this.now();
      const candidate: MomentCandidate = { id: randomBytes(16).toString("hex"), sourceId, kind: trigger.kind, state: "pending", startMs: atMs - preMs,
        endMs: atMs + postMs, createdAt, expiresAt: createdAt + this.ttlMs, coverage: null, hotId: null, failure: null };
      if (candidate.endMs <= candidate.startMs || !integer(candidate.expiresAt)) throw new Error("moment_trigger_invalid");
      journal.candidates.push(candidate);
      await this.save(journal);
      return { ...candidate };
    });
  }

  async get(id: string): Promise<MomentCandidate | null> {
    if (!idPattern.test(id)) throw new Error("moment_id_invalid");
    await this.ensureRecovered();
    return this.serial(async () => {
      const value = (await this.journal()).candidates.find((item) => item.id === id);
      return value ? { ...value, state: value.state !== "deleted" && value.expiresAt <= this.now() ? "expired" : value.state } : null;
    });
  }

  async extract(id: string, signal?: AbortSignal): Promise<MomentCandidate> {
    if (!idPattern.test(id)) throw new Error("moment_id_invalid");
    await this.ensureRecovered();
    const candidate = await this.serial(async () => {
      const journal = await this.journal();
      const value = journal.candidates.find((item) => item.id === id);
      if (!value || value.state === "deleted" || value.state === "ready" || value.expiresAt <= this.now() || value.state === "creating") throw new Error("moment_not_extractable");
      if (!await this.eligible(value.sourceId)) throw new Error("moment_ineligible");
      value.state = "creating";
      value.failure = null;
      await this.save(journal);
      return { ...value };
    });
    let hotId: string | null = null;
    try {
      if (!this.options.muxer) throw new Error("moment_mux_failed");
      const deadline = Date.now() + this.waitMs;
      let selected: TimedSegment[] = [];
      let coverage: MomentCoverage = "partial";
      while (true) {
        if (signal?.aborted) throw new Error("moment_timeout");
        if (!await this.eligible(candidate.sourceId)) throw new Error("moment_ineligible");
        const journal = await this.serial(() => this.journal());
        selected = journal.segments.filter((item) => item.sourceId === candidate.sourceId && item.expiresAt > this.now() && item.startMs < candidate.endMs && item.endMs > candidate.startMs)
          .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs || left.id.localeCompare(right.id));
        let covered = candidate.startMs;
        for (const item of selected) if (item.startMs <= covered) covered = Math.max(covered, item.endMs);
        coverage = covered >= candidate.endMs ? "complete" : "partial";
        if (coverage === "complete" || Date.now() >= deadline) break;
        await new Promise<void>((done) => {
          const timer = setTimeout(finish, Math.min(this.pollMs, deadline - Date.now()));
          function finish() { clearTimeout(timer); signal?.removeEventListener("abort", finish); done(); }
          signal?.addEventListener("abort", finish, { once: true });
        });
      }
      if (signal?.aborted) throw new Error("moment_timeout");
      const inputs: MuxInput[] = [];
      let covered = candidate.startMs;
      for (const item of selected) {
        try {
          const data = await this.options.storage.read(item.id);
          if (data.length > MAX_SEGMENT_BYTES) throw new Error();
          inputs.push({ data, startMs: item.startMs, endMs: item.endMs });
        } catch { continue; }
      }
      if (!inputs.length) throw new Error("moment_missing");
      for (const item of inputs) if (item.startMs <= covered) covered = Math.max(covered, item.endMs);
      coverage = covered >= candidate.endMs ? "complete" : "partial";
      if (!await this.eligible(candidate.sourceId)) throw new Error("moment_ineligible");
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal?.addEventListener("abort", abort, { once: true });
      let timer: ReturnType<typeof setTimeout> | undefined;
      let rejectAbort: (() => void) | undefined;
      const abortMux = () => { controller.abort(); rejectAbort?.(); };
      try {
        signal?.addEventListener("abort", abortMux, { once: true });
        const clip = await Promise.race([
          (async () => {
            const output = await this.options.muxer!.mux(inputs, { startMs: candidate.startMs, endMs: candidate.endMs }, controller.signal);
            if (!Buffer.isBuffer(output) || !output.length || output.length > MAX_SEGMENT_BYTES || !await this.options.muxer!.validate(output)) throw new Error("moment_mux_failed");
            return output;
          })(),
          new Promise<never>((_, reject) => {
            rejectAbort = () => reject(new Error("moment_timeout"));
            timer = setTimeout(abortMux, this.muxMs);
            if (signal?.aborted) abortMux();
          }),
        ]);
        if (controller.signal.aborted) throw new Error("moment_timeout");
        if (signal?.aborted) throw new Error("moment_timeout");
        if (!await this.eligible(candidate.sourceId)) throw new Error("moment_ineligible");
        let hot: MediaRecord;
        try { hot = await this.options.storage.createHotMoment(candidate.sourceId, clip, candidate.expiresAt); }
        catch { throw new Error("moment_storage_failed"); }
        hotId = hot.id;
        await this.serial(async () => {
          const journal = await this.journal();
          const value = journal.candidates.find((item) => item.id === id);
          if (!value || value.state !== "creating") throw new Error("moment_storage_failed");
          value.hotId = hot.id; value.coverage = coverage;
          await this.save(journal);
        });
        try {
          const verified = await this.options.storage.read(hot.id);
          if (!verified.equals(clip) || createHash("sha256").update(verified).digest("hex") !== hot.sha256) throw new Error();
        } catch { throw new Error("moment_storage_failed"); }
        if (signal?.aborted) throw new Error("moment_timeout");
        if (!await this.eligible(candidate.sourceId)) throw new Error("moment_ineligible");
        return await this.serial(async () => {
          const journal = await this.journal();
          const value = journal.candidates.find((item) => item.id === id)!;
          if (value.state !== "creating" || value.expiresAt <= this.now()) throw new Error("moment_storage_failed");
          value.state = "ready"; value.hotId = hot.id; value.coverage = coverage; value.failure = null;
          await this.save(journal);
          hotId = null;
          return { ...value };
        });
      } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); signal?.removeEventListener("abort", abortMux); }
    } catch (error) {
      if (hotId) await this.options.storage.deleteHotMoment(hotId).catch(() => undefined);
      const code = error instanceof Error && ["moment_ineligible", "moment_missing", "moment_timeout", "moment_storage_failed"].includes(error.message) ? error.message : "moment_mux_failed";
      await this.serial(async () => {
        const journal = await this.journal();
        const value = journal.candidates.find((item) => item.id === id);
        if (value && value.state === "creating") { value.state = "failed"; value.hotId = null; value.coverage = null; value.failure = code; await this.save(journal); }
      });
      throw new Error(code);
    }
  }

  async delete(id: string): Promise<void> {
    if (!idPattern.test(id)) throw new Error("moment_id_invalid");
    await this.ensureRecovered();
    await this.serial(async () => {
      const journal = await this.journal();
      const value = journal.candidates.find((item) => item.id === id);
      if (!value || value.state === "deleted") return;
      if (value.state === "creating") throw new Error("moment_busy");
      if (value.hotId) {
        const exists = (await this.options.storage.list("hot")).some((item) => item.id === value.hotId);
        if (exists) await this.options.storage.deleteHotMoment(value.hotId);
      }
      value.state = "deleted"; value.hotId = null;
      await this.save(journal);
    });
  }

  async expire(): Promise<void> {
    await this.ensureRecovered();
    const journal = await this.serial(() => this.journal());
    for (const item of journal.candidates) if (item.state !== "deleted" && item.state !== "creating" && item.expiresAt <= this.now()) {
      await this.delete(item.id);
      await this.serial(async () => {
        const latest = await this.journal();
        const value = latest.candidates.find((entry) => entry.id === item.id)!;
        value.state = "expired";
        await this.save(latest);
      });
    }
  }
}