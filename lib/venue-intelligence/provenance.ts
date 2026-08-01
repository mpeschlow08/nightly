import { INTELLIGENCE_ALGORITHM_VERSION } from "./constants";
import type { ConfidenceLevel, IntelligenceStatus, ProviderKind, Provenance } from "./types";

export function buildProvenance(input: {
  sourceType: "database" | "derived" | "adapter";
  sourceTables: string[];
  sourceWindowStart?: Date | null;
  sourceWindowEnd?: Date | null;
  lastDataAt?: Date | null;
  sampleSize?: number | null;
  confidenceLevel: ConfidenceLevel;
  confidenceScore?: number | null;
  status: IntelligenceStatus;
  limitations?: string[];
  isEstimated?: boolean;
  isPartial?: boolean;
  providerUsed?: ProviderKind;
  modelVersion?: string;
}): Provenance {
  return {
    sourceType: input.sourceType,
    sourceTables: input.sourceTables,
    sourceWindowStart: input.sourceWindowStart ? input.sourceWindowStart.toISOString() : null,
    sourceWindowEnd: input.sourceWindowEnd ? input.sourceWindowEnd.toISOString() : null,
    generatedAt: new Date().toISOString(),
    lastDataAt: input.lastDataAt ? input.lastDataAt.toISOString() : null,
    sampleSize: input.sampleSize ?? null,
    confidenceLevel: input.confidenceLevel,
    confidenceScore: input.confidenceScore ?? null,
    status: input.status,
    limitations: input.limitations ?? [],
    isEstimated: input.isEstimated ?? false,
    isPartial: input.isPartial ?? false,
    providerUsed: input.providerUsed ?? "deterministic",
    modelVersion: input.modelVersion ?? INTELLIGENCE_ALGORITHM_VERSION,
  };
}
