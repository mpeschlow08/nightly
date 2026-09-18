
const DEFAULT_PLAYBACK_AUTH_TTL_SECONDS = 600;
const MIN_PLAYBACK_AUTH_TTL_SECONDS = 60;
const MAX_PLAYBACK_AUTH_TTL_SECONDS = 3600;

function parseIntValue(raw: string | undefined, fallback: number) {
  const value = Number.parseInt(raw ?? "", 10);
  return Number.isInteger(value) ? value : fallback;
}

export type ResolvedLiveProviderKey = "cloudflare_stream" | "mux" | "mock";

export function getLiveProviderKey() {
  return (process.env.CAMERA_LIVE_PROVIDER ?? "mock").trim().toLowerCase();
}

export function resolveLiveProviderKey(configured: string = getLiveProviderKey()): ResolvedLiveProviderKey {
  const value = configured.trim().toLowerCase();

  if (value === "cloudflare_stream" || value === "cloudflare") {
    return "cloudflare_stream";
  }

  if (value === "mux" || value === "mux_video") {
    return "mux";
  }

  return "mock";
}

export function getPlaybackAuthorizationTtlSeconds() {
  const configured = parseIntValue(process.env.LIVE_PLAYBACK_AUTH_TTL_SECONDS, DEFAULT_PLAYBACK_AUTH_TTL_SECONDS);
  return Math.max(MIN_PLAYBACK_AUTH_TTL_SECONDS, Math.min(MAX_PLAYBACK_AUTH_TTL_SECONDS, configured));
}
