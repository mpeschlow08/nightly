import { clamp } from "./metrics";
import { buildProvenance } from "./provenance";
import type { PricingRecommendation } from "./types";

export function buildPricingRecommendation(input: {
  productType: string;
  currentPriceCents: number;
  sellThroughPercent: number;
  daysToEvent: number;
  refundRatePercent: number;
  lastDataAt: Date | null;
}): PricingRecommendation {
  let modifier = 0;
  if (input.sellThroughPercent < 30 && input.daysToEvent <= 3) modifier = -0.1;
  if (input.sellThroughPercent > 80 && input.daysToEvent <= 2) modifier = 0.08;
  if (input.refundRatePercent > 12) modifier = Math.min(modifier, -0.05);

  const low = Math.round(input.currentPriceCents * (1 + modifier - 0.03));
  const high = Math.round(input.currentPriceCents * (1 + modifier + 0.03));
  const risk: PricingRecommendation["risk"] = input.refundRatePercent > 14 ? "high" : Math.abs(modifier) > 0.08 ? "medium" : "low";

  return {
    productType: input.productType,
    currentPriceCents: input.currentPriceCents,
    suggestedLowCents: Math.max(0, Math.min(low, high)),
    suggestedHighCents: Math.max(0, Math.max(low, high)),
    rationale: "Based on sales velocity, time-to-event, and refund pressure.",
    risk,
    confidenceLevel: clamp(input.sellThroughPercent / 100, 0, 1) > 0.55 ? "medium" : "low",
    effectiveWindow: input.daysToEvent <= 2 ? "Apply for next 24 hours" : "Apply for next 48 hours",
    requiresApproval: true,
    status: "available",
    provenance: buildProvenance({
      sourceType: "derived",
      sourceTables: ["ticket_products", "ticket_orders", "ticket_refunds"],
      lastDataAt: input.lastDataAt,
      sampleSize: Math.round(input.sellThroughPercent),
      confidenceLevel: clamp(input.sellThroughPercent / 100, 0, 1) > 0.55 ? "medium" : "low",
      confidenceScore: clamp(input.sellThroughPercent / 100, 0.25, 0.78),
      status: "available",
      limitations: ["Advisory only. Prices are never changed automatically."],
    }),
  };
}
