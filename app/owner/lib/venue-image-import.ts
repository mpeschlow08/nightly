import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";

import { put } from "@vercel/blob";
import { and, eq, isNotNull, isNull, or } from "drizzle-orm";

import { resolveVenueImages } from "@/app/lib/venue-images";
import {
  assertPublicHttpUrl,
  fetchWithSafeRedirects,
  readResponseWithinLimit,
} from "@/app/owner/lib/image-fetch-security";
import {
  getGooglePlaceVenueDetails,
  type VenuePlaceDetails,
} from "@/app/owner/lib/google-places";
import { rankGooglePhotoCandidates } from "@/app/owner/lib/google-photo-ranking";
import { fetchOfficialWebsiteMetadata } from "@/app/owner/lib/website-metadata";
import { db } from "@/db";
import { venueImages, venues } from "@/db/schema";

const IMAGE_FETCH_TIMEOUT_MS = 8000;
const IMAGE_FETCH_MAX_BYTES = 9 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const IMAGE_USER_AGENT = "NightlyBot/1.0 (+https://nightly.local)";
const MAX_GALLERY_IMAGES = 6;

type RefreshVenueImageOptions = {
  venueId: number;
  force?: boolean;
  dryRun?: boolean;
};

export type RefreshVenueImageResult = {
  venueId: number;
  venueName: string;
  status: "success" | "skipped" | "failed";
  reason: string;
  updatedFields: string[];
};

function normalizeReference(ref: string) {
  return ref.replace(/^\/+/, "").trim();
}

function buildGooglePhotoProxyUrl(reference: string, maxWidthPx: number) {
  const params = new URLSearchParams({ ref: normalizeReference(reference), maxWidthPx: String(maxWidthPx) });

  return `/api/venues/google-photo?${params.toString()}`;
}

function extensionForType(contentType: string) {
  const normalized = contentType.toLowerCase().split(";")[0].trim();

  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/avif") return "avif";

  return null;
}

function hashSource(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 20);
}

