import { buildProvenance } from "./provenance";
import { toPercent } from "./metrics";
import type { PromoterInsight } from "./types";

export type PromoterSignal = {
  promoterProfileId: number;
  promoterName: string;
  assignedEvents: number;
  ticketSales: number;
  guestListArrivals: number;
  attributedRevenueCents: number;
};

export function buildPromoterInsights(input: {
  promoters: PromoterSignal[];
  lastDataAt: Date | null;
}): PromoterInsight[] {
  return input.promoters.map((promoter) => {
    const conversionRate = toPercent(promoter.guestListArrivals, Math.max(1, promoter.ticketSales + promoter.guestListArrivals));
    const recommendation = conversionRate >= 45
      ? "Increase allocation for similar events."
      : conversionRate <= 20
        ? "Review allocation and provide updated promo assets."
        : "Maintain allocation and monitor conversion trend.";

    return {
      promoterProfileId: promoter.promoterProfileId,
      promoterName: promoter.promoterName,
      assignedEvents: promoter.assignedEvents,
      ticketSales: promoter.ticketSales,
      guestListArrivals: promoter.guestListArrivals,
      conversionRate,
      attributedRevenueCents: promoter.attributedRevenueCents,
      recommendation,
      status: "available",
      provenance: buildProvenance({
        sourceType: "derived",
        sourceTables: ["promoter_event_assignments", "ticket_orders", "guest_list_entries"],
        lastDataAt: input.lastDataAt,
        sampleSize: promoter.assignedEvents,
        confidenceLevel: promoter.assignedEvents >= 5 ? "high" : "medium",
        confidenceScore: promoter.assignedEvents >= 5 ? 0.83 : 0.6,
        status: "available",
        limitations: ["Commission is estimated and does not trigger payouts."],
      }),
    };
  });
}
