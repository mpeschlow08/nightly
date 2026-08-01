import { confidenceFromSample } from "./confidence";
import { deriveDataStatus, limitationsFromStatus } from "./data-quality";
import { clamp } from "./metrics";
import { buildProvenance } from "./provenance";
import type { ForecastRange } from "./types";

export type AttendanceSignals = {
  eventId: number;
  venueCapacity: number;
  historicalAttendance: number[];
  ticketsSold: number;
  guestListApproved: number;
  guestListShowRate: number;
  rsvpCount: number;
  vipReservations: number;
  tableReservations: number;
  discoverySaves: number;
  discoveryShares: number;
  conciergeReferrals: number;
  lastDataAt: Date | null;
};

export function buildAttendanceForecast(input: AttendanceSignals): ForecastRange {
  const comparableCount = input.historicalAttendance.length;
  const avgHistorical = comparableCount > 0
    ? input.historicalAttendance.reduce((sum, value) => sum + value, 0) / comparableCount
    : 0;

  const demandFromKnown =
    input.ticketsSold +
    Math.round(input.guestListApproved * input.guestListShowRate) +
    Math.round(input.rsvpCount * 0.45) +
    Math.round(input.vipReservations * 2.2) +
    Math.round(input.tableReservations * 3);

  const engagementLift = Math.round(input.discoverySaves * 0.12 + input.discoveryShares * 0.28 + input.conciergeReferrals * 0.18);

  const blended = comparableCount >= 3
    ? Math.round(demandFromKnown * 0.6 + avgHistorical * 0.35 + engagementLift)
    : Math.round(demandFromKnown + engagementLift);

  const expected = clamp(blended, 0, Math.max(input.venueCapacity, blended));
  const low = Math.max(0, Math.round(expected * 0.82));
  const high = Math.max(low, Math.round(Math.min(input.venueCapacity, expected * 1.14)));

  const status = deriveDataStatus({
    sampleSize: comparableCount,
    minimumSampleSize: 3,
    lastDataAt: input.lastDataAt,
  });

  const confidence = confidenceFromSample(comparableCount, 12);
  const limitations = limitationsFromStatus(status, comparableCount);

  return {
    expected,
    low,
    high,
    status: status === "insufficient_data" ? "estimated" : status,
    confidenceLevel: confidence.level,
    confidenceScore: confidence.score,
    keySignals: [
      `Tickets sold: ${input.ticketsSold}`,
      `Guest-list approvals: ${input.guestListApproved}`,
      `VIP reservations: ${input.vipReservations}`,
      `Comparable events: ${comparableCount}`,
    ],
    limitations,
    provenance: buildProvenance({
      sourceType: "derived",
      sourceTables: ["ticket_orders", "guest_list_entries", "venue_vip_reservations", "event_analytics_daily"],
      lastDataAt: input.lastDataAt,
      sampleSize: comparableCount,
      confidenceLevel: confidence.level,
      confidenceScore: confidence.score,
      status: status === "insufficient_data" ? "estimated" : status,
      limitations,
      isEstimated: comparableCount < 3,
      isPartial: status === "stale" || status === "unavailable",
    }),
  };
}
