import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, open, readdir, readFile, rename, rm, statfs } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadEncryptionKey } from "../core/credential-store";

export const MAX_SEGMENT_BYTES = 8 * 1024 * 1024;
type Kind = "segment" | "hot";
export type MediaRecord = { id: string; kind: Kind; sourceId: number; createdAt: number; expiresAt: number; bytes: number; sha256: string };
type Payload = { record: MediaRecord; data: string };
type Envelope = { version: number; keyVersion: number; iv: string; tag: string; ciphertext: string };
export type RecoveryReport = { orphanTemps: number; missing: number; corrupt: number; orphans: number; expired: number };

export type MediaStorageOptions = {
  directory: string;
  keyProvider: () => Promise<Buffer>;
  filesystem?: { open?: typeof open; rename?: typeof rename; rm?: typeof rm };
  keyVersion?: number;
  now?: () => number;
  maxAgeMs?: number;
  maxBytes?: number;
  maxCount?: number;
  maxSourceBytes?: number;
  diskReserveBytes?: number;
  maxHotBytes?: number;
  maxHotCount?: number;
  maxHotAgeMs?: number;
};

const idPattern = /^[0-9a-f]{32}$/;
const indexName = "index.enc";
const MAX_INDEX_BYTES = 256 * 1024;

export function systemdMediaKeyProvider(credentialsDirectory = process.env.CREDENTIALS_DIRECTORY): () => Promise<Buffer> {
  return async () => {
    if (!credentialsDirectory) throw new Error("Systemd credential key is unavailable.");
    return loadEncryptionKey(join(credentialsDirectory, "credential-key"));
  };
}

export class EncryptedMediaStorage {
  private readonly directory: string;
  private readonly options: Required<Omit<MediaStorageOptions, "directory" | "keyProvider" | "filesystem">>;
  private pending: Promise<unknown> = Promise.resolve();

