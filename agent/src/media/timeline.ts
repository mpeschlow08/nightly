import type { MediaSegment, SegmentTimingEvidence } from "./engine";

export type SegmentObservation = SegmentTimingEvidence & {
  sequence: number; startMs: number | null; endMs: number | null;
  discontinuity: boolean; uncertaintyMs: null;
};

export class SegmentTimeline {
  private lastSequence: number | null = null;
  private lastPtsMs: number | null = null;
  private lastMonotonicMs: number | null = null;
  private lastEndMs: number | null = null;

  observe(segment: MediaSegment): SegmentObservation | null {
    const timing = segment.timing;
    if (!timing || !Number.isSafeInteger(segment.sequence) || segment.sequence < 0 ||
        !Number.isFinite(timing.observedMonotonicMs) || timing.observedMonotonicMs < 0 ||
        !Number.isSafeInteger(timing.observedWallMs) || timing.observedWallMs < 0) return null;
    const validBase = typeof timing.timeBase === "string" && /^[1-9]\d{0,8}\/[1-9]\d{0,8}$/.test(timing.timeBase);
    const validPts = Number.isSafeInteger(timing.sourcePts) && (timing.sourcePts as number) >= 0 && validBase;
    const [numerator, denominator] = validPts ? timing.timeBase!.split("/").map(Number) : [0, 1];
    const ptsMs = validPts ? timing.sourcePts! * numerator / denominator * 1000 : null;
    const safePts = ptsMs !== null && Number.isFinite(ptsMs) ? ptsMs : null;
    const discontinuity = this.lastSequence === null || segment.sequence !== this.lastSequence + 1 ||
      (this.lastMonotonicMs !== null && timing.observedMonotonicMs < this.lastMonotonicMs) ||
      (safePts !== null && this.lastPtsMs !== null && safePts < this.lastPtsMs);
    const duration = timing.durationMs;
    const validDuration = duration !== null && Number.isFinite(duration) && duration > 0 && duration <= 30_000;
    const endMs = validDuration && (this.lastEndMs === null || timing.observedWallMs > this.lastEndMs) ? timing.observedWallMs : null;
    const startMs = endMs === null ? null : Math.max(discontinuity && this.lastEndMs !== null ? this.lastEndMs + 1 : this.lastEndMs ?? 0, endMs - Math.ceil(duration!));
    this.lastSequence = segment.sequence;
    this.lastMonotonicMs = timing.observedMonotonicMs;
    this.lastPtsMs = safePts;
    if (endMs !== null && startMs !== null && startMs < endMs) this.lastEndMs = endMs;
    return {
      ...timing, sourcePts: safePts === null ? null : timing.sourcePts, timeBase: safePts === null ? null : timing.timeBase,
      ptsOrigin: safePts === null ? null : timing.ptsOrigin,
      sequence: segment.sequence, startMs: startMs !== null && startMs < endMs! ? startMs : null,
      endMs: startMs !== null && startMs < endMs! ? endMs : null,
      discontinuity, uncertaintyMs: null,
    };
  }
}

export type TimelinePoint = { monotonicMs: number; uncertaintyMs: number; discontinuity: boolean };

export class TimestampNormalizer {
  private lastSource: number | null = null;
  private lastOutput: number | null = null;
  private offset = 0;
  private uncertainty = 0;

  constructor(private readonly maxDriftPpm = 200) {
    if (!Number.isFinite(maxDriftPpm) || maxDriftPpm < 0 || maxDriftPpm > 1000) throw new Error("media_drift_invalid");
  }

  normalize(sourceTicks: number, timeBase: string, arrivalMonotonicMs: number, reconnect = false): TimelinePoint {
    const match = /^(\d{1,9})\/(\d{1,9})$/.exec(timeBase);
    if (!match || Number(match[2]) === 0 || !Number.isFinite(sourceTicks) || sourceTicks < 0 ||
        !Number.isFinite(arrivalMonotonicMs) || arrivalMonotonicMs < 0) throw new Error("media_timestamp_invalid");
    const sourceMs = sourceTicks * Number(match[1]) / Number(match[2]) * 1000;
    if (!Number.isFinite(sourceMs)) throw new Error("media_timestamp_invalid");
    const discontinuity = reconnect || this.lastSource === null || sourceMs < this.lastSource;
    if (discontinuity) {
      this.offset = arrivalMonotonicMs - sourceMs;
      this.uncertainty = 5;
    } else {
      const elapsed = sourceMs - this.lastSource!;
      const residual = arrivalMonotonicMs - (sourceMs + this.offset);
      const correction = Math.max(-elapsed * this.maxDriftPpm / 1_000_000, Math.min(elapsed * this.maxDriftPpm / 1_000_000, residual));
      this.offset += correction;
      this.uncertainty = Math.min(60_000, Math.max(5, this.uncertainty + Math.abs(residual - correction) * 0.05));
    }
    const monotonicMs = Math.max(this.lastOutput ?? 0, sourceMs + this.offset);
    this.lastSource = sourceMs;
    this.lastOutput = monotonicMs;
    return { monotonicMs, uncertaintyMs: this.uncertainty + Math.max(0, monotonicMs - sourceMs - this.offset), discontinuity };
  }

  reset(): void { this.lastSource = null; }
}