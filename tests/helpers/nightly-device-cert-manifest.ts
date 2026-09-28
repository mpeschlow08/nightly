import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type CertificationManifest = {
  schemaVersion: 1;
  runId: string;
  fixturePrefix: string;
  createdAt: string;
  deviceIds: number[];
  sessionIds: string[];
  pendingSessionUserId: string | null;
  pendingSessionSince: string | null;
};

export class CertificationManifestStore {
  readonly directory = join(tmpdir(), "nightly-device-api-certification");
  readonly path: string;
  readonly value: CertificationManifest;

  private constructor(runId: string, fixturePrefix: string) {
    this.path = join(this.directory, `${runId}.json`);
    this.value = {
      schemaVersion: 1,
      runId,
      fixturePrefix,
      createdAt: new Date().toISOString(),
      deviceIds: [],
      sessionIds: [],
      pendingSessionUserId: null,
      pendingSessionSince: null,
    };
  }

  static async create() {
    const runId = `${Date.now()}-${randomUUID()}`;
    const store = new CertificationManifestStore(runId, `NIGHTLY-SPRINT2-CERT-${runId}`);
    await store.save();
    return store;
  }

  static async read(path: string): Promise<CertificationManifest> {
    const value = JSON.parse(await readFile(path, "utf8")) as CertificationManifest;
    if (value.schemaVersion !== 1 || !/^[0-9]+-[0-9a-f-]{36}$/i.test(value.runId) || value.fixturePrefix !== `NIGHTLY-SPRINT2-CERT-${value.runId}` || !Array.isArray(value.deviceIds) || !value.deviceIds.every((id) => Number.isSafeInteger(id) && id > 0) || !Array.isArray(value.sessionIds) || !value.sessionIds.every((id) => typeof id === "string" && /^sess_[A-Za-z0-9]+$/.test(id))) {
      throw new Error("Certification manifest failed validation.");
    }
    return value;
  }

  async save() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const tempPath = `${this.path}.${randomUUID()}.tmp`;
    const file = await open(tempPath, "wx", 0o600);
    try { await file.writeFile(JSON.stringify(this.value)); await file.sync(); } finally { await file.close(); }
    await rename(tempPath, this.path);
  }

  async beginSession(userId: string) {
    this.value.pendingSessionUserId = userId;
    this.value.pendingSessionSince = new Date().toISOString();
    await this.save();
  }

  async recordDevice(deviceId: number) {
    if (!Number.isSafeInteger(deviceId) || deviceId <= 0) throw new Error("Certification device ID is invalid.");
    if (!this.value.deviceIds.includes(deviceId)) this.value.deviceIds.push(deviceId);
    await this.save();
  }

  async recordSession(sessionId: string) {
    if (!/^sess_[A-Za-z0-9]+$/.test(sessionId)) throw new Error("Clerk returned an invalid session identifier.");
    this.value.sessionIds.push(sessionId);
    this.value.pendingSessionUserId = null;
    this.value.pendingSessionSince = null;
    await this.save();
  }

  async remove() {
    await rm(this.path, { force: true });
  }
}