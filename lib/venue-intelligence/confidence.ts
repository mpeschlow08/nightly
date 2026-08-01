import { CONFIDENCE_THRESHOLDS } from "./constants";
import type { ConfidenceLevel } from "./types";

export function confidenceFromScore(score: number): ConfidenceLevel {
  if (score >= CONFIDENCE_THRESHOLDS.high) {
    return "high";
  }

  if (score >= CONFIDENCE_THRESHOLDS.medium) {
    return "medium";
  }

  return "low";
}

export function confidenceFromSample(sampleSize: number, baseline = 10): { level: ConfidenceLevel; score: number } {
  const score = Math.max(0, Math.min(1, sampleSize / baseline));

  return {
    level: confidenceFromScore(score),
    score,
  };
}
