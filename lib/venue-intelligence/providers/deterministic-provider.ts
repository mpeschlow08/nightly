import type { AskBusinessAnswer, IntelligenceOverview } from "../types";
import { buildOverviewSummary } from "../summaries";

export const DETERMINISTIC_PROVIDER_VERSION = "deterministic-v1";

export function deterministicNarrative(overview: IntelligenceOverview): string {
  return buildOverviewSummary(overview);
}

export function deterministicAskResponse(input: { question: string; overview: IntelligenceOverview }): AskBusinessAnswer {
  const q = input.question.toLowerCase();
  const answer = q.includes("staff")
    ? `Recommended staffing: ${input.overview.staffingRecommendation.doorStaff} door, ${input.overview.staffingRecommendation.security} security, ${input.overview.staffingRecommendation.bartenders} bartenders.`
    : q.includes("inventory")
      ? `Top inventory risks: ${input.overview.inventoryRisks.slice(0, 3).map((risk) => `${risk.itemName} (${Math.round(risk.shortageRisk * 100)}% shortage risk)`).join(", ") || "none"}.`
      : q.includes("revenue")
        ? `Confirmed net revenue is ${Math.round(input.overview.revenueForecast.confirmedNetCents / 100)} USD with estimated additional ${Math.round(input.overview.revenueForecast.estimatedNetCents / 100)} USD.`
        : deterministicNarrative(input.overview);

  return {
    answer,
    structured: {
      attendanceForecast: input.overview.attendanceForecast,
      revenueForecast: input.overview.revenueForecast,
      staffingRecommendation: input.overview.staffingRecommendation,
      inventoryRisks: input.overview.inventoryRisks,
      marketingRecommendations: input.overview.marketingRecommendations,
      anomalies: input.overview.anomalies,
    },
    provenance: {
      ...input.overview.attendanceForecast.provenance,
      providerUsed: "deterministic",
      modelVersion: DETERMINISTIC_PROVIDER_VERSION,
    },
  };
}
