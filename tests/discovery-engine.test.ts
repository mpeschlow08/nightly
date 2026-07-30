import assert from "node:assert/strict";
import test from "node:test";

import { buildCityPulse } from "@/lib/discovery/city-pulse";
import { MOOD_INTENT_MAP } from "@/lib/discovery/constants";
import { isEventEligible, scoreEventCandidate } from "@/lib/discovery/event-ranking";
import { getNeighborhoodRecommendations } from "@/lib/discovery/neighborhoods";
import { buildDiscoveryProfile } from "@/lib/discovery/personalization";
import { scoreDistance, normalizeGenre, normalizeCategory } from "@/lib/discovery/scoring";
import { buildCacheScopeKey } from "@/lib/discovery/service";
import { venueSocialSignals } from "@/lib/discovery/social-signals";
import { isVenueEligible, scoreVenueCandidate } from "@/lib/discovery/venue-ranking";
import type { DiscoveryEventCandidate, DiscoveryProfile, DiscoveryVenueCandidate } from "@/lib/discovery/types";

function baseProfile(): DiscoveryProfile {
  return {
    clerkUserId: "user_1",
    preferredGenres: ["hip-hop"],
    preferredNeighborhoods: ["midtown"],
    preferredVenueCategories: ["club"],
    preferredEventTypes: ["event"],
    preferredPriceLevels: [0, 20],
    typicalNightlifeDays: [5, 6],
    typicalNightlifeHours: [22, 23],
    age: 25,
    savedVenueIds: [],
    savedEventIds: [],
    recentlyViewedVenueIds: [],
    recentlyViewedEventIds: [],
    preferredDistanceMiles: 5,
    liveStreamInterest: true,
    premiumStatus: false,
    intents: ["hip-hop"],
  };
}

function baseVenueCandidate(): DiscoveryVenueCandidate {
  return {
    venue: {
      id: 1,
      slug: "atlas",
      href: "/venues/atlas",
      name: "Atlas",
      neighborhood: "Midtown",
      genre: "Hip-Hop",
      genres: ["Hip-Hop"],
      distanceLabel: "1.2 mi",
      isLive: true,
      liveLabel: "TRENDING",
      liveStatusProvenance: "live_system",
      crowdLevel: "Buzzing",
      heroImageUrl: "/a.jpg",
      thumbnailImageUrl: "/a.jpg",
      logoImageUrl: null,
      galleryImageUrls: ["/a.jpg"],
      imageSource: "existing",
    },
    categories: ["Club"],
    priceLevel: 2,
    ageRequirement: 21,
    averageRating: 4.7,
    reviewCount: 190,
    isPublished: true,
    isVerified: true,
    isArchived: false,
    isSuspended: false,
    isOpenNow: true,
    hasLivePreview: true,
    hasEventTonight: true,
    updatedAt: new Date("2026-07-29T20:00:00.000Z"),
    social: { interestedFriends: 1, activeFriends: 1 },
  };
}

function baseEventCandidate(): DiscoveryEventCandidate {
  return {
    event: {
      id: 101,
      slug: "atlas-friday",
      href: "/events/atlas-friday",
      name: "Atlas Friday",
      venueId: 1,
      venueName: "Atlas",
      venueSlug: "atlas",
      neighborhood: "Midtown",
      startTimeLabel: "10:00 PM",
      endTimeLabel: "1:00 AM",
      dateLabel: "Tonight",
      genres: ["Hip-Hop"],
      cover: 15,
      ageRequirementLabel: "21+",
      dressCode: "Upscale",
      crowdLevel: "Buzzing",
      ticketStatus: "On sale",
      ticketUrl: "https://tickets.local",
      guestListUrl: "https://guest.local",
      isLive: false,
      imageUrl: "/event.jpg",
      distanceMiles: 2,
    },
    venue: baseVenueCandidate().venue,
    eventType: "event",
    startsAt: new Date("2026-07-30T23:00:00.000Z"),
    endsAt: new Date("2026-07-31T03:00:00.000Z"),
    timezone: "America/New_York",
    publicationStatus: "published",
    lifecycleStatus: "published",
    approvalStatus: "approved",
    isCancelled: false,
    isArchived: false,
    isFeatured: true,
    coverCents: 1500,
    views: 45,
    saves: 12,
    shares: 8,
    social: { interestedFriends: 1, attendingFriends: 1 },
  };
}

