import { getServerFeatureFlagState } from "@/app/admin/lib/feature-flags";

type KillSwitchKey =
  | "bookings"
  | "payments"
  | "booking_payments"
  | "ticketing"
  | "ticket_checkout"
  | "ticket_scanning"
  | "refunds"
  | "guest_lists"
  | "social_messaging"
  | "animated_emoji"
  | "location_sharing"
  | "friend_qr"
  | "push_notifications"
  | "concierge"
  | "ai_provider"
  | "venue_intelligence"
  | "venue_os"
  | "realtime_presence"
  | "notifications"
  | "wallet_passes"
  | "promoter_tools"
  | "loyalty"
  | "advanced_admin"
  | "beta_only_features"
  | "google_places_imports"
  | "venue_image_refresh"
  | "live_cameras"
  | "admin_support_view";

const FLAG_BY_SWITCH: Record<KillSwitchKey, string> = {
  bookings: "feature.bookings",
  payments: "feature.payments",
  booking_payments: "feature.booking_payments",
  ticketing: "feature.ticketing",
  ticket_checkout: "feature.ticket_checkout",
  ticket_scanning: "feature.ticket_scanning",
  refunds: "feature.refunds",
  guest_lists: "feature.guest_lists",
  social_messaging: "feature.social_messaging",
  animated_emoji: "feature.animated_emoji",
  location_sharing: "feature.location_sharing",
  friend_qr: "feature.friend_qr",
  push_notifications: "feature.push_notifications",
  concierge: "feature.concierge",
  ai_provider: "feature.ai_provider",
  venue_intelligence: "feature.venue_intelligence",
  venue_os: "feature.venue_os",
  realtime_presence: "feature.realtime_presence",
  notifications: "feature.notifications",
  wallet_passes: "feature.wallet_passes",
  promoter_tools: "feature.promoter_tools",
  loyalty: "feature.loyalty",
  advanced_admin: "feature.advanced_admin",
  beta_only_features: "feature.beta_only_features",
  google_places_imports: "feature.google_places_imports",
  venue_image_refresh: "feature.venue_image_refresh",
  live_cameras: "feature.live_cameras",
  admin_support_view: "feature.admin_support_view",
};

export async function isKillSwitchEnabled(key: KillSwitchKey, context: {
  userId?: string;
  role?: string;
  venueId?: string;
  city?: string;
}) {
  const flagKey = FLAG_BY_SWITCH[key];

  const result = await getServerFeatureFlagState(flagKey, {
    environment: process.env.APP_ENV ?? process.env.NODE_ENV ?? "development",
    userId: context.userId,
    role: context.role,
    venueId: context.venueId,
    city: context.city,
    percentageSeed: context.userId ? context.userId.length : undefined,
  });

  // Convention: missing flag means not disabled. When flag exists and evaluates false,
  // the capability is considered kill-switched.
  if (result.source === "missing") {
    return false;
  }

  return !result.enabled;
}
