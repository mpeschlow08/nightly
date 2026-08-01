import { STALE_MINUTES_DEFAULT } from "./constants";
import type { IntelligenceStatus } from "./types";

export function deriveDataStatus(input: {
  sampleSize: number;
  minimumSampleSize: number;
  lastDataAt: Date | null;
  staleAfterMinutes?: number;
}): IntelligenceStatus {
  if (input.sampleSize < input.minimumSampleSize) {
    return "insufficient_data";
  }

  if (!input.lastDataAt) {
    return "unavailable";
  }

  const staleAfterMinutes = input.staleAfterMinutes ?? STALE_MINUTES_DEFAULT;
  const ageMs = Date.now() - input.lastDataAt.getTime();
  if (ageMs > staleAfterMinutes * 60_000) {
    return "stale";
  }

  return "available";
}

export function limitationsFromStatus(status: IntelligenceStatus, sampleSize: number) {
  if (status === "insufficient_data") {
    return [`Not enough history yet (sample size ${sampleSize}).`];
  }

  if (status === "stale") {
    return ["Data is stale and should be refreshed."];
  }

  if (status === "unavailable") {
    return ["Required data source is unavailable."];
  }

  return [] as string[];
}