test("genre/category normalization resolves aliases", () => {
  assert.equal(normalizeGenre("rap"), "hip-hop");
  assert.equal(normalizeGenre("afro beats"), "afrobeats");
  assert.equal(normalizeCategory("NightClub"), "club");
});

test("mood intent mappings include key vibes", () => {
  assert.ok(MOOD_INTENT_MAP["high-energy"]);
  assert.ok(MOOD_INTENT_MAP["late-night"]);
});

test("venue eligibility enforces publication and age", () => {
  const profile = baseProfile();
  const candidate = baseVenueCandidate();
  assert.equal(isVenueEligible(candidate, profile).eligible, true);

  const blockedByAge = { ...candidate, ageRequirement: 26 };
  assert.equal(isVenueEligible(blockedByAge, profile).eligible, false);

  const blockedByStatus = { ...candidate, isPublished: false };
  assert.equal(isVenueEligible(blockedByStatus, profile).eligible, false);
});

test("event eligibility excludes rejected and archived events", () => {
  const profile = baseProfile();
  const now = new Date("2026-07-30T22:00:00.000Z");
  const candidate = baseEventCandidate();

  assert.equal(isEventEligible(candidate, profile, now).eligible, true);
  assert.equal(isEventEligible({ ...candidate, approvalStatus: "rejected" }, profile, now).eligible, false);
  assert.equal(isEventEligible({ ...candidate, lifecycleStatus: "archived" }, profile, now).eligible, false);
});

test("venue scoring returns deterministic reasons", () => {
  const result = scoreVenueCandidate(baseVenueCandidate(), baseProfile(), new Date("2026-07-30T22:00:00.000Z"));
  assert.ok(result.score > 0.5);
  assert.match(result.reason, /Live now|circle|vibe|Popular/i);
});

test("event scoring handles starting-soon and affordability", () => {
  const now = new Date("2026-07-30T22:00:00.000Z");
  const result = scoreEventCandidate(baseEventCandidate(), baseProfile(), now);
  assert.ok(result.score > 0.5);
  assert.ok(Object.hasOwn(result.breakdown, "timing"));
  assert.ok(Object.hasOwn(result.breakdown, "affordability"));
});

test("distance scoring degrades by range", () => {
  assert.ok(scoreDistance("1 mi", 10) > scoreDistance("8 mi", 10));
  assert.equal(scoreDistance("40 mi", 10), 0);
});

test("sparse profile fallback preserves defaults", () => {
  const profile = buildDiscoveryProfile({ clerkUserId: null, metadata: {} });
  assert.equal(profile.preferredGenres.length, 0);
  assert.equal(profile.preferredNeighborhoods.length, 0);
  assert.equal(profile.clerkUserId, null);
});

test("social signals are aggregate and privacy-safe", () => {
  const venueSignals = venueSocialSignals([baseVenueCandidate()], baseProfile());
  const signal = venueSignals.get(1);
  assert.ok(signal);
  assert.equal(typeof signal?.activeFriends, "number");
  assert.equal(typeof signal?.interestedFriends, "number");
});

test("city pulse uses factual counts from candidates", () => {
  const pulse = buildCityPulse([baseVenueCandidate()], [baseEventCandidate()], new Date("2026-07-30T22:00:00.000Z"));
  assert.match(pulse.headline, /events/i);
  assert.ok(pulse.facts.some((fact) => fact.label === "Live venues"));
});

test("neighborhood recommendations are deterministic", () => {
  const rows = getNeighborhoodRecommendations([baseVenueCandidate()], [baseEventCandidate()], ["midtown"], 3);
  assert.equal(rows[0]?.name, "Midtown");
});

test("cache scope key separates users", () => {
  assert.equal(buildCacheScopeKey(null), "public");
  assert.equal(buildCacheScopeKey("user_42"), "user:user_42");
});
