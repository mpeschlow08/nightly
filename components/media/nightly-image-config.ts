export const NIGHTLY_FALLBACK_IMAGE_URL = "/assets/nightly-fallback-image.svg";
export const NIGHTLY_FALLBACK_EVENT_IMAGE_URL = "/assets/nightly-fallback-event.svg";
export const NIGHTLY_FALLBACK_DJ_IMAGE_URL = "/assets/nightly-fallback-dj.svg";
export const NIGHTLY_FALLBACK_LOGO_IMAGE_URL = "/assets/nightly-fallback-logo.svg";

export type NightlyImageRatio = "landscape" | "portrait" | "square" | "hero";

export const nightlyRatioClassName: Record<NightlyImageRatio, string> = {
  landscape: "aspect-[16/9]",
  portrait: "aspect-[4/5]",
  square: "aspect-square",
  hero: "aspect-[16/9] min-h-[220px] max-h-[420px]",
};

export function pickImageSource(
  candidates: Array<string | null | undefined>,
  fallback = NIGHTLY_FALLBACK_IMAGE_URL,
) {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const value = candidate.trim();
    if (value.length > 0) {
      return value;
    }
  }

  return fallback;
}
