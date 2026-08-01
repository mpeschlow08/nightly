export const venueOsModuleKeys = [
  "operations",
  "staff",
  "scheduling",
  "floor",
  "tables",
  "vip",
  "inventory",
  "crm",
  "marketing",
  "loyalty",
  "reports",
] as const;

export type VenueOsModuleKey = (typeof venueOsModuleKeys)[number];

export type VenueOsMetric = {
  label: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "good" | "warning" | "critical";
};

export type VenueOsQueueItem = {
  id: number | string;
  title: string;
  subtitle?: string;
  status?: string;
  detail?: string;
};

export type VenueOsSectionPayload = {
  title: string;
  description: string;
  metrics: VenueOsMetric[];
  primaryQueue: VenueOsQueueItem[];
  secondaryQueue?: VenueOsQueueItem[];
};

export type VenueOsFinancialSnapshot = {
  ticketRevenueCents: number;
  bookingRevenueCents: number;
  vipRevenueCents: number;
  bottleRevenueCents: number;
  refundsCents: number;
  taxesCents: number;
  platformFeesCents: number;
  promoterCommissionsCents: number;
};

export type VenueOsAiInsightRequest = {
  venueId: number;
  eventId?: number | null;
  insightType:
    | "attendance_forecast"
    | "revenue_forecast"
    | "inventory_forecast"
    | "staffing_recommendation"
    | "marketing_recommendation"
    | "campaign_generation"
    | "customer_insight"
    | "event_scoring"
    | "operational_summary"
    | "nightly_recap";
  input: Record<string, unknown>;
};