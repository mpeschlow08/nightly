import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type HotReelQueueStatus = "queued" | "running" | "retrying" | "failed" | "done";

export type HotReelQueueItem = {
  id: string;
  hotMomentId: string;
  status: HotReelQueueStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  updatedAt: number;
  nextAttemptAt: number;
  lastError: string | null;
  payload: Record<string, unknown>;
};

export type HotReelQueueState = {
  items: HotReelQueueItem[];
};

export class HotReelUploadQueue {
  constructor(private readonly statePath: string, private readonly maxAttempts = 4) {}

  private readState(): HotReelQueueState {
    if (!existsSync(this.statePath)) {
      return { items: [] };
    }

    try {
      const raw = readFileSync(this.statePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<HotReelQueueState>;
      return { items: Array.isArray(parsed.items) ? parsed.items as HotReelQueueItem[] : [] };
    } catch {
      return { items: [] };
    }
  }

  private writeState(state: HotReelQueueState) {
    mkdirSync(dirname(this.statePath), { recursive: true });
    writeFileSync(this.statePath, JSON.stringify(state, null, 2), "utf8");
  }

  enqueue(payload: Record<string, unknown>): HotReelQueueItem {
    const now = Date.now();
    const state = this.readState();
    const hotMomentId = String(payload.hotMomentId ?? "hot-moment");
    const item: HotReelQueueItem = {
      id: `hot-reel-${hotMomentId}-${now}-${state.items.length}`,
      hotMomentId,
      status: "queued",
      attempts: 0,
      maxAttempts: this.maxAttempts,
      createdAt: now,
      updatedAt: now,
      nextAttemptAt: now,
      lastError: null,
      payload,
    };

    state.items.push(item);
    this.writeState(state);
    return item;
  }

  listPending(now = Date.now()): HotReelQueueItem[] {
    return this.readState().items.filter((item) => item.status !== "done" && item.status !== "failed" && item.nextAttemptAt <= now);
  }

  claimNext(now = Date.now()): HotReelQueueItem | null {
    const state = this.readState();
    const candidate = state.items.find((item) => item.status !== "done" && item.status !== "failed" && item.nextAttemptAt <= now);
    if (!candidate) return null;

    candidate.status = "running";
    candidate.updatedAt = now;
    this.writeState(state);
    return candidate;
  }

  markCompleted(id: string, now = Date.now()) {
    const state = this.readState();
    const item = state.items.find((entry) => entry.id === id);
    if (!item) return false;

    item.status = "done";
    item.updatedAt = now;
    item.nextAttemptAt = now;
    item.lastError = null;
    this.writeState(state);
    return true;
  }

  markRetry(id: string, error: unknown, now = Date.now(), delayMs = 60_000) {
    const state = this.readState();
    const item = state.items.find((entry) => entry.id === id);
    if (!item) return false;

    item.attempts += 1;
    item.status = item.attempts >= item.maxAttempts ? "failed" : "retrying";
    item.updatedAt = now;
    item.nextAttemptAt = now + (item.status === "failed" ? 0 : delayMs);
    item.lastError = error instanceof Error ? error.message : String(error);
    this.writeState(state);
    return true;
  }

  recover(): HotReelQueueItem[] {
    const state = this.readState();
    for (const item of state.items) {
      if (item.status === "running" && item.attempts < item.maxAttempts) {
        item.status = "queued";
      }
    }
    this.writeState(state);
    return state.items.filter((item) => item.status !== "done");
  }
}