async function fetchRemoteImage(url: string) {
  const safeUrl = assertPublicHttpUrl(url);
  const response = await fetchWithSafeRedirects(safeUrl, {
    timeoutMs: IMAGE_FETCH_TIMEOUT_MS,
    maxRedirects: 2,
    userAgent: IMAGE_USER_AGENT,
    accept: "image/avif,image/webp,image/png,image/jpeg,*/*",
  });

  if (!response.ok) {
    throw new Error(`Image request failed with status ${response.status}.`);
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const normalizedType = contentType.split(";")[0].trim();

  if (!ACCEPTED_IMAGE_TYPES.has(normalizedType)) {
    throw new Error("Image content type is not supported.");
  }

  const body = await readResponseWithinLimit(response, IMAGE_FETCH_MAX_BYTES);
  const ext = extensionForType(normalizedType);

  if (!ext) {
    throw new Error("Unable to determine image file extension.");
  }

  return {
    bytes: body,
    contentType: normalizedType,
    extension: ext,
  };
}

function blobImportEnabled() {
  return Boolean(process.env.PUBLIC_BLOB_READ_WRITE_TOKEN?.trim());
}

async function persistImportedImage(
  venueId: number,
  purpose: "hero" | "thumbnail" | "gallery" | "logo",
  sourceId: string,
  sourceUrl: string,
  dryRun: boolean
) {
  if (dryRun) {
    return `dry-run:${sourceId}`;
  }

  if (sourceUrl.startsWith("/")) {
    return sourceUrl;
  }

  if (!blobImportEnabled()) {
    return sourceUrl;
  }

  const downloaded = await fetchRemoteImage(sourceUrl);
  const hash = hashSource(sourceId);
  const pathname = `venues/${venueId}/imported/${purpose}-${hash}.${downloaded.extension}`;

  const result = await put(pathname, Buffer.from(downloaded.bytes), {
    access: "public",
    addRandomSuffix: false,
    contentType: downloaded.contentType,
    token: process.env.PUBLIC_BLOB_READ_WRITE_TOKEN,
  });

  return result.url;
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

async function pickGoogleAssets(
  venueId: number,
  details: VenuePlaceDetails,
  dryRun: boolean
): Promise<{ heroUrl: string | null; thumbnailUrl: string | null; galleryUrls: string[]; references: string[] }> {
  const heroCandidate = rankGooglePhotoCandidates(details, 16 / 9)[0] ?? null;
  const thumbnailCandidate = rankGooglePhotoCandidates(details, 4 / 5)[0] ?? null;
  const galleryCandidates = rankGooglePhotoCandidates(details, 16 / 9)
    .slice(0, MAX_GALLERY_IMAGES)
    .map((candidate) => candidate.reference);

  const references = unique(
    [heroCandidate?.reference ?? null, thumbnailCandidate?.reference ?? null, ...galleryCandidates].filter(
      (item): item is string => Boolean(item)
    )
  );

  const heroUrl = heroCandidate
    ? await persistImportedImage(
        venueId,
        "hero",
        heroCandidate.reference,
        buildGooglePhotoProxyUrl(heroCandidate.reference, 1800),
        dryRun
      )
    : null;
  const thumbnailUrl = thumbnailCandidate
    ? await persistImportedImage(
        venueId,
        "thumbnail",
        thumbnailCandidate.reference,
        buildGooglePhotoProxyUrl(thumbnailCandidate.reference, 1200),
        dryRun
      )
    : null;

  const galleryUrls = await Promise.all(
    references.slice(0, MAX_GALLERY_IMAGES).map((reference) =>
      persistImportedImage(
        venueId,
        "gallery",
        reference,
        buildGooglePhotoProxyUrl(reference, 1600),
        dryRun
      )
    )
  );

  return { heroUrl, thumbnailUrl, galleryUrls, references };
}

function isLikelyLowResolutionIcon(url: string | null) {
  if (!url) {
    return false;
  }

  const lowered = url.toLowerCase();

  return (
    lowered.includes("favicon") ||
    lowered.includes("apple-touch-icon") ||
    lowered.endsWith(".ico")
  );
}

function buildWebsiteImageProxyUrl(sourceUrl: string) {
  const params = new URLSearchParams({ url: sourceUrl });

  return `/api/venues/website-image?${params.toString()}`;
}

async function pickWebsiteAssets(venueId: number, websiteUrl: string | null, dryRun: boolean) {
  if (!websiteUrl) {
    return {
      metadata: null,
      heroImageUrl: null,
      logoImageUrl: null,
    };
  }

  try {
    const metadata = await fetchOfficialWebsiteMetadata(websiteUrl);
    const heroCandidate = isLikelyLowResolutionIcon(metadata.selectedImageUrl)
      ? metadata.ogImageUrl ?? metadata.twitterImageUrl ?? null
      : metadata.selectedImageUrl;

    const heroImageUrl = heroCandidate
      ? await persistImportedImage(
          venueId,
          "hero",
          heroCandidate,
          blobImportEnabled() ? heroCandidate : buildWebsiteImageProxyUrl(heroCandidate),
          dryRun
        )
      : null;
    const logoImageUrl = metadata.selectedLogoUrl
      ? await persistImportedImage(
          venueId,
          "logo",
          metadata.selectedLogoUrl,
          blobImportEnabled()
            ? metadata.selectedLogoUrl
            : buildWebsiteImageProxyUrl(metadata.selectedLogoUrl),
          dryRun
        )
      : null;

    return {
      metadata,
      heroImageUrl,
      logoImageUrl,
    };
  } catch {
    return {
      metadata: null,
      heroImageUrl: null,
      logoImageUrl: null,
    };
  }
}

export async function refreshVenueImagesForVenue(options: RefreshVenueImageOptions): Promise<RefreshVenueImageResult> {
  const [venue] = await db.select().from(venues).where(eq(venues.id, options.venueId)).limit(1);

  if (!venue) {
    return {
      venueId: options.venueId,
      venueName: "Unknown",
      status: "failed",
      reason: "Venue not found.",
      updatedFields: [],
    };
  }

  const ownerGalleryRows = await db
    .select({ imageUrl: venueImages.imageUrl })
    .from(venueImages)
    .where(eq(venueImages.venueId, venue.id));
  const ownerGalleryUrls = ownerGalleryRows.map((row) => row.imageUrl);

  if (ownerGalleryUrls.length > 0 && !options.force) {
    return {
      venueId: venue.id,
      venueName: venue.name,
      status: "skipped",
      reason: "Owner-managed gallery images exist; use --force to refresh imported fields.",
      updatedFields: [],
    };
  }

  try {
    const details = venue.googlePlaceId ? await getGooglePlaceVenueDetails(venue.googlePlaceId) : null;
    const googleAssets = details
      ? await pickGoogleAssets(venue.id, details, Boolean(options.dryRun))
      : { heroUrl: null, thumbnailUrl: null, galleryUrls: [] as string[], references: [] as string[] };

    const websiteUrl = details?.websiteUri ?? venue.websiteUrl ?? null;
    const websiteAssets = await pickWebsiteAssets(venue.id, websiteUrl, Boolean(options.dryRun));

    const resolved = resolveVenueImages({
      venue: {
        heroImageUrl: googleAssets.heroUrl ?? venue.heroImageUrl,
        thumbnailImageUrl: googleAssets.thumbnailUrl ?? venue.thumbnailImageUrl,
        logoUrl: venue.logoUrl,
        googleLogoImageUrl: websiteAssets.logoImageUrl ?? venue.googleLogoImageUrl,
        officialWebsiteImageUrl: websiteAssets.heroImageUrl ?? venue.officialWebsiteImageUrl,
        officialWebsiteIconUrl:
          websiteAssets.metadata?.selectedLogoUrl ?? venue.officialWebsiteIconUrl,
        galleryImageUrlsJson:
          googleAssets.galleryUrls.length > 0
            ? JSON.stringify(googleAssets.galleryUrls)
            : venue.galleryImageUrlsJson,
      },
      ownerGalleryImageUrls: ownerGalleryUrls,
      existingApprovedImageUrls: [venue.heroImageUrl, venue.thumbnailImageUrl].filter(
        (item): item is string => Boolean(item)
      ),
      existingApprovedLogoUrl: venue.logoUrl,
      fallbackHeroImageUrl: "/assets/nightly-fallback-image.svg",
      fallbackLogoImageUrl: "/assets/nightly-fallback-logo.svg",
    });

    if (options.dryRun) {
      return {
        venueId: venue.id,
        venueName: venue.name,
        status: "success",
        reason: "Dry run completed.",
        updatedFields: ["heroImageUrl", "thumbnailImageUrl", "galleryImageUrlsJson", "imageSource"],
      };
    }

    await db
      .update(venues)
      .set({
        heroImageUrl: resolved.heroImageUrl,
        thumbnailImageUrl: resolved.thumbnailImageUrl,
        logoUrl: resolved.logoSource === "owner_upload" ? venue.logoUrl : resolved.logoImageUrl,
        officialWebsiteUrl: websiteUrl,
        officialWebsiteImageUrl: websiteAssets.metadata?.selectedImageUrl ?? venue.officialWebsiteImageUrl,
        officialWebsiteIconUrl: websiteAssets.metadata?.selectedLogoUrl ?? venue.officialWebsiteIconUrl,
        officialWebsiteCanonicalUrl:
          websiteAssets.metadata?.canonicalUrl ?? venue.officialWebsiteCanonicalUrl,
        officialWebsiteTitle: websiteAssets.metadata?.title ?? venue.officialWebsiteTitle,
        googlePlaceId: details?.placeId ?? venue.googlePlaceId,
        googlePhotoReferencesJson:
          googleAssets.references.length > 0
            ? JSON.stringify(googleAssets.references)
            : venue.googlePhotoReferencesJson,
        googleCoverPhotoReference: googleAssets.references[0] ?? venue.googleCoverPhotoReference,
        galleryImageUrlsJson:
          resolved.galleryImageUrls.length > 0 ? JSON.stringify(resolved.galleryImageUrls) : null,
        imageSource: resolved.heroSource,
        imagesLastRefreshedAt: new Date(),
        imageRefreshError: null,
      })
      .where(eq(venues.id, venue.id));

    return {
      venueId: venue.id,
      venueName: venue.name,
      status: "success",
      reason: "Venue image refresh completed.",
      updatedFields: [
        "heroImageUrl",
        "thumbnailImageUrl",
        "galleryImageUrlsJson",
        "googlePhotoReferencesJson",
        "imageSource",
        "imagesLastRefreshedAt",
      ],
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown image refresh failure.";

    if (!options.dryRun) {
      await db
        .update(venues)
        .set({
          imagesLastRefreshedAt: new Date(),
          imageRefreshError: reason,
        })
        .where(eq(venues.id, venue.id));
    }

    return {
      venueId: venue.id,
      venueName: venue.name,
      status: "failed",
      reason,
      updatedFields: [],
    };
  }
}

export async function listVenuesNeedingImageRefresh(limit: number) {
  const safeLimit = Math.max(1, Math.min(limit, 100));

  return db
    .select({ id: venues.id })
    .from(venues)
    .where(
      or(
        isNull(venues.heroImageUrl),
        isNull(venues.thumbnailImageUrl),
        isNull(venues.galleryImageUrlsJson),
        isNull(venues.imagesLastRefreshedAt),
        and(isNotNull(venues.imageRefreshError), eq(venues.imageSource, "nightly_fallback"))
      )
    )
    .limit(safeLimit);
}
