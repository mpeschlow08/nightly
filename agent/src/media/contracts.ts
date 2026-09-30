export type MediaSourceKind = "IP_CAMERA" | "HDMI" | "MIXER_AUDIO" | "AMBIENT_AUDIO";
export type AudioRole = "PROGRAM_MIX" | "AMBIENT" | "CAMERA_AUDIO";
export type MediaAvailability = "UNKNOWN" | "NOT_TESTED" | "SUPPORTED" | "UNAVAILABLE";

export type AuthorizedMediaSource = {
  deviceId: number;
  venueId: number;
  sourceId: number;
  venueCameraId: number | null;
  kind: MediaSourceKind;
  audioRole: AudioRole | null;
  active: boolean;
  locator: string;
  privacyMasksRequired: boolean;
};

export type MediaPolicy = {
  deviceId: number;
  venueId: number;
  serviceActive: boolean;
  commercialState: string;
  commercialRevision: number;
  offlineEntitlementExpiresAt: number;
  allowedCapabilities: readonly string[];
  contentEligible: boolean;
  hotReelEligible: boolean;
  publicPublishingEnabled: boolean;
  privacyRestricted: boolean;
  masksApplied: boolean;
};

export type MediaCapabilities = {
  video: { codec: string | null; pixelFormat: string | null; width: number | null; height: number | null; frameRate: number | null; timeBase: string | null; hardwareDecode: MediaAvailability; hardwareEncode: MediaAvailability } | null;
  audio: { codec: string | null; sampleFormat: string | null; sampleRate: number | null; channels: number | null; channelLayout: string | null; timeBase: string | null } | null;
};

export type MediaSessionState = "STOPPED" | "STARTING" | "RUNNING" | "BACKOFF" | "FAILED";
export type MediaHealth = { state: MediaSessionState; reconnects: number; discontinuities: number; acceleration: "SOFTWARE" | "VAAPI" | "UNKNOWN"; lastErrorCode: string | null };

export function assertAuthorizedSource(source: AuthorizedMediaSource, policy: MediaPolicy): void {
  if (!Number.isSafeInteger(source.sourceId) || source.sourceId <= 0 || !Number.isSafeInteger(source.deviceId) || source.deviceId <= 0 ||
      !Number.isSafeInteger(source.venueId) || source.venueId <= 0 || source.deviceId !== policy.deviceId || source.venueId !== policy.venueId ||
      !source.active || !policy.serviceActive) throw new Error("Media source is not authorized for this device and venue.");
  if (source.kind === "IP_CAMERA" && (!Number.isSafeInteger(source.venueCameraId) || source.venueCameraId! <= 0)) {
    throw new Error("Camera source requires a canonical venue camera binding.");
  }
  if (!source.locator || source.locator.length > 2048 || /[\x00-\x1f]/.test(source.locator)) throw new Error("Media source locator is invalid.");
}

export function isHotMomentEligible(source: AuthorizedMediaSource, policy: MediaPolicy): boolean {
  try { assertAuthorizedSource(source, policy); } catch { return false; }
  return policy.contentEligible && policy.hotReelEligible && policy.publicPublishingEnabled && !policy.privacyRestricted &&
    (!source.privacyMasksRequired || policy.masksApplied);
}