import type { ControlPlaneConfig } from "../core/types";
import type { DeviceMediaBindings } from "./device-bindings";

type SourceRole = "camera" | "program_audio" | "ambient_audio";
const maxPerformanceSessionMs = 12 * 60 * 60 * 1000;
type ActiveSession = { publicId: string; mediaRevision: number; includeMicrophone: boolean;
  sources: Map<number, SourceRole>; startMs: number; endMs: number };

function sourceRole(type: string): SourceRole | null {
  if (type === "ip_camera") return "camera";
  if (type === "mixer_audio") return "program_audio";
  if (type === "ambient_audio") return "ambient_audio";
  return null;
}

export class PerformanceDirective {
  private snapshot: { revision: string; expiresAt: number; bindings: DeviceMediaBindings; sessions: ActiveSession[] } | null = null;

  constructor(private readonly now: () => number = Date.now) {}

  clear(): void { this.snapshot = null; }

  update(config: ControlPlaneConfig, bindings: DeviceMediaBindings): void {
    this.clear();
    const directive = config.sections.performance;
    if (directive === undefined) return;
    const time = this.now();
    if (!Number.isSafeInteger(time) || time < 0 || !config.configAvailable || !config.configRevision ||
        bindings.revision !== config.configRevision || bindings.expiresAt <= time ||
        !directive || directive.revision !== config.configRevision || directive.ttlSeconds !== 300 ||
        !Array.isArray(directive.sessions) || directive.sessions.length > 4) throw new Error("invalid_performance_directive");
    const issuedAt = Date.parse(config.timestamp);
    const expiresAt = issuedAt + directive.ttlSeconds * 1000;
    if (!Number.isSafeInteger(issuedAt) || new Date(issuedAt).toISOString() !== config.timestamp ||
      issuedAt > time || !Number.isSafeInteger(expiresAt) || expiresAt <= time) throw new Error("invalid_performance_directive");
    const allowed = new Map(config.sections.media.sources.map((source) => [source.sourceId, sourceRole(source.sourceType)]));
    const seen = new Set<string>();
    const sessions: ActiveSession[] = [];
    for (const session of directive.sessions) {
      if (!session || typeof session.publicId !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(session.publicId) ||
          seen.has(session.publicId.toLowerCase()) || session.deviceId !== config.deviceId || session.venueId !== config.venueId ||
          !Array.isArray(session.sources) || session.sources.length === 0 || session.sources.length > 4 ||
          new Set(session.sources.map((source) => source?.sourceId)).size !== session.sources.length ||
          session.sources.some((source) => !source || !Number.isSafeInteger(source.sourceId) ||
            allowed.get(source.sourceId) !== source.role || !["camera", "program_audio", "ambient_audio"].includes(source.role)) ||
          typeof session.includeMicrophone !== "boolean" || !Number.isSafeInteger(session.mediaRevision) || session.mediaRevision <= 0 ||
          typeof session.startedAt !== "string" || typeof session.leaseExpiresAt !== "string") throw new Error("invalid_performance_directive");
      const startMs = Date.parse(session.startedAt);
      const leaseExpiresAtMs = Date.parse(session.leaseExpiresAt);
      if (!Number.isSafeInteger(startMs) || new Date(startMs).toISOString() !== session.startedAt ||
          startMs > time || !Number.isSafeInteger(leaseExpiresAtMs) || new Date(leaseExpiresAtMs).toISOString() !== session.leaseExpiresAt ||
          leaseExpiresAtMs <= time || leaseExpiresAtMs <= startMs || leaseExpiresAtMs > startMs + maxPerformanceSessionMs)
        throw new Error("invalid_performance_directive");
      seen.add(session.publicId.toLowerCase());
      sessions.push({ publicId: session.publicId, mediaRevision: session.mediaRevision,
        includeMicrophone: session.includeMicrophone,
        sources: new Map(session.sources.map((source) => [source.sourceId, source.role])), startMs,
        endMs: Math.min(expiresAt, bindings.expiresAt, leaseExpiresAtMs) });
    }
    if (sessions.length === 0) return;
    this.snapshot = { revision: config.configRevision, expiresAt: Math.min(expiresAt, bindings.expiresAt), bindings, sessions };
  }

  resolve(sourceId: number, startMs: number, endMs: number): { publicId: string; mediaRevision: number; includeMicrophone: boolean } | null {
    const snapshot = this.snapshot;
    const time = this.now();
    if (!snapshot || !Number.isSafeInteger(time) || time >= snapshot.expiresAt ||
      snapshot.bindings.revision !== snapshot.revision || snapshot.bindings.expiresAt <= time ||
        !Number.isSafeInteger(sourceId) || !Number.isSafeInteger(startMs) || !Number.isSafeInteger(endMs) ||
        startMs < 0 || endMs <= startMs || endMs > time) return null;
    const matches = snapshot.sessions.filter((session) => session.sources.get(sourceId) === "camera" &&
      startMs >= session.startMs && endMs <= session.endMs && time < session.endMs);
    return matches.length === 1 ? { publicId: matches[0].publicId, mediaRevision: matches[0].mediaRevision,
      includeMicrophone: matches[0].includeMicrophone } : null;
  }
}