import type { ForecastRange, RevenueForecast, StaffingRecommendation } from "./types";

export function buildPreEventBriefing(input: {
  eventTitle: string;
  attendance: ForecastRange;
  revenue: RevenueForecast;
  staffing: StaffingRecommendation;
  inventoryRisks: string[];
  promoterStatus: string;
  weatherStatus: string;
}) {
  return [
    `Pre-event briefing for ${input.eventTitle}`,
    `Attendance: expected ${input.attendance.expected} (range ${input.attendance.low}-${input.attendance.high}).`,
    `Revenue: confirmed net ${Math.round(input.revenue.confirmedNetCents / 100)} USD; projected net range ${Math.round(input.revenue.lowNetCents / 100)}-${Math.round(input.revenue.highNetCents / 100)} USD.`,
    `Staffing: ${input.staffing.doorStaff} door, ${input.staffing.security} security, ${input.staffing.bartenders} bartenders.`,
    `Inventory watch: ${input.inventoryRisks.join(", ") || "No immediate shortages."}`,
    `Promoter status: ${input.promoterStatus}.`,
    `Weather/city adapter: ${input.weatherStatus}.`,
  ].join("\n");
}

export function buildPostEventRecap(input: {
  eventTitle: string;
  attendanceActual: number;
  revenueNetCents: number;
  refundsCents: number;
  incidents: number;
  topFollowUps: string[];
}) {
  return [
    `Post-event recap for ${input.eventTitle}`,
    `Attendance recorded: ${input.attendanceActual}.`,
    `Net revenue recorded: ${Math.round(input.revenueNetCents / 100)} USD.`,
    `Refunded amount: ${Math.round(input.refundsCents / 100)} USD.`,
    `Incidents logged: ${input.incidents}.`,
    `Follow-ups: ${input.topFollowUps.join("; ") || "No immediate follow-up actions."}`,
  ].join("\n");
}
