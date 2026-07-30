import test from "node:test";
import assert from "node:assert/strict";

import { resolveVenueImages } from "@/app/lib/venue-images";
import { assertPublicHttpUrl } from "@/app/owner/lib/image-fetch-security";
import { rankGooglePhotoCandidates } from "@/app/owner/lib/google-photo-ranking";
import { resolveMetadataAssetUrl } from "@/app/owner/lib/website-metadata";
import { nightlyRatioClassName, pickImageSource } from "@/components/media/nightly-image-config";

test("owner image override has highest hero priority", () => {
  const resolved = resolveVenueImages({
    venue: {
      heroImageUrl: "https://cdn.example.com/google-hero.jpg",
      thumbnailImageUrl: "https://cdn.example.com/google-thumb.jpg",
      logoUrl: null,
      googleLogoImageUrl: null,
      officialWebsiteImageUrl: "https://site.example.com/og.jpg",
      officialWebsiteIconUrl: null,
      galleryImageUrlsJson: JSON.stringify(["https://cdn.example.com/gallery-one.jpg"]),
    },
    ownerGalleryImageUrls: ["https://blob.example.com/owner-hero.jpg"],
    fallbackHeroImageUrl: "/assets/nightly-fallback-image.svg",
    fallbackLogoImageUrl: "/assets/nightly-fallback-logo.svg",
  });

  assert.equal(resolved.heroImageUrl, "https://blob.example.com/owner-hero.jpg");
  assert.equal(resolved.heroSource, "owner_upload");
});

test("gallery deduplicates duplicate URLs", () => {
  const resolved = resolveVenueImages({
    venue: {
      heroImageUrl: "https://cdn.example.com/hero.jpg",
      thumbnailImageUrl: "https://cdn.example.com/hero.jpg",
      logoUrl: null,
      googleLogoImageUrl: null,
      officialWebsiteImageUrl: null,
      officialWebsiteIconUrl: null,
      galleryImageUrlsJson: JSON.stringify([
        "https://cdn.example.com/hero.jpg",
        "https://cdn.example.com/hero.jpg",
      ]),
    },
    ownerGalleryImageUrls: ["https://cdn.example.com/hero.jpg"],
    fallbackHeroImageUrl: "/assets/nightly-fallback-image.svg",
    fallbackLogoImageUrl: "/assets/nightly-fallback-logo.svg",
  });

  assert.equal(resolved.galleryImageUrls.length, 1);
});

test("missing images resolve to nightly fallback", () => {
  const resolved = resolveVenueImages({
    venue: {
      heroImageUrl: null,
      thumbnailImageUrl: null,
      logoUrl: null,
      googleLogoImageUrl: null,
      officialWebsiteImageUrl: null,
      officialWebsiteIconUrl: null,
      galleryImageUrlsJson: null,
    },
    ownerGalleryImageUrls: [],
    fallbackHeroImageUrl: "/assets/nightly-fallback-image.svg",
    fallbackLogoImageUrl: "/assets/nightly-fallback-logo.svg",
  });

  assert.equal(resolved.heroImageUrl, "/assets/nightly-fallback-image.svg");
  assert.equal(resolved.logoImageUrl, "/assets/nightly-fallback-logo.svg");
});

test("ratio mapping includes stable variants", () => {
  assert.equal(nightlyRatioClassName.landscape, "aspect-[16/9]");
  assert.equal(nightlyRatioClassName.portrait, "aspect-[4/5]");
  assert.equal(nightlyRatioClassName.square, "aspect-square");
  assert.ok(nightlyRatioClassName.hero.includes("aspect-[16/9]"));
});

test("google photo ranking prefers landscape for hero", () => {
  const ranked = rankGooglePhotoCandidates(
    {
      placeId: "abc",
      displayName: "Test",
      formattedAddress: "x",
      city: null,
      nationalPhoneNumber: null,
      websiteUri: null,
      regularOpeningHours: null,
      latitude: null,
      longitude: null,
      googleMapsUri: null,
      photos: [
        { reference: "a", widthPx: 400, heightPx: 400, attributions: [] },
        { reference: "b", widthPx: 1600, heightPx: 900, attributions: [] },
      ],
      photoReferences: ["a", "b"],
      coverPhotoReference: null,
      logoImageUrl: null,
      coverImageUrl: null,
      galleryImageUrls: [],
    },
    16 / 9
  );

  assert.equal(ranked[0]?.reference, "b");
});

test("metadata URL resolver resolves relative URLs", () => {
  const base = new URL("https://venue.example.com/");
  const resolved = resolveMetadataAssetUrl(base, "/images/hero.jpg");

  assert.equal(resolved, "https://venue.example.com/images/hero.jpg");
});

test("invalid protocol and private network URLs are rejected", () => {
  assert.throws(() => assertPublicHttpUrl("javascript:alert(1)"));
  assert.throws(() => assertPublicHttpUrl("http://127.0.0.1/logo.png"));
});

test("pickImageSource falls back when source is empty", () => {
  const source = pickImageSource(["", "   ", null], "/assets/nightly-fallback-image.svg");

  assert.equal(source, "/assets/nightly-fallback-image.svg");
});
