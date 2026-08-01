import { buildProvenance } from "./provenance";
import type { CampaignDraft, MarketingRecommendation } from "./types";

export function buildMarketingRecommendations(input: {
  slowSellingEvents: Array<{ eventId: number; eventName: string; sellThroughPercent: number }>;
  lapsedAudienceSize: number;
  vipUnsold: number;
  lastDataAt: Date | null;
}): MarketingRecommendation[] {
  const recommendations: MarketingRecommendation[] = [];

  for (const event of input.slowSellingEvents.slice(0, 3)) {
    recommendations.push({
      title: `Boost demand for ${event.eventName}`,
      goal: "Increase ticket velocity before cutoff",
      audience: "Recent visitors and genre-matched guests",
      timing: "Within next 4 hours",
      channel: "push",
      messageAngle: "Limited-time momentum and lineup urgency",
      expectedReason: `Sell-through is currently ${event.sellThroughPercent.toFixed(0)}%.`,
      requiresOwnerApproval: true,
      confidenceLevel: event.sellThroughPercent < 35 ? "high" : "medium",
      restrictions: ["Send only to opted-in users.", "Do not include sensitive user data in generation context."],
      provenance: buildProvenance({
        sourceType: "derived",
        sourceTables: ["ticket_products", "ticket_orders", "venue_customer_profiles", "venue_marketing_campaigns"],
        lastDataAt: input.lastDataAt,
        sampleSize: input.slowSellingEvents.length,
        confidenceLevel: event.sellThroughPercent < 35 ? "high" : "medium",
        confidenceScore: event.sellThroughPercent < 35 ? 0.82 : 0.66,
        status: "available",
        limitations: ["Recommendation does not auto-send campaigns."],
      }),
    });
  }

  if (input.lapsedAudienceSize >= 8) {
    recommendations.push({
      title: "Re-engage lapsed guests",
      goal: "Recover inactive visitors",
      audience: "Lapsed guests (45+ days inactive)",
      timing: "Tomorrow afternoon",
      channel: "email",
      messageAngle: "Comeback reward with expiring perk",
      expectedReason: `${input.lapsedAudienceSize} venue-scoped lapsed guests are eligible.`,
      requiresOwnerApproval: true,
      confidenceLevel: "medium",
      restrictions: ["Honor consent and unsubscribe preferences."],
      provenance: buildProvenance({
        sourceType: "derived",
        sourceTables: ["venue_customer_profiles", "venue_loyalty_ledger"],
        lastDataAt: input.lastDataAt,
        sampleSize: input.lapsedAudienceSize,
        confidenceLevel: "medium",
        confidenceScore: 0.61,
        status: "available",
      }),
    });
  }

  if (input.vipUnsold > 0) {
    recommendations.push({
      title: "Promote remaining VIP inventory",
      goal: "Increase VIP/table conversion",
      audience: "High-value and VIP-active guests",
      timing: "2-3 hours before doors",
      channel: "in_app",
      messageAngle: "Highlight remaining premium tables and bottle perks",
      expectedReason: `${input.vipUnsold} VIP reservations remain unsold.`,
      requiresOwnerApproval: true,
      confidenceLevel: "medium",
      restrictions: ["Do not oversubscribe floor capacity."],
      provenance: buildProvenance({
        sourceType: "derived",
        sourceTables: ["venue_vip_reservations", "venue_floor_plan_objects"],
        lastDataAt: input.lastDataAt,
        sampleSize: input.vipUnsold,
        confidenceLevel: "medium",
        confidenceScore: 0.58,
        status: "available",
      }),
    });
  }

  return recommendations;
}

export function createCampaignDraftFromRecommendation(rec: MarketingRecommendation): CampaignDraft {
  const title = `${rec.goal} - ${rec.audience}`;
  const subject = rec.channel === "email" ? `Nightly update: ${rec.goal}` : rec.title;
  const shortCopy = `${rec.messageAngle}. ${rec.expectedReason}`;
  const longCopy = [
    rec.title,
    "",
    `Audience: ${rec.audience}`,
    `Goal: ${rec.goal}`,
    `Angle: ${rec.messageAngle}`,
    `Why now: ${rec.expectedReason}`,
  ].join("\n");

  return {
    title,
    subject,
    shortCopy,
    longCopy,
    cta: "View event details",
    audience: rec.audience,
    scheduleSuggestion: rec.timing,
    complianceNotes: rec.restrictions.join(" "),
    preview: `${subject}\n${shortCopy}`,
    providerUsed: "deterministic",
    modelVersion: "deterministic-v1",
  };
}
