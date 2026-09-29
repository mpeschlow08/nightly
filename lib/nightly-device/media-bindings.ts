export type MediaBindingRow = {
  id: number;
  deviceId: number;
  venueId: number;
  sourceType: string;
  venueCameraId: number | null;
  enabled: boolean;
  cameraVenueId: number | null;
  cameraStatus: string | null;
  cameraStreamType: string | null;
};

export type DeviceMediaBinding = {
  sourceId: number;
  deviceId: number;
  venueId: number;
  sourceType: "ip_camera" | "hdmi_input" | "mixer_audio" | "ambient_audio";
  venueCameraId: number | null;
  enabled: true;
  capability: "rtsp" | "not_tested";
};

export const MEDIA_CONFIG_TTL_SECONDS = 300;
export const MEDIA_CREDENTIAL_TTL_SECONDS = 60;

export function projectDeviceMediaConfig(rows: readonly MediaBindingRow[], deviceId: number, venueId: number | null, revision: string | null) {
  const currentRevision = revision && revision.length <= 128 ? revision : null;
  return {
    revision: currentRevision,
    ttlSeconds: MEDIA_CONFIG_TTL_SECONDS,
    sources: currentRevision ? projectDeviceMediaBindings(rows, deviceId, venueId) : [],
  };
}

export function canResolveDeviceMediaCredential(input: {
  source: MediaBindingRow;
  deviceId: number;
  venueId: number | null;
  expectedRevision: string;
  desiredConfigRevision: string | null;
  streamUrl: string | null;
}) {
  if (!input.desiredConfigRevision || input.desiredConfigRevision.length > 128 || input.expectedRevision !== input.desiredConfigRevision) return false;
  if (projectDeviceMediaBindings([input.source], input.deviceId, input.venueId)[0]?.capability !== "rtsp") return false;
  if (!input.streamUrl || input.streamUrl !== input.streamUrl.trim()) return false;
  try {
    const url = new URL(input.streamUrl);
    if (url.protocol !== "rtsp:" || !url.hostname || !url.username || !url.password || url.search || url.hash || input.streamUrl.length > 2048) return false;
    url.username = "";
    url.password = "";
    return /^[\/a-zA-Z0-9._~-]*$/.test(url.pathname) && !/(?:secret|token|password|auth|key)/i.test(url.pathname);
  } catch {
    return false;
  }
}

export function projectDeviceMediaBindings(rows: readonly MediaBindingRow[], deviceId: number, venueId: number | null): DeviceMediaBinding[] {
  if (!venueId || !Number.isSafeInteger(deviceId) || deviceId <= 0) return [];
  return rows.flatMap((row): DeviceMediaBinding[] => {
    if (row.deviceId !== deviceId || row.venueId !== venueId || !row.enabled || !Number.isSafeInteger(row.id) || row.id <= 0) return [];
    if (row.sourceType === "ip_camera") {
      if (!Number.isSafeInteger(row.venueCameraId) || (row.venueCameraId as number) <= 0 || row.cameraVenueId !== venueId || row.cameraStatus !== "enabled" || row.cameraStreamType !== "rtsp") return [];
      return [{ sourceId: row.id, deviceId, venueId, sourceType: "ip_camera", venueCameraId: row.venueCameraId, enabled: true, capability: "rtsp" }];
    }
    if (row.venueCameraId !== null || !["hdmi_input", "mixer_audio", "ambient_audio"].includes(row.sourceType)) return [];
    return [{ sourceId: row.id, deviceId, venueId, sourceType: row.sourceType as "hdmi_input" | "mixer_audio" | "ambient_audio", venueCameraId: null, enabled: true, capability: "not_tested" }];
  }).sort((left, right) => left.sourceId - right.sourceId);
}