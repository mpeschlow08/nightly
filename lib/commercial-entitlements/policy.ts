export const COMMERCIAL_SCOPES = ["organization", "venue", "device", "consumer", "artist"] as const;
export type CommercialScope = (typeof COMMERCIAL_SCOPES)[number];

export const COMMERCIAL_PRODUCTS = ["venue_package", "consumer_premium", "artist_subscription"] as const;
export type CommercialProduct = (typeof COMMERCIAL_PRODUCTS)[number];

export const COMMERCIAL_STATES = ["trialing", "active", "grace_period", "past_due", "suspended", "cancel_pending", "cancelled", "expired"] as const;
export type CommercialState = (typeof COMMERCIAL_STATES)[number];

export const COMMERCIAL_SERVICE_PURPOSES = ["device_diagnostics", "device_reprovision", "commissioning", "sales_demo", "commercial_support"] as const;
export type CommercialServicePurpose = (typeof COMMERCIAL_SERVICE_PURPOSES)[number];
export const SERVICE_CAPABILITIES_BY_PURPOSE: Readonly<Record<CommercialServicePurpose, readonly CommercialCapability[]>> = {
  device_diagnostics: ["service.device_diagnostics"],
  device_reprovision: ["service.device_reprovision", "service.device_diagnostics"],
  commissioning: ["service.commissioning", "service.device_diagnostics"],
  sales_demo: ["service.device_diagnostics"],
  commercial_support: ["service.device_diagnostics", "service.device_reprovision"],
};

export const COMMERCIAL_CAPABILITIES = [
  "venue.venueos",
  "venue.hot_moments",
  "venue.hot_reels",
  "venue.ai_director",
  "venue.social_publishing",
  "venue.artist_sessions",
  "venue.analytics",
  "venue.remote_media",
  "device.capture",
  "device.local_buffer",
  "device.hot_moments",
  "device.remote_output",
  "device.management",
  "consumer.hot_reels_unlimited",
  "consumer.ai_concierge",
  "consumer.friend_radar",
  "consumer.night_out",
  "consumer.social_circle_advanced",
  "consumer.ad_free",
  "consumer.early_access",
  "artist.dashboard",
  "artist.performance_sessions",
  "artist.hot_reels",
  "artist.analytics",
  "artist.social_distribution",
  "service.device_diagnostics",
  "service.device_reprovision",
  "service.commissioning",
] as const;
export type CommercialCapability = (typeof COMMERCIAL_CAPABILITIES)[number];

export const CONSUMER_PREMIUM_TARGET_PRICE_CENTS = 999;
export const CONSUMER_PREMIUM_TRIAL_DAYS = 30;
export const DEFAULT_DEVICE_OFFLINE_ENTITLEMENT_HOURS = 72;

export function configuredDeviceOfflineEntitlementHours(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.NIGHTLY_DEVICE_OFFLINE_ENTITLEMENT_HOURS;
  if (!raw) return DEFAULT_DEVICE_OFFLINE_ENTITLEMENT_HOURS;
  if (!/^\d{1,3}$/.test(raw)) return DEFAULT_DEVICE_OFFLINE_ENTITLEMENT_HOURS;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 1 && value <= 168 ? value : DEFAULT_DEVICE_OFFLINE_ENTITLEMENT_HOURS;
}

export const CAPABILITIES_BY_PRODUCT: Readonly<Record<CommercialProduct, readonly CommercialCapability[]>> = {
  venue_package: [
    "venue.venueos", "venue.hot_moments", "venue.hot_reels", "venue.ai_director", "venue.social_publishing",
    "venue.artist_sessions", "venue.analytics", "venue.remote_media", "device.capture", "device.local_buffer",
    "device.hot_moments", "device.remote_output", "device.management",
  ],
  consumer_premium: [
    "consumer.hot_reels_unlimited", "consumer.ai_concierge", "consumer.friend_radar", "consumer.night_out",
    "consumer.social_circle_advanced", "consumer.ad_free", "consumer.early_access",
  ],
  artist_subscription: [
    "artist.dashboard", "artist.performance_sessions", "artist.hot_reels", "artist.analytics", "artist.social_distribution",
  ],
};

export type CommercialSubscriptionSnapshot = {
  product: CommercialProduct;
  state: CommercialState;
  startsAt: Date;
  trialEndsAt: Date | null;
  graceUntil: Date | null;
  endsAt: Date | null;
};

export type EntitlementReason =
  | "active_subscription"
  | "active_trial"
  | "grace_period"
  | "manual_grant"
  | "service_authorization"
  | "subscription_required"
  | "trial_expired"
  | "suspended"
  | "cancelled"
  | "expired"
  | "scope_mismatch"
  | "scope_unavailable"
  | "capability_disabled"
  | "service_auth_expired"
  | "service_auth_revoked";

