export type IntelligenceStatus =
  | "available"
  | "estimated"
  | "insufficient_data"
  | "stale"
  | "unavailable"
  | "configuration_required"
  | "error";

export type ConfidenceLevel = "low" | "medium" | "high";

export type ProviderKind = "deterministic" | "ai";

export type Provenance = {
  sourceType: "database" | "derived" | "adapter";
  sourceTables: string[];
  sourceWindowStart: string | null;
  sourceWindowEnd: string | null;
  generatedAt: string;
  lastDataAt: string | null;
  sampleSize: number | null;
  confidenceLevel: ConfidenceLevel;
  confidenceScore: number | null;
  status: IntelligenceStatus;
  limitations: string[];
  isEstimated: boolean;
  isPartial: boolean;
  providerUsed: ProviderKind;
  modelVersion: string;
};

export type IntelligenceMetric = {
  key: string;
  label: string;
  value: number;
  unit: "count" | "percent" | "cents" | "minutes" | "ratio";
  trend: "up" | "down" | "flat";
  trendDelta: number;
  status: IntelligenceStatus;
  provenance: Provenance;
};

export type ForecastRange = {
  expected: number;
  low: number;
  high: number;
  status: IntelligenceStatus;
  confidenceLevel: ConfidenceLevel;
  confidenceScore: number | null;
  keySignals: string[];
  limitations: string[];
  provenance: Provenance;
};

export type RevenueForecast = {
  confirmedGrossCents: number;
  confirmedNetCents: number;
  pendingRevenueCents: number;
  estimatedGrossCents: number;
  estimatedNetCents: number;
  refundedCents: number;
  lowNetCents: number;
  highNetCents: number;
  revenuePerAttendeeCents: number | null;
  status: IntelligenceStatus;
  confidenceLevel: ConfidenceLevel;
  confidenceScore: number | null;
  assumptions: string[];
  exclusions: string[];
  provenance: Provenance;
};

export type StaffingRecommendation = {
  doorStaff: number;
  security: number;
  bartenders: number;
  servers: number;
  vipHosts: number;
  floorManagers: number;
  checkinStations: number;
  shiftWindows: Array<{ label: string; startIso: string; endIso: string }>;
  backupStaff: number;
  status: IntelligenceStatus;
  confidenceLevel: ConfidenceLevel;
  rationale: string[];
  provenance: Provenance;
};

export type InventoryRecommendation = {
  itemId: number;
  itemName: string;
  expectedConsumption: number;
  recommendedAvailable: number;
  reorderQuantity: number;
  shortageRisk: number;
  overstockRisk: number;
  status: IntelligenceStatus;
  assumptions: string[];
  provenance: Provenance;
};

export type EventHealth = {
  eventId: number;
  eventName: string;
  demandHealth: number;
  revenueHealth: number;
  readinessHealth: number;
  marketingHealth: number;
  overallHealth: number;
  riskFlags: string[];
  recommendedActions: string[];
  status: IntelligenceStatus;
  provenance: Provenance;
};

export type CustomerSegmentRecommendation = {
  key: string;
  label: string;
  definition: string;
  audienceSize: number;
  requiredPermissions: string[];
  dataFreshnessMinutes: number | null;
  objective: string;
  exclusions: string[];
  privacyLimitations: string[];
  status: IntelligenceStatus;
  provenance: Provenance;
};

export type MarketingRecommendation = {
  title: string;
  goal: string;
  audience: string;
  timing: string;
  channel: "push" | "email" | "sms" | "in_app" | "social";
  messageAngle: string;
  expectedReason: string;
  requiresOwnerApproval: boolean;
  confidenceLevel: ConfidenceLevel;
  restrictions: string[];
  provenance: Provenance;
};

export type CampaignDraft = {
  title: string;
  subject: string;
  shortCopy: string;
  longCopy: string;
  cta: string;
  audience: string;
  scheduleSuggestion: string;
  complianceNotes: string;
  preview: string;
  providerUsed: ProviderKind;
  modelVersion: string;
};

export type Anomaly = {
  severity: "low" | "medium" | "high" | "critical";
  metric: string;
  expectedRange: string;
  actualValue: string;
  confidenceLevel: ConfidenceLevel;
  possibleExplanations: string[];
  recommendedInvestigation: string;
  status: IntelligenceStatus;
  provenance: Provenance;
};

export type PromoterInsight = {
  promoterProfileId: number;
  promoterName: string;
  assignedEvents: number;
  ticketSales: number;
  guestListArrivals: number;
  conversionRate: number;
  attributedRevenueCents: number;
  recommendation: string;
  status: IntelligenceStatus;
  provenance: Provenance;
};

export type PricingRecommendation = {
  productType: string;
  currentPriceCents: number;
  suggestedLowCents: number;
  suggestedHighCents: number;
  rationale: string;
  risk: "low" | "medium" | "high";
  confidenceLevel: ConfidenceLevel;
  effectiveWindow: string;
  requiresApproval: boolean;
  status: IntelligenceStatus;
  provenance: Provenance;
};

export type IntelligenceOverview = {
  scorecard: {
    scoreVersion: string;
    compositeScore: number | null;
    status: IntelligenceStatus;
    components: IntelligenceMetric[];
    weights: Record<string, number>;
  };
  attendanceForecast: ForecastRange;
  revenueForecast: RevenueForecast;
  staffingRecommendation: StaffingRecommendation;
  inventoryRisks: InventoryRecommendation[];
  eventHealth: EventHealth[];
  customerSegments: CustomerSegmentRecommendation[];
  marketingRecommendations: MarketingRecommendation[];
  anomalies: Anomaly[];
  promoterInsights: PromoterInsight[];
  pricingRecommendations: PricingRecommendation[];
  generatedAt: string;
};

export type AskBusinessAnswer = {
  answer: string;
  structured: {
    attendanceForecast: ForecastRange | null;
    revenueForecast: RevenueForecast | null;
    staffingRecommendation: StaffingRecommendation | null;
    inventoryRisks: InventoryRecommendation[];
    marketingRecommendations: MarketingRecommendation[];
    anomalies: Anomaly[];
  };
  provenance: Provenance;
};
