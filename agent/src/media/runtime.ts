import { join } from "node:path";
import { ControlPlaneError } from "../core/control-plane-client";
import type { AgentLogger } from "../core/types";
import { isHotMomentEligible, assertAuthorizedSource, type AuthorizedMediaSource, type MediaPolicy } from "./contracts";
import type { ResolvedStream } from "./engine";
import { LocalHotMoments, type MediaMuxer, type MomentCandidate, type MomentTrigger } from "./moments";
import { MediaSupervisor, type SupervisedSource, type SupervisorOptions } from "./supervisor";
import { EncryptedMediaStorage, type MediaStorageOptions } from "./storage";
import { SegmentTimeline, type SegmentObservation } from "./timeline";

export type CanonicalMediaBindings = {
  resolve(sourceId: number): Promise<{ source: AuthorizedMediaSource; policy: MediaPolicy }>;
  list(): Promise<number[]>;
  credential?(sourceId: number): Promise<ResolvedStream>;
  readonly revision?: string | null;
};

export type MediaRuntimeOptions = {
  directory: string;
  keyProvider: MediaStorageOptions["keyProvider"];
  bindings: CanonicalMediaBindings;
  logger: AgentLogger;
  muxer?: MediaMuxer;
  simulation?: boolean;
  supervisorOptions?: SupervisorOptions;
  now?: () => number;
  performanceSession?: (sourceId: number, startMs: number, endMs: number) => {
    publicId: string; mediaRevision: number; includeMicrophone: boolean;
  } | null;
  reportSessionMedia?: (input: { publicId: string; mediaRevision: number; sourceId: number; candidateId: string;
    hotId: string; configRevision: string; windowStartAt: string; windowEndAt: string }) => Promise<void>;
};

export class AgentMediaRuntime {
  readonly storage: EncryptedMediaStorage;
  readonly moments: LocalHotMoments;
  readonly supervisor = new MediaSupervisor();
  private readonly started = new Set<number>();
  private readonly boundSources = new Map<number, AuthorizedMediaSource>();
  private readonly boundPolicies = new Map<number, MediaPolicy>();
  private readonly sessions = new Map<number, SupervisedSource>();
  private readonly credentialTimers = new Map<number, NodeJS.Timeout>();
  private readonly observations = new Map<number, SegmentObservation>();
  private readonly pendingPerformanceSessions = new Map<string, { publicId: string; mediaRevision: number;
    includeMicrophone: boolean; configRevision: string; expiresAt: number }>();
  private readonly now: () => number;
  private running = false;
  private maintenanceTimer: NodeJS.Timeout | null = null;
  private maintenance: Promise<void> | null = null;

  constructor(private readonly options: MediaRuntimeOptions) {
    this.now = options.now ?? Date.now;
    this.storage = new EncryptedMediaStorage({ directory: join(options.directory, "segments"), keyProvider: options.keyProvider, now: this.now });
    this.moments = new LocalHotMoments({
      directory: join(options.directory, "moments"), keyProvider: options.keyProvider, storage: this.storage,
      resolveCanonical: (sourceId) => options.bindings.resolve(sourceId), muxer: options.muxer, now: this.now,
    });
  }

