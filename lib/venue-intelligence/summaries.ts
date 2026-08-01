import type { IntelligenceOverview } from "./types";

export function buildOverviewSummary(overview: IntelligenceOverview) {
  const topAnomaly = overview.anomalies[0];
  const topMarketing = overview.marketingRecommendations[0];

  return [
    `Performance score ${overview.scorecard.compositeScore ?? "N/A"}.`,
    `Attendance forecast ${overview.attendanceForecast.expected} (${overview.attendanceForecast.low}-${overview.attendanceForecast.high}).`,
    `Revenue net projection ${Math.round(overview.revenueForecast.confirmedNetCents / 100)} confirmed + ${Math.round(overview.revenueForecast.estimatedNetCents / 100)} estimated USD.`,
    topAnomaly ? `Priority risk: ${topAnomaly.metric}.` : "No major anomalies detected.",
    topMarketing ? `Top recommendation: ${topMarketing.title}.` : "No marketing recommendation available.",
  ].join(" ");
}
