import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmod, mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { AgentCredentials } from "./types";

export interface CredentialStore {
  load(): Promise<AgentCredentials | null>;
  save(credentials: AgentCredentials): Promise<void>;
  clear(): Promise<void>;
}

export class EncryptedFileCredentialStore implements CredentialStore {
  constructor(private readonly filePath: string, private readonly key: Buffer) {
    if (key.length !== 32) throw new Error("Credential encryption key must be 32 bytes.");
  }

  async load(): Promise<AgentCredentials | null> {
    let envelope: { version: number; iv: string; tag: string; ciphertext: string };
    try { envelope = JSON.parse(await readFile(this.filePath, "utf8")) as typeof envelope; } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw new Error("Encrypted credential store is corrupt.");
    }
    if (envelope.version !== 1) throw new Error("Encrypted credential store version is unsupported.");
    try {
      const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(envelope.iv, "base64"));
      decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
      const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]).toString("utf8");
      const value = JSON.parse(plaintext) as AgentCredentials;
      if (typeof value.deviceSecret !== "string" || value.deviceSecret.length < 32) throw new Error("bad credentials");
      return value;
    } catch {
      throw new Error("Encrypted credential store could not be authenticated.");
    }
  }

  async save(credentials: AgentCredentials) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(credentials)), cipher.final()]);
    const envelope = JSON.stringify({ version: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") });
    await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
    const tempPath = `${this.filePath}.${randomUUID()}.tmp`;
    const handle = await open(tempPath, "wx", 0o600);
    try { await handle.writeFile(envelope); await handle.sync(); } finally { await handle.close(); }
    await rename(tempPath, this.filePath);
    if (process.platform !== "win32") await chmod(this.filePath, 0o600);
  }

  async clear() {
    await rm(this.filePath, { force: true });
  }
}

export async function loadEncryptionKey(path: string): Promise<Buffer> {
  const info = await stat(path);
  if (process.platform === "linux" && (info.mode & 0o077) !== 0) throw new Error("Credential key file permissions must be 0600.");
  const raw = (await readFile(path, "utf8")).trim();
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("Credential key file must contain a base64-encoded 32-byte key.");
  return key;
}

export class TpmCredentialStore implements CredentialStore {
  constructor(private readonly available: () => Promise<boolean>) {}
  async load(): Promise<AgentCredentials | null> { if (!await this.available()) throw new Error("TPM credential storage NOT_AVAILABLE."); throw new Error("TPM-backed secret sealing is not implemented; refusing insecure fallback."); }
  async save(_credentials: AgentCredentials): Promise<void> { if (!await this.available()) throw new Error("TPM credential storage NOT_AVAILABLE."); throw new Error("TPM-backed secret sealing is not implemented; refusing insecure fallback."); }
  async clear(): Promise<void> { if (!await this.available()) throw new Error("TPM credential storage NOT_AVAILABLE."); throw new Error("TPM-backed secret sealing is not implemented; refusing insecure fallback."); }
}