  async start(): Promise<void> {
    if (this.running) return;
    await this.storage.recover();
    await this.moments.recover();
    await this.moments.expire();
    this.running = true;
    try {
      await this.reconcile();
      this.maintenanceTimer = setInterval(() => {
        if (this.maintenance || !this.running) return;
        this.maintenance = (async () => {
          await this.storage.list();
          await this.moments.expire();
        })().catch(() => this.options.logger.log("warn", "media_retention_unavailable")).finally(() => { this.maintenance = null; });
      }, 30_000);
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  async reconcile(): Promise<void> {
    if (!this.running) return;
    const sourceIds = await this.options.bindings.list();
    if (sourceIds.length > 4 || new Set(sourceIds).size !== sourceIds.length ||
        sourceIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) throw new Error("media_source_capacity_exceeded");
    const desired = new Set(sourceIds);
    for (const sourceId of [...this.started]) {
      const current = desired.has(sourceId) ? await this.options.bindings.resolve(sourceId) : null;
      const bound = this.boundSources.get(sourceId);
      const policy = this.boundPolicies.get(sourceId);
      if (!current || !bound || !policy || !isHotMomentEligible(current.source, current.policy) ||
          Object.keys(bound).some((key) => current.source[key as keyof AuthorizedMediaSource] !== bound[key as keyof AuthorizedMediaSource]) ||
          Object.keys(policy).some((key) => current.policy[key as keyof MediaPolicy] !== policy[key as keyof MediaPolicy]) ||
          this.sessions.get(sourceId)?.health().state === "FAILED") await this.stopSource(sourceId);
    }
    for (const sourceId of sourceIds) {
      if (this.started.has(sourceId)) continue;
      try { await this.startSource(sourceId); }
      catch (error) {
        if (error instanceof ControlPlaneError && [401, 403, 409].includes(error.status ?? 0)) throw error;
        this.options.logger.log("warn", "media_source_unavailable", { sourceId });
      }
    }
  }

  private async stopSource(sourceId: number): Promise<void> {
    const timer = this.credentialTimers.get(sourceId);
    if (timer) clearTimeout(timer);
    this.credentialTimers.delete(sourceId);
    this.started.delete(sourceId);
    this.boundSources.delete(sourceId);
    this.boundPolicies.delete(sourceId);
    this.observations.delete(sourceId);
    const session = this.sessions.get(sourceId);
    this.sessions.delete(sourceId);
    await session?.stop();
  }

  private async startSource(sourceId: number): Promise<void> {
    let credential = !this.options.simulation && this.options.bindings.credential
      ? await this.options.bindings.credential(sourceId) : null;
    const { source, policy } = await this.options.bindings.resolve(sourceId);
    if (source.sourceId !== sourceId) throw new Error("media_source_identity_mismatch");
    assertAuthorizedSource(source, policy);
    const bound = { ...source };
    if (!this.options.simulation && !credential && source.kind === "IP_CAMERA") throw new Error("media_credential_unavailable");
    const credentialExpiry = credential ? Date.parse(credential.expiresAt) : null;
    if (credential && (!this.options.bindings.revision || credential.configRevision !== this.options.bindings.revision ||
        !Number.isFinite(credentialExpiry) || credentialExpiry! <= this.now())) throw new Error("media_credential_invalid");
    const checkBinding = async () => {
      const current = await this.options.bindings.resolve(sourceId);
      if (current.source.sourceId !== sourceId || Object.keys(bound).some((key) =>
        current.source[key as keyof AuthorizedMediaSource] !== bound[key as keyof AuthorizedMediaSource]) ||
        !isHotMomentEligible(current.source, current.policy)) throw new Error("media_source_identity_mismatch");
    };
    const timeline = new SegmentTimeline();
    const session = this.supervisor.start(source, policy, {
      ...this.options.supervisorOptions,
      ...(credential ? { configRevision: credential.configRevision, resolveStream: async (id: number, signal?: AbortSignal) => {
        if (signal?.aborted || id !== sourceId) throw new Error("media_auth_resolve_failed");
        if (credential) { const initial = credential; credential = null; return initial; }
        return this.options.bindings.credential!(sourceId);
      } } : {}),
      ...(this.options.simulation ? { simulation: true, fixture: "SIMULATED" } : {}),
      onSegment: async (segment) => {
        if (Object.keys(bound).some((key) => segment.source[key as keyof AuthorizedMediaSource] !== bound[key as keyof AuthorizedMediaSource]))
          throw new Error("media_source_identity_mismatch");
        await checkBinding();
        if (credentialExpiry !== null && this.now() >= credentialExpiry - 1000) throw new Error("media_credential_expired");
        const observation = timeline.observe(segment);
        if (!observation) return;
        this.observations.set(sourceId, observation);
        if (observation.startMs === null || observation.endMs === null) return;
        const stored = await this.storage.appendSegment(sourceId, segment.bytes);
        await checkBinding();
        await this.moments.registerSegment(stored, observation.startMs, observation.endMs);
      },
    });
    this.boundSources.set(sourceId, bound);
    this.boundPolicies.set(sourceId, { ...policy });
    this.sessions.set(sourceId, session);
    this.started.add(sourceId);
    if (credentialExpiry !== null) this.credentialTimers.set(sourceId, setTimeout(() => {
      void this.stopSource(sourceId).catch(() => this.options.logger.log("warn", "media_source_stop_unavailable", { sourceId }));
    }, Math.max(0, credentialExpiry - this.now() - 1000)));
    this.options.logger.log("info", "media_source_started", { sourceId, state: session.health().state, simulated: Boolean(this.options.simulation) });
  }

  async ingestSimulation(sourceId: number, bytes: Buffer, startMs: number, endMs: number): Promise<void> {
    if (!this.running || !this.options.simulation || !this.started.has(sourceId) || !Number.isSafeInteger(startMs) || !Number.isSafeInteger(endMs) || endMs <= startMs) {
      throw new Error("media_simulation_unavailable");
    }
    const { source, policy } = await this.options.bindings.resolve(sourceId);
    const bound = this.boundSources.get(sourceId);
    if (!bound || source.sourceId !== sourceId || Object.keys(bound).some((key) =>
      source[key as keyof AuthorizedMediaSource] !== bound[key as keyof AuthorizedMediaSource]) ||
      !isHotMomentEligible(source, policy)) throw new Error("media_source_ineligible");
    const record = await this.storage.appendSegment(sourceId, bytes);
    const current = await this.options.bindings.resolve(sourceId);
    if (current.source.sourceId !== sourceId || Object.keys(bound).some((key) =>
      current.source[key as keyof AuthorizedMediaSource] !== bound[key as keyof AuthorizedMediaSource]) ||
      !isHotMomentEligible(current.source, current.policy)) throw new Error("media_source_ineligible");
    await this.moments.registerSegment(record, startMs, endMs);
  }

  async trigger(sourceId: number, atMs: number, preMs: number, postMs: number, trigger: MomentTrigger): Promise<MomentCandidate> {
    if (!this.running || !this.started.has(sourceId)) throw new Error("media_source_unavailable");
    const bound = this.boundSources.get(sourceId);
    const current = await this.options.bindings.resolve(sourceId);
    if (!bound || current.source.sourceId !== sourceId || Object.keys(bound).some((key) =>
      current.source[key as keyof AuthorizedMediaSource] !== bound[key as keyof AuthorizedMediaSource]) ||
      !isHotMomentEligible(current.source, current.policy)) throw new Error("media_source_ineligible");
    const candidate = await this.moments.trigger(sourceId, atMs, preMs, postMs, trigger);
    for (const [id, attribution] of this.pendingPerformanceSessions) {
      if (attribution.expiresAt <= this.now()) this.pendingPerformanceSessions.delete(id);
    }
    const session = this.options.performanceSession?.(sourceId, candidate.startMs, candidate.endMs);
    const configRevision = this.options.bindings.revision;
    if (session && configRevision) {
      if (this.pendingPerformanceSessions.size >= 64) this.pendingPerformanceSessions.delete(this.pendingPerformanceSessions.keys().next().value!);
      this.pendingPerformanceSessions.set(candidate.id, { ...session, configRevision, expiresAt: candidate.expiresAt });
    }
    return candidate;
  }

  async extractMoment(candidateId: string): Promise<MomentCandidate> {
    const ready = await this.moments.extract(candidateId);
    const stored = this.pendingPerformanceSessions.get(candidateId);
    const session = stored && stored.expiresAt > this.now()
      ? stored : this.options.performanceSession?.(ready.sourceId, ready.startMs, ready.endMs);
    const configRevision = stored?.configRevision ?? this.options.bindings.revision;
    if (ready.state === "ready" && ready.hotId && session && configRevision && this.options.reportSessionMedia) {
      void this.options.reportSessionMedia({ publicId: session.publicId, mediaRevision: session.mediaRevision,
        sourceId: ready.sourceId, candidateId: ready.id, hotId: ready.hotId, configRevision,
        windowStartAt: new Date(ready.startMs).toISOString(), windowEndAt: new Date(ready.endMs).toISOString() })
        .catch(() => this.options.logger.log("warn", "artist_session_attribution_unavailable"));
    }
    this.pendingPerformanceSessions.delete(candidateId);
    return ready;
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.maintenanceTimer) clearInterval(this.maintenanceTimer);
    this.maintenanceTimer = null;
    await Promise.all([...this.started].map((sourceId) => this.stopSource(sourceId)));
    await this.supervisor.stopAll();
    await this.maintenance;
    this.started.clear();
    this.boundSources.clear();
    this.boundPolicies.clear();
    this.observations.clear();
    this.pendingPerformanceSessions.clear();
  }

  timingEvidence(sourceId: number): SegmentObservation | null {
    const value = this.observations.get(sourceId);
    return value ? { ...value } : null;
  }

  health(): Array<{ sourceId: number; state: string; acceleration: string; reconnects: number; discontinuities: number }> {
    return [...this.started].map((sourceId) => {
      const health = this.supervisor.health(sourceId);
      return { sourceId, state: health?.state ?? "FAILED", acceleration: health?.acceleration ?? "UNKNOWN", reconnects: health?.reconnects ?? 0, discontinuities: health?.discontinuities ?? 0 };
    });
  }
}