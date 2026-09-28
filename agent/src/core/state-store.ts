import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AgentPersistentState } from "./types";

const MAX_STATE_BYTES = 64 * 1024;

export interface AgentStateStore {
  load(): Promise<AgentPersistentState | null>;
  save(state: AgentPersistentState): Promise<void>;
}

export class FileAgentStateStore implements AgentStateStore {
  readonly filePath: string;

  constructor(directory: string) {
    this.filePath = join(directory, "agent-state.json");
  }

  async load(): Promise<AgentPersistentState | null> {
    let buffer: Buffer;
    try { buffer = await readFile(this.filePath); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
    if (buffer.byteLength > MAX_STATE_BYTES) return this.#quarantine();
    try {
      const parsed = JSON.parse(buffer.toString("utf8")) as AgentPersistentState;
      if (parsed.schemaVersion !== 1 || typeof parsed.agentState !== "string" || typeof parsed.agentVersion !== "string") return this.#quarantine();
      return parsed;
    } catch {
      return this.#quarantine();
    }
  }

  async save(state: AgentPersistentState) {
    await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
    const tempPath = `${this.filePath}.${randomUUID()}.tmp`;
    const handle = await open(tempPath, "wx", 0o600);
    try {
      await handle.writeFile(JSON.stringify(state));
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(tempPath, this.filePath);
  }

  async #quarantine(): Promise<null> {
    const path = `${this.filePath}.corrupt-${Date.now()}`;
    await rename(this.filePath, path).catch(() => undefined);
    const directory = dirname(this.filePath);
    const entries = (await import("node:fs/promises")).readdir;
    const names = (await entries(directory)).filter((name) => name.startsWith("agent-state.json.corrupt-")).sort().reverse();
    for (const stale of names.slice(2)) await rm(join(directory, stale), { force: true });
    return null;
  }
}