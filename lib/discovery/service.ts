import { buildCityPulse } from "@/lib/discovery/city-pulse";
import { getNeighborhoodRecommendations } from "@/lib/discovery/neighborhoods";
import { buildDiscoveryProfile } from "@/lib/discovery/personalization";
import { rankEventRecommendations } from "@/lib/discovery/event-ranking";
import { rankVenueRecommendations } from "@/lib/discovery/venue-ranking";
import type {
  CityPulse,
  DiscoveryDebugSnapshot,
  DiscoveryEventCandidate,
  DiscoveryFilters,
  DiscoveryProfile,
  DiscoveryVenueCandidate,
  ScoredEventRecommendation,
  ScoredVenueRecommendation,
} from "@/lib/discovery/types";

function dedupeById<T extends { id: number }>(items: T[]) {
  const seen = new Set<number>();
  const output: T[] = [];

  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }

    seen.add(item.id);
    output.push(item);
  }

  return output;
}

export function buildCacheScopeKey(clerkUserId: string | null) {
  return clerkUserId ? `user:${clerkUserId}` : "public";
}

export function createDiscoveryProfile(input: {
  clerkUserId: string | null;
  metadata?: Record<string, unknown> | null;
  savedVenueIds?: number[];
  savedEventIds?: number[];
  viewedVenueIds?: number[];
  viewedEventIds?: number[];
  discoveredGenres?: string[];
  discoveredNeighborhoods?: string[];
}) {
  return buildDiscoveryProfile(input);
}

export function getPersonalizedVenueRecommendations(input: {
  venues: DiscoveryVenueCandidate[];
  profile: DiscoveryProfile;
  now: Date;
  filters?: DiscoveryFilters;
  limit?: number;
}) {
  return rankVenueRecommendations(input.venues, input.profile, input.now, input.filters, input.limit ?? 12);
}

export function getPersonalizedEventRecommendations(input: {
  events: DiscoveryEventCandidate[];
  profile: DiscoveryProfile;
  now: Date;
  filters?: DiscoveryFilters;
  limit?: number;
}) {
  return rankEventRecommendations(input.events, input.profile, input.now, input.filters, input.limit ?? 12);
}

export function getTrendingVenues(venues: DiscoveryVenueCandidate[], profile: DiscoveryProfile, now: Date, limit = 10) {
  return rankVenueRecommendations(venues, profile, now, { sort: "trending" }, limit)
    .filter((item) => item.venue.liveLabel === "TRENDING" || item.venue.isLive)
    .slice(0, limit);
}

export function getTrendingEvents(events: DiscoveryEventCandidate[], profile: DiscoveryProfile, now: Date, limit = 10) {
  return rankEventRecommendations(events, profile, now, { sort: "trending" }, limit).slice(0, limit);
}

export function getTonightRecommendations(events: DiscoveryEventCandidate[], profile: DiscoveryProfile, now: Date, limit = 12) {
  return rankEventRecommendations(events, profile, now, { tonight: true }, limit);
}

export function getFriendAwareRecommendations(input: {
  venues: DiscoveryVenueCandidate[];
  events: DiscoveryEventCandidate[];
  profile: DiscoveryProfile;
  now: Date;
  limit?: number;
}) {
  const venue = rankVenueRecommendations(input.venues, input.profile, input.now, { friendActivityOnly: true }, 24)
    .filter((item) => item.reasonCode === "friend-aware" || item.badges.includes("Friends"));

  const events = rankEventRecommendations(input.events, input.profile, input.now, { friendActivityOnly: true }, 24)
    .filter((item) => item.reasonCode === "friend-aware");

  return {
    venues: venue.slice(0, input.limit ?? 6),
    events: events.slice(0, input.limit ?? 6),
  };
}

export function getNeighborhoodDiscovery(
  venues: DiscoveryVenueCandidate[],
  events: DiscoveryEventCandidate[],
  profile: DiscoveryProfile,
  limit = 8
) {
  return getNeighborhoodRecommendations(venues, events, profile.preferredNeighborhoods, limit);
}