  constructor(private readonly config: MediaStorageOptions) {
    if (!config.keyProvider) throw new Error("A secure media key provider is required.");
    this.directory = resolve(config.directory);
    this.options = {
      keyVersion: config.keyVersion ?? 1,
      now: config.now ?? Date.now,
      maxAgeMs: config.maxAgeMs ?? 5 * 60_000,
      maxBytes: config.maxBytes ?? 256 * 1024 * 1024,
      maxCount: config.maxCount ?? 256,
      maxSourceBytes: config.maxSourceBytes ?? 64 * 1024 * 1024,
      diskReserveBytes: config.diskReserveBytes ?? 128 * 1024 * 1024,
      maxHotBytes: config.maxHotBytes ?? 64 * 1024 * 1024,
      maxHotCount: config.maxHotCount ?? 16,
      maxHotAgeMs: config.maxHotAgeMs ?? 60 * 60_000,
    };
    for (const [name, value] of Object.entries(this.options)) {
      if (name === "now") continue;
      if (typeof value !== "number" || !Number.isSafeInteger(value) || (name === "diskReserveBytes" ? value < 0 : value <= 0)) throw new Error(`Invalid media limit: ${name}`);
    }
  }

  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.pending.then(operation);
    this.pending = result.catch(() => undefined);
    return result;
  }

  private async key(): Promise<Buffer> {
    const key = await this.config.keyProvider();
    if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error("Secure media key is unavailable or invalid.");
    return key;
  }

  private async prepare() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const info = await lstat(this.directory);
    if (!info.isDirectory() || info.isSymbolicLink() || (process.platform === "linux" && (info.mode & 0o077) !== 0)) {
      throw new Error("Media directory must be a private real directory.");
    }
  }

  private path(name: string): string {
    if (name !== indexName && !new RegExp(`^${idPattern.source.slice(1, -1)}\\.enc$`).test(name)) throw new Error("Invalid media path.");
    return join(this.directory, name);
  }

  private async readRegular(name: string): Promise<Buffer> {
    const path = this.path(name);
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error("Media path is not a regular file.");
    return readFile(path);
  }

  private seal(key: Buffer, domain: string, value: unknown): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from(`nightly-media:${domain}:1:${this.options.keyVersion}`));
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
    return Buffer.from(JSON.stringify({ version: 1, keyVersion: this.options.keyVersion, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") } satisfies Envelope));
  }

  private unseal(key: Buffer, domain: string, raw: Buffer): unknown {
    try {
      const envelope = JSON.parse(raw.toString("utf8")) as Envelope;
      if (envelope.version !== 1 || envelope.keyVersion !== this.options.keyVersion ||
          typeof envelope.iv !== "string" || typeof envelope.tag !== "string" || typeof envelope.ciphertext !== "string") throw new Error("version");
      const iv = Buffer.from(envelope.iv, "base64");
      const tag = Buffer.from(envelope.tag, "base64");
      if (iv.length !== 12 || tag.length !== 16) throw new Error("envelope");
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAAD(Buffer.from(`nightly-media:${domain}:1:${envelope.keyVersion}`));
      decipher.setAuthTag(tag);
      return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]).toString("utf8"));
    } catch {
      throw new Error("Media authentication failed or key version unavailable.");
    }
  }

  private async durableWrite(name: string, contents: Buffer) {
    const destination = this.path(name);
    const temporary = join(this.directory, `${randomUUID()}.tmp`);
    let handle;
    try { handle = await (this.config.filesystem?.open ?? open)(temporary, "wx", 0o600); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") await rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
    try {
      await handle.writeFile(contents);
      await handle.sync();
      await handle.close();
      await (this.config.filesystem?.rename ?? rename)(temporary, destination);
      if (process.platform !== "win32") await chmod(destination, 0o600);
      await this.syncDirectory();
    } catch (error) {
      await handle.close().catch(() => undefined);
      await rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  private async syncDirectory() {
    if (process.platform === "win32") return;
    const handle = await open(this.directory, "r");
    try { await handle.sync(); } finally { await handle.close(); }
  }

  private validRecord(value: unknown, filename?: string): value is MediaRecord {
    if (!value || typeof value !== "object") return false;
    const record = value as MediaRecord;
    return Object.keys(record).sort().join(",") === "bytes,createdAt,expiresAt,id,kind,sha256,sourceId" &&
      typeof record.id === "string" && idPattern.test(record.id) && (!filename || filename === `${record.id}.enc`) &&
      (record.kind === "segment" || record.kind === "hot") && Number.isSafeInteger(record.sourceId) && record.sourceId > 0 &&
      Number.isSafeInteger(record.createdAt) && record.createdAt >= 0 && Number.isSafeInteger(record.expiresAt) && record.expiresAt > record.createdAt &&
      record.expiresAt - record.createdAt <= (record.kind === "hot" ? this.options.maxHotAgeMs : this.options.maxAgeMs) &&
      Number.isSafeInteger(record.bytes) && record.bytes >= 0 && record.bytes <= MAX_SEGMENT_BYTES &&
      typeof record.sha256 === "string" && /^[0-9a-f]{64}$/.test(record.sha256);
  }

  private async payload(key: Buffer, name: string): Promise<{ record: MediaRecord; data: Buffer }> {
    const decoded = this.unseal(key, "payload", await this.readRegular(name)) as Payload;
    if (!decoded || !this.validRecord(decoded.record, name) || typeof decoded.data !== "string") throw new Error("Invalid media payload.");
    const data = Buffer.from(decoded.data, "base64");
    if (data.length !== decoded.record.bytes || createHash("sha256").update(data).digest("hex") !== decoded.record.sha256) throw new Error("Media integrity check failed.");
    return { record: decoded.record, data };
  }

  private async index(key: Buffer): Promise<MediaRecord[]> {
    let raw: Buffer;
    try { raw = await this.readRegular(indexName); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    if (raw.length > MAX_INDEX_BYTES) throw new Error("Invalid media index.");
    const entries = this.unseal(key, "index", raw);
    if (!Array.isArray(entries) || entries.length > 100_000 || !entries.every((entry) => this.validRecord(entry)) ||
        new Set(entries.map((entry: MediaRecord) => entry.id)).size !== entries.length) throw new Error("Invalid media index.");
    return entries;
  }

  private async saveIndex(key: Buffer, entries: MediaRecord[]) {
    const contents = this.seal(key, "index", entries);
    if (contents.length > MAX_INDEX_BYTES) throw new Error("Media index full.");
    await this.durableWrite(indexName, contents);
  }

  private async freeSpace(bytes: number) {
    const stats = await statfs(this.directory, { bigint: true });
    if (stats.bavail * stats.bsize - BigInt(bytes) < BigInt(this.options.diskReserveBytes)) throw new Error("Media disk reserve would be breached.");
  }

  private async prune(key: Buffer, entries: MediaRecord[], now: number): Promise<{ entries: MediaRecord[]; expired: number }> {
    const retained: MediaRecord[] = [];
    let expired = 0;
    for (const entry of entries) {
      if (entry.expiresAt <= now) {
        await rm(this.path(`${entry.id}.enc`), { force: true });
        expired++;
      } else retained.push(entry);
    }
    if (expired) { await this.syncDirectory(); await this.saveIndex(key, retained); }
    return { entries: retained, expired };
  }

  async appendSegment(sourceId: number, data: Buffer, createdAt = this.options.now()): Promise<MediaRecord> {
    return this.add("segment", sourceId, data, createdAt, createdAt + this.options.maxAgeMs);
  }

  async createHotMoment(sourceId: number, data: Buffer, expiresAt: number): Promise<MediaRecord> {
    return this.add("hot", sourceId, data, this.options.now(), expiresAt);
  }

  private add(kind: Kind, sourceId: number, data: Buffer, createdAt: number, expiresAt: number): Promise<MediaRecord> {
    return this.serial(async () => {
        if (!Number.isSafeInteger(sourceId) || sourceId <= 0 || !Buffer.isBuffer(data) || data.length > MAX_SEGMENT_BYTES ||
          !Number.isSafeInteger(createdAt) || createdAt < 0 || !Number.isSafeInteger(expiresAt) || createdAt > this.options.now() ||
          expiresAt <= this.options.now() || expiresAt <= createdAt ||
          expiresAt - createdAt > (kind === "hot" ? this.options.maxHotAgeMs : this.options.maxAgeMs)) throw new Error("Invalid media segment or expiration.");
      await this.prepare();
      const key = await this.key();
      const current = await this.index(key);
      const now = this.options.now();
      const record: MediaRecord = { id: randomBytes(16).toString("hex"), kind, sourceId, createdAt, expiresAt, bytes: data.length, sha256: createHash("sha256").update(data).digest("hex") };
      const encoded = this.seal(key, "payload", { record, data: data.toString("base64") } satisfies Payload);
      await this.freeSpace(encoded.length + 4096);
      let entries = current.filter((entry) => entry.expiresAt > now);
      const evicted = current.filter((entry) => entry.expiresAt <= now);
      if (kind === "hot") {
        const hot = entries.filter((entry) => entry.kind === "hot");
        if (hot.length >= this.options.maxHotCount || hot.reduce((sum, entry) => sum + entry.bytes, 0) + data.length > this.options.maxHotBytes) throw new Error("Protected Hot Moment quota exceeded.");
      } else {
        const rolling = entries.filter((entry) => entry.kind === "segment").sort((left, right) => left.createdAt - right.createdAt);
        if (data.length > this.options.maxBytes || data.length > this.options.maxSourceBytes) throw new Error("Media segment exceeds rolling quota.");
        while (rolling.length && (rolling.length >= this.options.maxCount || rolling.reduce((sum, entry) => sum + entry.bytes, 0) + data.length > this.options.maxBytes ||
          rolling.filter((entry) => entry.sourceId === sourceId).reduce((sum, entry) => sum + entry.bytes, 0) + data.length > this.options.maxSourceBytes)) {
          const oldest = rolling.shift()!;
          evicted.push(oldest);
          entries = entries.filter((entry) => entry.id !== oldest.id);
        }
      }
      if (this.seal(key, "index", [...entries, record]).length > MAX_INDEX_BYTES) throw new Error("Media index full.");
      try {
        await this.durableWrite(`${record.id}.enc`, encoded);
        await this.saveIndex(key, [...entries, record]);
      } catch (error) {
        // An index rename may have succeeded even if its directory sync failed.
        let committed = false;
        try { committed = (await this.index(key)).some((entry) => entry.id === record.id); }
        catch { throw error; }
        if (!committed) {
          await rm(this.path(`${record.id}.enc`), { force: true }).catch(() => undefined);
          await this.syncDirectory().catch(() => undefined);
          throw error;
        }
      }
      for (const oldest of evicted) {
        await (this.config.filesystem?.rm ?? rm)(this.path(`${oldest.id}.enc`), { force: true }).catch(() => undefined);
      }
      if (evicted.length) await this.syncDirectory().catch(() => undefined);
      return record;
    });
  }

  async read(id: string): Promise<Buffer> {
    return this.serial(async () => {
      if (!idPattern.test(id)) throw new Error("Invalid media id.");
      await this.prepare();
      const key = await this.key();
      const entry = (await this.index(key)).find((record) => record.id === id);
      if (!entry || entry.expiresAt <= this.options.now()) throw new Error("Media object not available.");
      const result = await this.payload(key, `${id}.enc`);
      if (JSON.stringify(result.record) !== JSON.stringify(entry)) throw new Error("Media index integrity check failed.");
      return result.data;
    });
  }

  async list(kind?: Kind): Promise<MediaRecord[]> {
    return this.serial(async () => {
      await this.prepare();
      const key = await this.key();
      return (await this.prune(key, await this.index(key), this.options.now())).entries.filter((entry) => !kind || entry.kind === kind);
    });
  }

  async deleteHotMoment(id: string): Promise<void> {
    return this.serial(async () => {
      if (!idPattern.test(id)) throw new Error("Invalid media id.");
      await this.prepare();
      const key = await this.key();
      const entries = await this.index(key);
      if (!entries.some((entry) => entry.id === id && entry.kind === "hot")) return;
      await rm(this.path(`${id}.enc`), { force: true });
      await this.syncDirectory();
      await this.saveIndex(key, entries.filter((entry) => entry.id !== id));
    });
  }

  async recover(): Promise<RecoveryReport> {
    return this.serial(async () => {
      await this.prepare();
      const key = await this.key();
      const report: RecoveryReport = { orphanTemps: 0, missing: 0, corrupt: 0, orphans: 0, expired: 0 };
      const indexed = await this.index(key);
      const names = await readdir(this.directory);
      if (!names.includes(indexName) && names.some((name) => /^[0-9a-f]{32}\.enc$/.test(name))) throw new Error("Media recovery requires an authenticated index.");
      const found = new Map<string, MediaRecord>();
      const corruptNames: string[] = [];
      for (const name of names) {
        if (/^[0-9a-f-]{36}\.tmp$/.test(name)) {
          await rm(join(this.directory, name), { force: true });
          report.orphanTemps++;
        } else if (/^[0-9a-f]{32}\.enc$/.test(name)) {
          try {
            const { record } = await this.payload(key, name);
            found.set(record.id, record);
          } catch {
            corruptNames.push(name);
          }
        }
      }
      for (const name of corruptNames) {
        await rm(this.path(name), { force: true });
        report.corrupt++;
      }
      const known = new Map(indexed.map((entry) => [entry.id, entry]));
      for (const entry of indexed) {
        const actual = found.get(entry.id);
        if (!actual || JSON.stringify(actual) !== JSON.stringify(entry)) {
          report.missing++;
          if (actual) { await rm(this.path(`${entry.id}.enc`), { force: true }); found.delete(entry.id); report.corrupt++; }
        }
      }
      for (const id of found.keys()) if (!known.has(id)) {
        await rm(this.path(`${id}.enc`), { force: true });
        found.delete(id);
        report.orphans++;
      }
      await this.syncDirectory();
      const { entries, expired } = await this.prune(key, indexed.filter((entry) => found.has(entry.id)), this.options.now());
      report.expired = expired;
      const rolling = entries.filter((entry) => entry.kind === "segment").sort((left, right) => left.createdAt - right.createdAt);
      let retained = [...entries];
      while (rolling.length && (rolling.length > this.options.maxCount || rolling.reduce((sum, entry) => sum + entry.bytes, 0) > this.options.maxBytes ||
        rolling.some((entry) => rolling.filter((item) => item.sourceId === entry.sourceId).reduce((sum, item) => sum + item.bytes, 0) > this.options.maxSourceBytes))) {
        const oldest = rolling.shift()!;
        await rm(this.path(`${oldest.id}.enc`), { force: true });
        retained = retained.filter((entry) => entry.id !== oldest.id);
      }
      await this.syncDirectory();
      await this.saveIndex(key, retained);
      return report;
    });
  }
}