import type { InferSelectModel } from "drizzle-orm";

import { venues } from "@/db/schema";

export type VenueRecord = InferSelectModel<typeof venues>;

export type ImageSourceKind =
  | "owner_upload"
  | "google_places"
  | "official_website"
  | "existing"
  | "nightly_fallback";

export type ResolvedVenueImages = {
  heroImageUrl: string;
  thumbnailImageUrl: string;
  logoImageUrl: string;
  galleryImageUrls: string[];
  heroSource: ImageSourceKind;
  thumbnailSource: ImageSourceKind;
  logoSource: ImageSourceKind;
};

export type ResolveVenueImagesInput = {
  venue: Pick<
    VenueRecord,
    | "heroImageUrl"
    | "thumbnailImageUrl"
    | "logoUrl"
    | "googleLogoImageUrl"
    | "officialWebsiteImageUrl"
    | "officialWebsiteIconUrl"
    | "galleryImageUrlsJson"
  >;
  ownerGalleryImageUrls?: string[];
  existingApprovedImageUrls?: string[];
  existingApprovedLogoUrl?: string | null;
  fallbackHeroImageUrl: string;
  fallbackLogoImageUrl: string;
};

function normalizeCandidate(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function parseImageArrayJson(value: string | null | undefined) {
  if (!value) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [] as string[];
    }

    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  } catch {
    return [] as string[];
  }
}

function pickImage(
  candidates: Array<{ src: string | null | undefined; source: ImageSourceKind }>,
  fallbackSrc: string,
  fallbackSource: ImageSourceKind
) {
  for (const candidate of candidates) {
    const normalized = normalizeCandidate(candidate.src);

    if (normalized) {
      return { src: normalized, source: candidate.source };
    }
  }

  return { src: fallbackSrc, source: fallbackSource };
}

export function resolveVenueImages(input: ResolveVenueImagesInput): ResolvedVenueImages {
  const ownerGallery = (input.ownerGalleryImageUrls ?? [])
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  const importedGallery = parseImageArrayJson(input.venue.galleryImageUrlsJson);
  const existingApproved = (input.existingApprovedImageUrls ?? [])
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  const hero = pickImage(
    [
      { src: ownerGallery[0], source: "owner_upload" },
      { src: input.venue.heroImageUrl, source: "google_places" },
      { src: input.venue.officialWebsiteImageUrl, source: "official_website" },
      { src: importedGallery[0], source: "existing" },
      { src: existingApproved[0], source: "existing" },
      { src: input.venue.thumbnailImageUrl, source: "existing" },
    ],
    input.fallbackHeroImageUrl,
    "nightly_fallback"
  );

  const thumbnail = pickImage(
    [
      { src: ownerGallery[0], source: "owner_upload" },
      { src: input.venue.thumbnailImageUrl, source: "google_places" },
      { src: hero.src, source: hero.source },
      { src: input.venue.officialWebsiteImageUrl, source: "official_website" },
      { src: existingApproved[0], source: "existing" },
    ],
    input.fallbackHeroImageUrl,
    "nightly_fallback"
  );

  const logo = pickImage(
    [
      { src: input.venue.logoUrl, source: "owner_upload" },
      { src: input.venue.googleLogoImageUrl, source: "google_places" },
      { src: input.venue.officialWebsiteIconUrl, source: "official_website" },
      { src: input.existingApprovedLogoUrl, source: "existing" },
    ],
    input.fallbackLogoImageUrl,
    "nightly_fallback"
  );

  const galleryImageUrls = Array.from(
    new Set([
      ...ownerGallery,
      ...importedGallery,
      ...existingApproved,
      hero.src,
      thumbnail.src,
    ])
  ).slice(0, 10);

  return {
    heroImageUrl: hero.src,
    thumbnailImageUrl: thumbnail.src,
    logoImageUrl: logo.src,
    galleryImageUrls,
    heroSource: hero.source,
    thumbnailSource: thumbnail.source,
    logoSource: logo.source,
  };
}
