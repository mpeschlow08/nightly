import { confidenceFromSample } from "./confidence";
import { deriveDataStatus, limitationsFromStatus } from "./data-quality";
import { moneyPerAttendee } from "./metrics";
import { buildProvenance } from "./provenance";
import type { RevenueForecast } from "./types";

export type RevenueSignals = {
  eventId: number | null;
  confirmedTicketGrossCents: number;
  confirmedBookingGrossCents: number;
  confirmedVipGrossCents: number;
  confirmedTableGrossCents: number;
  pendingTicketCents: number;
  estimatedBottleCents: number;
  refundsCents: number;
  platformFeesCents: number;
  promoterCommissionCents: number;
  estimatedAttendance: number;
  sampleSize: number;
  lastDataAt: Date | null;
};

export function buildRevenueForecast(input: RevenueSignals): RevenueForecast {
  const confirmedGrossCents = input.confirmedTicketGrossCents + input.confirmedBookingGrossCents + input.confirmedVipGrossCents + input.confirmedTableGrossCents;
  const confirmedNetCents = Math.max(0, confirmedGrossCents - input.refundsCents - input.platformFeesCents - input.promoterCommissionCents);

  const estimatedGrossCents = Math.max(0, input.pendingTicketCents + input.estimatedBottleCents);
  const estimatedNetCents = Math.max(0, estimatedGrossCents - Math.round(estimatedGrossCents * 0.08));

  const totalProjectedNet = confirmedNetCents + estimatedNetCents;
  const lowNetCents = Math.round(totalProjectedNet * 0.85);
  const highNetCents = Math.round(totalProjectedNet * 1.12);

  const status = deriveDataStatus({
    sampleSize: input.sampleSize,
    minimumSampleSize: 3,
    lastDataAt: input.lastDataAt,
  });

  const confidence = confidenceFromSample(input.sampleSize, 12);
  const exclusions = [
    "Offline bar tabs are excluded unless recorded in inventory/CRM systems.",
    "Unprocessed disputes are excluded from confirmed totals.",
  ];

  const limitations = limitationsFromStatus(status, input.sampleSize);

  return {
    confirmedGrossCents,
    confirmedNetCents,
    pendingRevenueCents: input.pendingTicketCents,
    estimatedGrossCents,
    estimatedNetCents,
    refundedCents: input.refundsCents,
    lowNetCents,
    highNetCents,
    revenuePerAttendeeCents: moneyPerAttendee(totalProjectedNet, input.estimatedAttendance),
    status: status === "insufficient_data" ? "estimated" : status,
    confidenceLevel: confidence.level,
    confidenceScore: confidence.score,
    assumptions: [
      "Pending ticket orders convert at current payment completion rate.",
      "Bottle demand follows recent comparable events.",
    ],
    exclusions,
    provenance: buildProvenance({
      sourceType: "derived",
      sourceTables: ["ticket_orders", "bookings", "venue_vip_reservations", "ticket_refunds", "promoter_event_assignments"],
      lastDataAt: input.lastDataAt,
      sampleSize: input.sampleSize,
      confidenceLevel: confidence.level,
      confidenceScore: confidence.score,
      status: status === "insufficient_data" ? "estimated" : status,
      limitations,
      isEstimated: estimatedGrossCents > 0,
      isPartial: status === "stale" || status === "unavailable",
    }),
  };
}
