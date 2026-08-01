import { ANOMALY_SIGMA_THRESHOLD } from "./constants";
import { safeAverage } from "./metrics";
import { buildProvenance } from "./provenance";
import type { Anomaly } from "./types";

function stdDev(values: number[]) {
  if (values.length < 2) {
    return 0;
  }

  const avg = safeAverage(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function detectAnomalies(input: {
  metricKey: string;
  history: number[];
  actual: number;
  label: string;
  lastDataAt: Date | null;
}): Anomaly[] {
  if (input.history.length < 5) {
    return [];
  }

  const mean = safeAverage(input.history);
  const sigma = stdDev(input.history);
  if (sigma === 0) {
    return [];
  }

  const z = Math.abs((input.actual - mean) / sigma);
  if (z < ANOMALY_SIGMA_THRESHOLD) {
    return [];
  }

  const severity: Anomaly["severity"] = z > 3 ? "high" : z > 2.2 ? "medium" : "low";

  return [
    {
      severity,
      metric: input.label,
      expectedRange: `${Math.max(0, Math.round(mean - sigma))} to ${Math.round(mean + sigma)}`,
      actualValue: String(input.actual),
      confidenceLevel: z > 2.5 ? "high" : "medium",
      possibleExplanations: [
        "Demand mix shifted from historical baseline.",
        "Recent campaign activity changed conversion patterns.",
      ],
      recommendedInvestigation: "Review event-level conversion, promoter mix, and operational incidents before making pricing changes.",
      status: "available",
      provenance: buildProvenance({
        sourceType: "derived",
        sourceTables: ["event_analytics_daily", "ticket_orders", "ticket_refunds"],
        lastDataAt: input.lastDataAt,
        sampleSize: input.history.length,
        confidenceLevel: z > 2.5 ? "high" : "medium",
        confidenceScore: Math.min(0.99, z / 3.5),
        status: "available",
        limitations: ["Anomaly flags are indicators and require human review."],
      }),
    },
  ];
}
