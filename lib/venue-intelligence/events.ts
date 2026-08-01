import { clamp, toPercent } from "./metrics";
import { buildProvenance } from "./provenance";
import type { EventHealth } from "./types";

export function buildEventHealthScore(input: {
  eventId: number;
  eventName: string;
  ticketsSold: number;
  ticketInventory: number;
  refunds: number;
  forecastAttendance: number;
  capacity: number;
  incidents: number;
  campaignEngagement: number;
  promoterConversionRate: number;
  lastDataAt: Date | null;
}): EventHealth {
  const sellThrough = toPercent(input.ticketsSold, Math.max(1, input.ticketInventory));
  const capacityUtil = toPercent(input.forecastAttendance, Math.max(1, input.capacity));
  const refundRate = toPercent(input.refunds, Math.max(1, input.ticketsSold));

  const demandHealth = clamp(Math.round(sellThrough * 0.6 + input.promoterConversionRate * 40), 0, 100);
  const revenueHealth = clamp(Math.round(100 - refundRate * 2), 0, 100);
  const readinessHealth = clamp(Math.round(90 - input.incidents * 7 + (capacityUtil > 70 ? 6 : 0)), 0, 100);
  const marketingHealth = clamp(Math.round(Math.min(100, input.campaignEngagement)), 0, 100);
  const overall = Math.round(demandHealth * 0.3 + revenueHealth * 0.25 + readinessHealth * 0.25 + marketingHealth * 0.2);

  const riskFlags: string[] = [];
  if (sellThrough < 35) riskFlags.push("Ticket sales velocity is below target.");
  if (refundRate > 12) riskFlags.push("Refund rate is elevated.");
  if (input.incidents > 3) riskFlags.push("Recent incident count is above baseline.");

  return {
    eventId: input.eventId,
    eventName: input.eventName,
    demandHealth,
    revenueHealth,
    readinessHealth,
    marketingHealth,
    overallHealth: overall,
    riskFlags,
    recommendedActions: riskFlags.length === 0
      ? ["Maintain current operations and monitor hourly conversion."]
      : ["Increase targeted marketing and review staffing before doors.", "Review refund drivers and update guest communications."],
    status: "available",
    provenance: buildProvenance({
      sourceType: "derived",
      sourceTables: ["events", "ticket_orders", "ticket_refunds", "venue_incident_reports", "event_analytics_daily", "promoter_event_assignments"],
      lastDataAt: input.lastDataAt,
      sampleSize: input.ticketsSold,
      confidenceLevel: input.ticketsSold > 80 ? "high" : "medium",
      confidenceScore: input.ticketsSold > 80 ? 0.84 : 0.63,
      status: "available",
      limitations: ["Overall health is an internal Nightly composite score."],
      isEstimated: false,
    }),
  };
}
