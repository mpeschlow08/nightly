import type { AuthorizedMediaSource, MediaHealth, MediaPolicy } from "./contracts";
import { assertAuthorizedSource } from "./contracts";
import { probeMedia, resolveStreamAuth, startCapture, type Capture, type CaptureOptions } from "./engine";

export type SupervisedSource = { health(): MediaHealth; stop(): Promise<void> };
export type SupervisorOptions = CaptureOptions & { maxRestarts?: number; restartWindowMs?: number; backoffMs?: number };

export class MediaSupervisor {
  private readonly sessions = new Map<number, SupervisedSource>();

  start(source: AuthorizedMediaSource, policy: MediaPolicy, options: SupervisorOptions = {}): SupervisedSource {
    assertAuthorizedSource(source, policy);
    if (this.sessions.has(source.sourceId)) throw new Error("media_source_already_running");
    if (this.sessions.size >= 4) throw new Error("media_source_limit_reached");
    const canonical = { ...source };
    const authorizedPolicy = { ...policy };
    const maxRestarts = options.maxRestarts ?? 3;
    const restartWindowMs = options.restartWindowMs ?? 60_000;
    const backoffMs = options.backoffMs ?? 250;
    if (!Number.isInteger(maxRestarts) || maxRestarts < 0 || maxRestarts > 10 ||
        !Number.isInteger(restartWindowMs) || restartWindowMs < 1000 || restartWindowMs > 600_000 ||
        !Number.isInteger(backoffMs) || backoffMs < 100 || backoffMs > 10_000) throw new Error("media_supervisor_limit_invalid");
    let state: MediaHealth = { state: "STARTING", reconnects: 0, discontinuities: 0, acceleration: "UNKNOWN", lastErrorCode: null };
    let capture: Capture | null = null;
    let softwareFallback = false;
    let stopped = false;
    let wake: (() => void) | null = null;
    const shutdown = new AbortController();
    const attempts: number[] = [];
    const delay = (ms: number) => new Promise<void>((resolve) => {
      const timer = setTimeout(() => { shutdown.signal.removeEventListener("abort", cancel); resolve(); }, ms);
      const cancel = () => { clearTimeout(timer); resolve(); };
      shutdown.signal.addEventListener("abort", cancel, { once: true });
    });
    const loop = async () => {
      while (!stopped) {
        try {
          let auth: Awaited<ReturnType<typeof resolveStreamAuth>>;
          if (!options.simulation) {
            let cancel!: () => void;
            const aborted = new Promise<never>((_, reject) => { cancel = () => reject(new Error("media_auth_resolve_failed")); shutdown.signal.addEventListener("abort", cancel, { once: true }); });
            try { auth = await Promise.race([resolveStreamAuth(canonical, options, shutdown.signal), aborted]); }
            finally { shutdown.signal.removeEventListener("abort", cancel); }
            if (stopped) break;
            await probeMedia(canonical, authorizedPolicy, options.runner, options, auth);
          }
          if (stopped) break;
          capture = await startCapture(canonical, authorizedPolicy, softwareFallback ? { ...options, vaapi: undefined } : options, auth);
          if (stopped) break;
          state = { ...state, state: "RUNNING", acceleration: capture.acceleration, lastErrorCode: null };
          if (capture.process) {
            await new Promise<void>((resolve) => {
              wake = resolve;
              capture!.process!.once("exit", () => resolve());
              capture!.process!.once("error", () => resolve());
              if (capture!.process!.exitCode != null || capture!.process!.signalCode != null) resolve();
            });
          } else {
            await new Promise<void>((resolve) => { wake = resolve; });
          }
          if (!stopped) {
            if (capture.acceleration === "VAAPI") softwareFallback = true;
            state = { ...state, discontinuities: state.discontinuities + 1, lastErrorCode: "media_process_exited" };
          }
        } catch (error) {
          if (options.vaapi?.encodeSmokeTestPassed) softwareFallback = true;
          if (!stopped) state = { ...state, lastErrorCode: error instanceof Error && /^media_[a-z_]+$/.test(error.message) ? error.message : "media_process_failed" };
        } finally {
          wake = null;
          if (capture) { await capture.stop(); capture = null; }
        }
        if (stopped) break;
        const now = Date.now();
        while (attempts.length && attempts[0] <= now - restartWindowMs) attempts.shift();
        if (attempts.length >= maxRestarts) { state = { ...state, state: "FAILED" }; break; }
        attempts.push(now);
        state = { ...state, state: "BACKOFF", reconnects: state.reconnects + 1 };
        await delay(Math.min(backoffMs * 2 ** (attempts.length - 1), 10_000));
        if (!stopped) state = { ...state, state: "STARTING" };
      }
      if (stopped) state = { ...state, state: "STOPPED" };
      this.sessions.delete(canonical.sourceId);
    };
    const task = loop();
    const session: SupervisedSource = {
      health: () => ({ ...state }),
      stop: async () => {
        stopped = true;
        shutdown.abort();
        wake?.();
        await task;
      },
    };
    this.sessions.set(canonical.sourceId, session);
    return session;
  }

  health(sourceId: number): MediaHealth | null { return this.sessions.get(sourceId)?.health() ?? null; }
  async stopAll(): Promise<void> { await Promise.all([...this.sessions.values()].map((session) => session.stop())); }
}