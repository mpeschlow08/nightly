import { MIN_SEGMENT_SIZE } from "./constants";
import { buildProvenance } from "./provenance";
import type { CustomerSegmentRecommendation } from "./types";

export type CustomerProfileSignal = {
  id: number;
  visitCount: number;
  vipVisitCount: number;
  lifetimeSpendCents: number;
  loyaltyPoints: number;
  marketingEligible: boolean;
  lastVisitAt: Date | null;
};

export function buildCustomerSegments(input: {
  profiles: CustomerProfileSignal[];
  now: Date;
  lastDataAt: Date | null;
}): CustomerSegmentRecommendation[] {
  const eligible = input.profiles.filter((profile) => profile.marketingEligible);
  const frequent = eligible.filter((profile) => profile.visitCount >= 4);
  const vip = eligible.filter((profile) => profile.vipVisitCount >= 1);
  const lapsed = eligible.filter((profile) => {
    if (!profile.lastVisitAt) return true;
    const days = (input.now.getTime() - profile.lastVisitAt.getTime()) / 86_400_000;
    return days >= 45;
  });

  const segments: Array<{ key: string; label: string; definition: string; rows: CustomerProfileSignal[]; objective: string; exclusions: string[] }> = [
    {
      key: "frequent_guests",
      label: "Frequent guests",
      definition: "Visited at least 4 times in tracked history.",
      rows: frequent,
      objective: "Promote loyalty upsell and VIP experiences.",
      exclusions: ["Exclude users with active complaint flags."],
    },
    {
      key: "vip_customers",
      label: "VIP customers",
      definition: "At least one VIP visit or table experience.",
      rows: vip,
      objective: "Offer table and bottle package upgrades.",
      exclusions: ["Exclude customers with unresolved refunds."],
    },
    {
      key: "lapsed_guests",
      label: "Lapsed guests",
      definition: "No tracked visit in last 45 days.",
      rows: lapsed,
      objective: "Run re-engagement campaign with time-bound offer.",
      exclusions: ["Exclude users who opted out of marketing."],
    },
  ];

  return segments.map((segment) => {
    const status = segment.rows.length >= MIN_SEGMENT_SIZE ? "available" : "insufficient_data";

    return {
      key: segment.key,
      label: segment.label,
      definition: segment.definition,
      audienceSize: segment.rows.length,
      requiredPermissions: ["crm.manage", "marketing.manage"],
      dataFreshnessMinutes: input.lastDataAt ? Math.floor((Date.now() - input.lastDataAt.getTime()) / 60_000) : null,
      objective: segment.objective,
      exclusions: segment.exclusions,
      privacyLimitations: ["Segments are venue-scoped and should not be exported with personal identifiers."],
      status,
      provenance: buildProvenance({
        sourceType: "derived",
        sourceTables: ["venue_customer_profiles", "venue_loyalty_ledger", "venue_vip_reservations"],
        lastDataAt: input.lastDataAt,
        sampleSize: segment.rows.length,
        confidenceLevel: segment.rows.length >= 20 ? "high" : segment.rows.length >= MIN_SEGMENT_SIZE ? "medium" : "low",
        confidenceScore: segment.rows.length >= 20 ? 0.86 : segment.rows.length >= MIN_SEGMENT_SIZE ? 0.63 : 0.35,
        status,
        limitations: status === "insufficient_data" ? ["Audience is below minimum cohort size for reliable targeting."] : [],
        isPartial: false,
      }),
    };
  });
}

export function buildRetentionSignals(input: { profile: CustomerProfileSignal; now: Date }) {
  const daysSinceLastVisit = input.profile.lastVisitAt
    ? Math.floor((input.now.getTime() - input.profile.lastVisitAt.getTime()) / 86_400_000)
    : 999;

  if (input.profile.visitCount <= 1) return "new";
  if (input.profile.vipVisitCount > 0 && daysSinceLastVisit < 30) return "vip_active";
  if (daysSinceLastVisit <= 14) return "engaged";
  if (daysSinceLastVisit <= 45) return "at_risk";
  if (daysSinceLastVisit <= 90) return "lapsed";
  return "returning";
}