export type EntitlementDecision = {
  allowed: boolean;
  capability: CommercialCapability;
  scope: CommercialScope;
  commercialState: CommercialState | "none";
  source: "subscription" | "manual_grant" | "service_authorization" | "none";
  reasonCode: EntitlementReason;
  expiresAt: Date | null;
  graceUntil: Date | null;
  trialEndsAt: Date | null;
  evaluatedAt: Date;
};

export function evaluateSubscriptionCapability(input: {
  scope: CommercialScope;
  capability: CommercialCapability;
  subscription: CommercialSubscriptionSnapshot | null;
  now?: Date;
}): EntitlementDecision {
  const now = input.now ?? new Date();
  const base = {
    capability: input.capability,
    scope: input.scope,
    evaluatedAt: now,
  };
  if (input.scope === "organization") {
    return { ...base, allowed: false, commercialState: "none", source: "none", reasonCode: "scope_mismatch", expiresAt: null, graceUntil: null, trialEndsAt: null };
  }
  const subscription = input.subscription;
  if (!subscription || !CAPABILITIES_BY_PRODUCT[subscription.product].includes(input.capability)) {
    return { ...base, allowed: false, commercialState: subscription?.state ?? "none", source: "none", reasonCode: subscription ? "capability_disabled" : "subscription_required", expiresAt: subscription?.endsAt ?? null, graceUntil: subscription?.graceUntil ?? null, trialEndsAt: subscription?.trialEndsAt ?? null };
  }
  if (subscription.startsAt > now) {
    return { ...base, allowed: false, commercialState: subscription.state, source: "none", reasonCode: "subscription_required", expiresAt: subscription.endsAt, graceUntil: subscription.graceUntil, trialEndsAt: subscription.trialEndsAt };
  }
  if (subscription.endsAt && subscription.endsAt <= now) {
    return { ...base, allowed: false, commercialState: "expired", source: "none", reasonCode: "expired", expiresAt: subscription.endsAt, graceUntil: subscription.graceUntil, trialEndsAt: subscription.trialEndsAt };
  }
  if (subscription.state === "active" || subscription.state === "cancel_pending") {
    return { ...base, allowed: true, commercialState: subscription.state, source: "subscription", reasonCode: "active_subscription", expiresAt: subscription.endsAt, graceUntil: subscription.graceUntil, trialEndsAt: subscription.trialEndsAt };
  }
  if (subscription.state === "trialing") {
    const trialActive = subscription.trialEndsAt !== null && subscription.trialEndsAt > now;
    return { ...base, allowed: trialActive, commercialState: trialActive ? "trialing" : "expired", source: trialActive ? "subscription" : "none", reasonCode: trialActive ? "active_trial" : "trial_expired", expiresAt: subscription.endsAt, graceUntil: subscription.graceUntil, trialEndsAt: subscription.trialEndsAt };
  }
  if (subscription.state === "grace_period" || subscription.state === "past_due") {
    const graceActive = subscription.graceUntil !== null && subscription.graceUntil > now;
    return { ...base, allowed: graceActive, commercialState: graceActive ? "grace_period" : subscription.state, source: graceActive ? "subscription" : "none", reasonCode: graceActive ? "grace_period" : subscription.state === "past_due" ? "subscription_required" : "expired", expiresAt: subscription.endsAt, graceUntil: subscription.graceUntil, trialEndsAt: subscription.trialEndsAt };
  }
  if (subscription.state === "suspended") {
    return { ...base, allowed: false, commercialState: "suspended", source: "none", reasonCode: "suspended", expiresAt: subscription.endsAt, graceUntil: subscription.graceUntil, trialEndsAt: subscription.trialEndsAt };
  }
  return { ...base, allowed: false, commercialState: subscription.state, source: "none", reasonCode: subscription.state === "cancelled" ? "cancelled" : "expired", expiresAt: subscription.endsAt, graceUntil: subscription.graceUntil, trialEndsAt: subscription.trialEndsAt };
}

export function utcAllowanceDate(now: Date): string {
  if (!Number.isFinite(now.getTime())) throw new Error("commercial_clock_invalid");
  return now.toISOString().slice(0, 10);
}

export function deviceOfflineEntitlementExpiresAt(input: { issuedAt: Date; configuredHours: number }): Date {
  if (!Number.isFinite(input.issuedAt.getTime()) || !Number.isSafeInteger(input.configuredHours) || input.configuredHours < 1 || input.configuredHours > 168) {
    throw new Error("device_offline_entitlement_policy_invalid");
  }
  return new Date(input.issuedAt.getTime() + input.configuredHours * 60 * 60 * 1000);
}