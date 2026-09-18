import "server-only";

import { isFeatureEnabled } from "@/lib/platform/feature-access";
import { isKillSwitchEnabled } from "@/lib/platform/kill-switches";

export type LivePlaybackActor = {
  userId: string | null;
  role: string | null;
  city?: string | null;
};

export async function evaluateLivePlaybackEntitlement(input: {
  actor: LivePlaybackActor;
  venueId: number;
  cameraPublicPlaybackEnabled: boolean;
}) {
  if (!input.cameraPublicPlaybackEnabled) {
    return { allowed: false as const, reason: "camera_not_public" as const };
  }

  const killSwitchEnabled = await isKillSwitchEnabled("live_cameras", {
    userId: input.actor.userId ?? undefined,
    role: input.actor.role ?? undefined,
    venueId: String(input.venueId),
    city: input.actor.city ?? undefined,
  });

  if (killSwitchEnabled) {
    return { allowed: false as const, reason: "kill_switch_enabled" as const };
  }

  const featureEnabled = await isFeatureEnabled("feature.live_cameras", {
    environment: process.env.APP_ENV ?? process.env.NODE_ENV ?? "development",
    userId: input.actor.userId ?? undefined,
    role: input.actor.role ?? undefined,
    venueId: input.venueId,
    city: input.actor.city ?? undefined,
  });

  if (!featureEnabled) {
    return { allowed: false as const, reason: "feature_disabled" as const };
  }

  const premiumRequired = process.env.LIVE_PLAYBACK_REQUIRE_PREMIUM === "true";
  if (!premiumRequired) {
    return { allowed: true as const, reason: "allowed" as const };
  }

  const premiumUsers = new Set(
    (process.env.LIVE_PLAYBACK_PREMIUM_USER_IDS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );

  if (input.actor.userId && premiumUsers.has(input.actor.userId)) {
    return { allowed: true as const, reason: "allowed" as const };
  }

  return { allowed: false as const, reason: "premium_required" as const };
}