export function getCityPulse(
  venues: DiscoveryVenueCandidate[],
  tonightEvents: DiscoveryEventCandidate[],
  now = new Date()
): CityPulse {
  return buildCityPulse(venues, tonightEvents, now);
}

export function explainRecommendation(input: ScoredVenueRecommendation | ScoredEventRecommendation) {
  return {
    reason: input.reason,
    reasonCode: input.reasonCode,
    badges: input.badges,
    breakdown: input.breakdown,
  };
}

export function buildHomeSections(input: {
  venues: DiscoveryVenueCandidate[];
  events: DiscoveryEventCandidate[];
  profile: DiscoveryProfile;
  now: Date;
}) {
  const tonightEvents = getTonightRecommendations(input.events, input.profile, input.now, 10);
  const topVenues = getPersonalizedVenueRecommendations({
    venues: input.venues,
    profile: input.profile,
    now: input.now,
    limit: 20,
  });

  const liveRightNow = topVenues.filter((item) => item.venue.isLive).slice(0, 8);
  const topPicks = topVenues.slice(0, 8);
  const startingSoon = getPersonalizedEventRecommendations({
    events: input.events,
    profile: input.profile,
    now: input.now,
    limit: 24,
  })
    .filter((item) => item.badges.includes("Starting Soon"))
    .slice(0, 8);

  const friendAware = getFriendAwareRecommendations({
    venues: input.venues,
    events: input.events,
    profile: input.profile,
    now: input.now,
    limit: 8,
  });

  const dedupedTopPicks = dedupeById(topPicks.map((item) => item.venue));

  return {
    topPicks: dedupedTopPicks,
    liveRightNow: dedupeById(liveRightNow.map((item) => item.venue)),
    startingSoon: dedupeById(startingSoon.map((item) => item.event)),
    tonightEvents: dedupeById(tonightEvents.map((item) => item.event)),
    friendVenuePicks: dedupeById(friendAware.venues.map((item) => item.venue)),
    friendEventPicks: dedupeById(friendAware.events.map((item) => item.event)),
    neighborhoods: getNeighborhoodDiscovery(input.venues, input.events, input.profile, 6),
    cityPulse: getCityPulse(input.venues, input.events, input.now),
  };
}

export function buildDiscoveryDebugSnapshot(input: {
  venueCandidates: DiscoveryVenueCandidate[];
  eventCandidates: DiscoveryEventCandidate[];
  profile: DiscoveryProfile;
  now: Date;
  cacheScope: "public" | "user";
}): DiscoveryDebugSnapshot {
  const venueScores = rankVenueRecommendations(input.venueCandidates, input.profile, input.now, undefined, 200);
  const eventScores = rankEventRecommendations(input.eventCandidates, input.profile, input.now, undefined, 200);

  const venueById = new Map(venueScores.map((row) => [row.venue.id, row]));
  const eventById = new Map(eventScores.map((row) => [row.event.id, row]));

  return {
    generatedAt: input.now,
    cacheScope: input.cacheScope,
    venueRows: input.venueCandidates.map((candidate) => {
      const scored = venueById.get(candidate.venue.id);
      return {
        venueId: candidate.venue.id,
        venueName: candidate.venue.name,
        included: Boolean(scored),
        exclusionReason: scored ? null : "filtered-out",
        score: scored?.score ?? 0,
        reason: scored?.reason ?? "Not eligible",
        breakdown: scored?.breakdown ?? {},
      };
    }),
    eventRows: input.eventCandidates.map((candidate) => {
      const scored = eventById.get(candidate.event.id);
      return {
        eventId: candidate.event.id,
        eventName: candidate.event.name,
        included: Boolean(scored),
        exclusionReason: scored ? null : "filtered-out",
        score: scored?.score ?? 0,
        reason: scored?.reason ?? "Not eligible",
        breakdown: scored?.breakdown ?? {},
      };
    }),
  };
}
