import { getPlaybackAuthorizationTtlSeconds } from "@/lib/live/config";
import type { evaluateLivePlaybackEntitlement, LivePlaybackActor } from "@/lib/live/entitlement";
import type { LiveProviderError, LiveStreamProvider } from "@/lib/live/provider/types";
import { mapNightlyStreamState } from "@/lib/live/stream-state";

export type PlaybackVenueRecord = {
  id: number;
  slug: string | null;
  name: string;
  publicationStatus: string;
  city: string | null;
};

export type PlaybackCameraRecord = {
  id: number;
  name: string;
  venueId: number;
  status: string;
  isPrimary: boolean;
  providerLiveInputId: string | null;
  provisioningStatus: string;
  lastKnownStreamStatus: string | null;
  publicPlaybackEnabled: boolean;
};

export type PlaybackLogger = {
  info: (event: string, metadata: Record<string, unknown>) => void;
  warn: (event: string, metadata: Record<string, unknown>) => void;
  error: (event: string, metadata: Record<string, unknown>) => void;
};

export type LivePlaybackAuthorizationResult = {
  status: "ok" | "denied" | "offline" | "error" | "provider_unavailable";
  reason: string;
  state: "provisioning" | "ready" | "live" | "offline" | "error" | "disabled";
  venue: { id: number; slug: string; name: string } | null;
  camera: { id: number; name: string } | null;
  playback: null | {
    protocol: "hls";
    hlsUrl: string;
    expiresAtIso: string;
  };
};

function toVenueModel(venue: PlaybackVenueRecord) {
  return {
    id: venue.id,
    slug: venue.slug ?? String(venue.id),
    name: venue.name,
  };
}

export function selectEligiblePlaybackCamera(cameras: PlaybackCameraRecord[], requestedCameraId?: number | null) {
  if (requestedCameraId) {
    return cameras.find((camera) => camera.id === requestedCameraId) ?? null;
  }

  return cameras.find((camera) => camera.isPrimary) ?? cameras[0] ?? null;
}

function providerErrorReason(error: unknown) {
  const maybe = error as LiveProviderError | undefined;
  if (maybe?.name === "LiveProviderError" && maybe.code) {
    return `provider_${maybe.code}`;
  }
  return "provider_error";
}

export async function authorizeLivePlaybackCore(input: {
  venue: PlaybackVenueRecord | null;
  cameras: PlaybackCameraRecord[];
  cameraId?: number | null;
  actor: LivePlaybackActor;
  provider: LiveStreamProvider;
  logger: PlaybackLogger;
  onCameraHealthObserved: (cameraId: number, providerStatus: string | null) => Promise<void>;
  evaluateEntitlement?: typeof evaluateLivePlaybackEntitlement;
}): Promise<LivePlaybackAuthorizationResult> {
  const { venue } = input;
  if (!venue || venue.publicationStatus !== "published") {
    return {
      status: "denied",
      reason: "venue_not_available",
      state: "offline",
      venue: null,
      camera: null,
      playback: null,
    };
  }

  const selected = selectEligiblePlaybackCamera(input.cameras, input.cameraId);
  if (!selected) {
    return {
      status: "offline",
      reason: "no_enabled_camera",
      state: "offline",
      venue: toVenueModel(venue),
      camera: null,
      playback: null,
    };
  }

  const evaluateEntitlement =
    input.evaluateEntitlement ??
    (await import("@/lib/live/entitlement")).evaluateLivePlaybackEntitlement;
  const entitlement = await evaluateEntitlement({
    actor: { ...input.actor, city: venue.city },
    venueId: venue.id,
    cameraPublicPlaybackEnabled: selected.publicPlaybackEnabled,
  });

  if (!entitlement.allowed) {
    return {
      status: "denied",
      reason: entitlement.reason,
      state: mapNightlyStreamState({
        cameraEnabled: selected.status === "enabled",
        provisioningStatus: selected.provisioningStatus,
        providerStatus: selected.lastKnownStreamStatus,
      }),
      venue: toVenueModel(venue),
      camera: { id: selected.id, name: selected.name },
      playback: null,
    };
  }

  if (!selected.providerLiveInputId) {
    return {
      status: "offline",
      reason: "camera_unprovisioned",
      state: "provisioning",
      venue: toVenueModel(venue),
      camera: { id: selected.id, name: selected.name },
      playback: null,
    };
  }

  if (!input.provider.isConfigured()) {
    return {
      status: "provider_unavailable",
      reason: "provider_not_configured",
      state: "error",
      venue: toVenueModel(venue),
      camera: { id: selected.id, name: selected.name },
      playback: null,
    };
  }

  try {
    input.logger.info("playback_requested", {
      venueId: venue.id,
      cameraId: selected.id,
      actorRole: input.actor.role,
      authenticated: Boolean(input.actor.userId),
    });

    const health = await input.provider.getStreamHealth(selected.providerLiveInputId);
    await input.onCameraHealthObserved(selected.id, health.providerStatus);

    const state = mapNightlyStreamState({
      cameraEnabled: selected.status === "enabled",
      provisioningStatus: selected.provisioningStatus,
      providerStatus: health.providerStatus,
      lifecycleLive: health.isLive,
    });

    if (state !== "live") {
      input.logger.warn("playback_failed", {
        venueId: venue.id,
        cameraId: selected.id,
        reason: "camera_offline",
      });

      return {
        status: "offline",
        reason: "camera_offline",
        state,
        venue: toVenueModel(venue),
        camera: { id: selected.id, name: selected.name },
        playback: null,
      };
    }

    if (!health.activeVideoId || !health.playbackHost) {
      return {
        status: "offline",
        reason: "live_video_unavailable",
        state: "offline",
        venue: toVenueModel(venue),
        camera: { id: selected.id, name: selected.name },
        playback: null,
      };
    }

    const nowUnix = Math.floor(Date.now() / 1000);
    const ttlSeconds = getPlaybackAuthorizationTtlSeconds();
    const expiresAtUnix = nowUnix + ttlSeconds;

    const authorization = await input.provider.createPlaybackAuthorization(health.activeVideoId, expiresAtUnix);
    if (!authorization.token) {
      return {
        status: "error",
        reason: "authorization_unavailable",
        state: "error",
        venue: toVenueModel(venue),
        camera: { id: selected.id, name: selected.name },
        playback: null,
      };
    }

    input.logger.info("playback_started", {
      venueId: venue.id,
      cameraId: selected.id,
      actorRole: input.actor.role,
    });

    return {
      status: "ok",
      reason: "authorized",
      state: "live",
      venue: toVenueModel(venue),
      camera: { id: selected.id, name: selected.name },
      playback: {
        protocol: "hls",
        hlsUrl:
          authorization.hlsUrl ??
          `https://${health.playbackHost}/${authorization.token}/manifest/video.m3u8`,
        expiresAtIso: new Date(authorization.expiresAtUnix * 1000).toISOString(),
      },
    };
  } catch (error) {
    const reason = providerErrorReason(error);
    input.logger.error("playback_failed", {
      venueId: venue.id,
      cameraId: selected.id,
      reason,
    });

    return {
      status: "provider_unavailable",
      reason,
      state: "error",
      venue: toVenueModel(venue),
      camera: { id: selected.id, name: selected.name },
      playback: null,
    };
  }
}
