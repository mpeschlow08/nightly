import type { IntelligenceMetric } from "./types";

export function metricMap(metrics: IntelligenceMetric[]) {
  return Object.fromEntries(metrics.map((metric) => [metric.key, metric]));
}

export function avg(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
