import { buildProvenance } from "./provenance";
import type { StaffingRecommendation } from "./types";

export function buildStaffingRecommendation(input: {
  forecastAttendance: number;
  venueCapacity: number;
  vipReservations: number;
  tableReservations: number;
  incidentRate: number;
  certifiedSecurityCount: number;
  lastDataAt: Date | null;
}): StaffingRecommendation {
  const capacityFactor = input.venueCapacity > 0 ? input.forecastAttendance / input.venueCapacity : 0;
  const baseDoor = Math.max(1, Math.ceil(input.forecastAttendance / 180));
  const baseSecurity = Math.max(1, Math.ceil(input.forecastAttendance / 140) + (input.incidentRate > 0.08 ? 1 : 0));

  return {
    doorStaff: baseDoor,
    security: Math.max(baseSecurity, Math.min(baseSecurity + 1, input.certifiedSecurityCount || baseSecurity)),
    bartenders: Math.max(2, Math.ceil(input.forecastAttendance / 110)),
    servers: Math.max(1, Math.ceil((input.tableReservations + input.vipReservations) / 6)),
    vipHosts: Math.max(1, Math.ceil(input.vipReservations / 10)),
    floorManagers: capacityFactor > 0.75 ? 2 : 1,
    checkinStations: Math.max(1, Math.ceil(input.forecastAttendance / 220)),
    backupStaff: capacityFactor > 0.8 ? 3 : 1,
    shiftWindows: [
      { label: "Pre-doors", startIso: "-2h", endIso: "+0h" },
      { label: "Peak window", startIso: "+1h", endIso: "+4h" },
      { label: "Close-out", startIso: "+4h", endIso: "+6h" },
    ],
    status: "available",
    confidenceLevel: capacityFactor > 0.7 ? "high" : "medium",
    rationale: [
      `Forecast attendance ${input.forecastAttendance} against capacity ${input.venueCapacity}.`,
      `VIP reservations ${input.vipReservations} and tables ${input.tableReservations} increase service demand.`,
      "Recommendations are advisory only and require manager approval before scheduling.",
    ],
    provenance: buildProvenance({
      sourceType: "derived",
      sourceTables: ["venue_shifts", "venue_time_entries", "venue_vip_reservations", "venue_incident_reports"],
      lastDataAt: input.lastDataAt,
      sampleSize: input.forecastAttendance,
      confidenceLevel: capacityFactor > 0.7 ? "high" : "medium",
      confidenceScore: Math.min(1, Math.max(0.35, capacityFactor + 0.2)),
      status: "available",
      limitations: ["No labor-law validation is performed by this recommendation."],
      isEstimated: true,
    }),
  };
}
