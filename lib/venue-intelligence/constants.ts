export const INTELLIGENCE_ALGORITHM_VERSION = "nightly-intelligence-v1";

export const INTELLIGENCE_WEIGHTS = {
  profileCompleteness: 0.08,
  eventPublishing: 0.09,
  attendanceUtilization: 0.12,
  ticketConversion: 0.11,
  guestListConversion: 0.08,
  vipConversion: 0.08,
  bookingAcceptance: 0.08,
  refundRate: 0.08,
  customerRetention: 0.1,
  loyaltyEngagement: 0.08,
  incidentRate: 0.1,
  inventoryVariance: 0.08,
} as const;

export const MIN_BENCHMARK_COHORT_SIZE = 8;
export const MIN_SEGMENT_SIZE = 5;
export const STALE_MINUTES_DEFAULT = 90;

export const CONFIDENCE_THRESHOLDS = {
  high: 0.8,
  medium: 0.55,
} as const;

export const ANOMALY_SIGMA_THRESHOLD = 1.8;
