export type BetaScopeFeature = {
  lane: "consumer" | "dj" | "owner" | "admin" | "platform";
  title: string;
  status: "included" | "deferred";
  summary: string;
  flagKey?: string;
};

export const BETA_V1_INCLUDED_FEATURES: BetaScopeFeature[] = [
  {
    lane: "consumer",
    title: "Authentication and onboarding",
    status: "included",
    summary: "Sign up, sign in, role selection, and consumer onboarding remain in scope.",
  },
  {
    lane: "consumer",
    title: "Discovery and detail views",
    status: "included",
    summary: "Home, explore, venue detail, event detail, save flows, and profile remain in scope.",
  },
  {
    lane: "consumer",
    title: "Concierge deterministic mode",
    status: "included",
    summary: "Concierge stays available only in deterministic fallback mode while provider usage is gated.",
    flagKey: "feature.concierge",
  },
  {
    lane: "consumer",
    title: "Basic social and messaging",
    status: "included",
    summary: "Basic Social Circle, direct/group messaging, standard emoji, and friend code/QR stay in scope.",
    flagKey: "feature.social_messaging",
  },
  {
    lane: "consumer",
    title: "Profile photo and avatar",
    status: "included",
    summary: "Personal profile photo upload and avatar selection remain part of beta.",
  },
  {
    lane: "consumer",
    title: "Language preference architecture",
    status: "included",
    summary: "English and Spanish preference storage with English fallback remains in scope.",
  },
  {
    lane: "consumer",
    title: "Night out planning",
    status: "included",
    summary: "Basic planning and stable guest list or ticket access stay in beta if the supporting flow is healthy.",
    flagKey: "feature.bookings",
  },
  {
    lane: "dj",
    title: "DJ onboarding and profile",
    status: "included",
    summary: "DJ onboarding, public profile, availability basics, and sample mix playback remain in scope.",
  },
  {
    lane: "owner",
    title: "Venue onboarding and editing",
    status: "included",
    summary: "Venue onboarding, Google Places import, venue edit, media upload, and event creation remain in scope.",
    flagKey: "feature.google_places_imports",
  },
  {
    lane: "owner",
    title: "Owner analytics overview",
    status: "included",
    summary: "The basic owner analytics and event management overview stay in beta.",
  },
  {
    lane: "admin",
    title: "Admin control center",
    status: "included",
    summary: "User search, moderation, feature flags, health, audit, and beta cohort management remain in scope.",
    flagKey: "feature.advanced_admin",
  },
  {
    lane: "platform",
    title: "Feature-flag control plane",
    status: "included",
    summary: "Flag storage, overrides, history, and server-side evaluation stay in scope.",
  },
];

export const BETA_V1_DEFERRED_FEATURES: BetaScopeFeature[] = [
  {
    lane: "owner",
    title: "Live cameras",
    status: "deferred",
    summary: "Live camera management is post-beta and remains disabled by default.",
    flagKey: "feature.live_cameras",
  },
  {
    lane: "owner",
    title: "VenueOS",
    status: "deferred",
    summary: "Full VenueOS operations and deep inventory workflows are deferred.",
    flagKey: "feature.venue_os",
  },
  {
    lane: "consumer",
    title: "Realtime presence and location sharing",
    status: "deferred",
    summary: "Presence, exact location sharing, and live updates stay deferred until beta proves stable.",
    flagKey: "feature.realtime_presence",
  },
  {
    lane: "consumer",
    title: "Animated emoji and stickers",
    status: "deferred",
    summary: "Animated emoji, sticker packs, and custom assets remain behind flags.",
    flagKey: "feature.animated_emoji",
  },
  {
    lane: "platform",
    title: "Payments, refunds, and wallet passes",
    status: "deferred",
    summary: "Production payment automation, refunds, and wallet passes are post-beta.",
    flagKey: "feature.booking_payments",
  },
  {
    lane: "platform",
    title: "AI provider usage",
    status: "deferred",
    summary: "Provider-backed AI features stay disabled unless explicitly enabled for a beta cohort.",
    flagKey: "feature.ai_provider",
  },
  {
    lane: "admin",
    title: "Advanced admin and impersonation",
    status: "deferred",
    summary: "Advanced admin impersonation and enterprise exports remain out of beta scope.",
    flagKey: "feature.advanced_admin",
  },
];

export const BETA_V1_REQUIRED_FLAG_KEYS = [
  "feature.bookings",
  "feature.booking_payments",
  "feature.ticketing",
  "feature.ticket_scanning",
  "feature.refunds",
  "feature.social_messaging",
  "feature.animated_emoji",
  "feature.realtime_presence",
  "feature.location_sharing",
  "feature.concierge",
  "feature.ai_provider",
  "feature.venue_intelligence",
  "feature.venue_os",
  "feature.live_cameras",
  "feature.push_notifications",
  "feature.wallet_passes",
  "feature.promoter_tools",
  "feature.loyalty",
  "feature.advanced_admin",
  "feature.beta_only_features",
  "feature.google_places_imports",
  "feature.venue_image_refresh",
] as const;

export function getBetaV1ScopeSnapshot() {
  return {
    includedFeatures: BETA_V1_INCLUDED_FEATURES,
    deferredFeatures: BETA_V1_DEFERRED_FEATURES,
    requiredFlagKeys: [...BETA_V1_REQUIRED_FLAG_KEYS],
  };
}