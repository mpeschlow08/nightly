import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type CertificationStatus = "RUNNING" | "PASS" | "FAIL" | "TIMEOUT";
export type CleanupStatus = "NOT_RUN" | "PASS" | "FAIL";

export type CertificationStageRecord = {
  name: string;
  status: "PASS" | "FAIL" | "TIMEOUT";
  durationMs: number;
};

export type CertificationResult = {
  schemaVersion: 1;
  runId: string;
  startedAt: string;
  completedAt: string | null;
  developmentIdentityVerified: boolean;
  status: CertificationStatus;
  failedStage: string | null;
  stages: CertificationStageRecord[];
  databaseCleanup: { status: CleanupStatus; remainingFixtures: number | null };
  clerkCleanup: { status: CleanupStatus; remainingKnownSessions: number | null };
};

const resultDirectory = join(tmpdir(), "nightly-device-api-certification");
const allowedName = /^[a-z][a-z0-9._-]{0,119}$/;
const maxStageNameLength = 120;

export function normalizeCertificationStageName(input: string): string {
  const original = typeof input === "string" ? input : "unknown";
  let source = original.trim();
  let changed = source !== original;
  let sequence = "";

  if (/^https?:\/\//i.test(source)) {
    try {
      const url = new URL(source);
      source = `http.${url.pathname}`;
      changed = true;
    } catch {
      source = "invalid.url";
      changed = true;
    }
  }

  const sequenceMatch = source.match(/#(\d{1,8})$/);
  if (sequenceMatch) sequence = sequenceMatch[1]!;
  if (source.includes("?") || (source.includes("#") && !sequenceMatch)) changed = true;
  source = source.split("?")[0]!.split("#")[0]!;

  const sensitive = /(?:bearer\s+[^\s,;]+|(?:database[_-]?url|authorization|cookie|set-cookie|access[_-]?token|refresh[_-]?token|session[_-]?token|bootstrap[_-]?(?:token|secret)|password|passphrase|credential|api[_-]?key|token|secret)\s*[=:]\s*[^\s,;]+)/gi;
  if (sensitive.test(source)) changed = true;
  source = source.replace(sensitive, "redacted");
  const credentialedUrl = /(?:postgres(?:ql)?|rtsp|rtsps):\/\/[^\s,;]+/gi;
  if (credentialedUrl.test(source)) changed = true;
  source = source.replace(credentialedUrl, "redacted.url");
  source = source.replace(/\b(?:bearer|authorization|cookie|set-cookie|access[_-]?token|refresh[_-]?token|session[_-]?token|bootstrap[_-]?(?:token|secret)|password|passphrase|credential|api[_-]?key)\b/gi, "redacted");
  if (/[A-Za-z0-9_-]{32,}/.test(source)) {
    source = source.replace(/[A-Za-z0-9_-]{32,}/g, "value");
    changed = true;
  }

  const normalized = source.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").replace(/\.{2,}/g, ".") || "stage";
  if (normalized !== source.toLowerCase()) changed = true;
  const readable = sequence ? `${normalized}.${sequence}` : normalized;
  const suffix = changed || readable.length > maxStageNameLength
    ? `.${createHash("sha256").update(original).digest("hex").slice(0, 12)}`
    : "";
  const prefix = readable.slice(0, maxStageNameLength - suffix.length);
  return `${prefix.replace(/[._-]+$/g, "")}${suffix}`;
}

export class CertificationResultStore {
  readonly path: string;
  readonly value: CertificationResult;
  #terminal = false;

  private constructor(readonly runId: string, directory: string) {
    this.path = join(directory, `${runId}-result.json`);
    this.value = {
      schemaVersion: 1,
      runId,
      startedAt: new Date().toISOString(),
      completedAt: null,
      developmentIdentityVerified: false,
      status: "RUNNING",
      failedStage: null,
      stages: [],
      databaseCleanup: { status: "NOT_RUN", remainingFixtures: null },
      clerkCleanup: { status: "NOT_RUN", remainingKnownSessions: null },
    };
  }

  static async create(runId: string, directory = resultDirectory) {
    if (!/^[0-9]+-[0-9a-f-]{36}$/i.test(runId)) throw new Error("Certification result run ID is invalid.");
    const store = new CertificationResultStore(runId, directory);
    await store.write();
    return store;
  }

  async write() {
    await mkdir(join(this.path, ".."), { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.path}.${randomUUID()}.tmp`;
    const handle = await open(temporaryPath, "wx", 0o600);
    try { await handle.writeFile(JSON.stringify(this.value)); await handle.sync(); } finally { await handle.close(); }
    await rename(temporaryPath, this.path);
  }

  async stage(name: string, status: CertificationStageRecord["status"], durationMs: number) {
    const safeName = normalizeCertificationStageName(name);
    this.#validateName(safeName);
    this.value.stages.push({ name: safeName, status, durationMs: Math.max(0, Math.floor(durationMs)) });
    if (status !== "PASS" && this.value.failedStage === null) this.value.failedStage = name;
    await this.write();
  }

  async setDevelopmentIdentityVerified(value: boolean) {
    this.value.developmentIdentityVerified = value;
    await this.write();
  }

  async setDatabaseCleanup(status: CleanupStatus, remainingFixtures: number | null) {
    this.value.databaseCleanup = { status, remainingFixtures };
    await this.write();
  }

  async setClerkCleanup(status: CleanupStatus, remainingKnownSessions: number | null) {
    this.value.clerkCleanup = { status, remainingKnownSessions };
    await this.write();
  }

  async finish(status: Exclude<CertificationStatus, "RUNNING">, failedStage?: string | null) {
    if (this.#terminal) return;
    const safeFailedStage = failedStage ? normalizeCertificationStageName(failedStage) : null;
    if (safeFailedStage) this.#validateName(safeFailedStage);
    this.#terminal = true;
    this.value.status = status;
    this.value.failedStage = safeFailedStage ?? this.value.failedStage;
    this.value.completedAt = new Date().toISOString();
    await this.write();
  }

  async read(): Promise<CertificationResult> {
    const parsed = JSON.parse(await readFile(this.path, "utf8")) as CertificationResult;
    validateCertificationResult(parsed);
    return parsed;
  }

  #validateName(name: string) {
    if (!allowedName.test(name)) throw new Error("Certification result stage name is invalid.");
  }
}

export function validateCertificationResult(value: CertificationResult) {
  if (value.schemaVersion !== 1 || !/^[0-9]+-[0-9a-f-]{36}$/i.test(value.runId) ||
      !["RUNNING", "PASS", "FAIL", "TIMEOUT"].includes(value.status) ||
      !Array.isArray(value.stages) || !value.stages.every((stage) => allowedName.test(stage.name) && ["PASS", "FAIL", "TIMEOUT"].includes(stage.status) && Number.isFinite(stage.durationMs) && stage.durationMs >= 0) ||
      !["NOT_RUN", "PASS", "FAIL"].includes(value.databaseCleanup.status) ||
      !["NOT_RUN", "PASS", "FAIL"].includes(value.clerkCleanup.status)) throw new Error("Certification result artifact is invalid.");
  return true;
}