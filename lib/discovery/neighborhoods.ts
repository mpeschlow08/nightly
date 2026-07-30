import type { DiscoveryEventCandidate, DiscoveryVenueCandidate } from "@/lib/discovery/types";
import { normalizeGenre, normalizeToken } from "@/lib/discovery/scoring";

export type NeighborhoodRecommendation = {
  name: string;
  venueCount: number;
  liveVenueCount: number;
  tonightEventCount: number;
  topGenres: string[];
  score: number;
};

export function getNeighborhoodRecommendations(
  venues: DiscoveryVenueCandidate[],
  events: DiscoveryEventCandidate[],
  preferredNeighborhoods: string[],
  limit = 8
) {
  const buckets = new Map<
    string,
    { venueCount: number; liveVenueCount: number; tonightEventCount: number; genreCounts: Map<string, number> }
  >();

  for (const venue of venues) {
    const key = venue.venue.neighborhood;
    const current = buckets.get(key) ?? {
      venueCount: 0,
      liveVenueCount: 0,
      tonightEventCount: 0,
      genreCounts: new Map<string, number>(),
    };

    current.venueCount += 1;
    if (venue.venue.isLive) {
      current.liveVenueCount += 1;
    }

    for (const genre of venue.venue.genres) {
      const normalized = normalizeGenre(genre);
      current.genreCounts.set(normalized, (current.genreCounts.get(normalized) ?? 0) + 1);
    }

    buckets.set(key, current);
  }

  for (const event of events) {
    const key = event.event.neighborhood;
    const current = buckets.get(key) ?? {
      venueCount: 0,
      liveVenueCount: 0,
      tonightEventCount: 0,
      genreCounts: new Map<string, number>(),
    };

    current.tonightEventCount += 1;
    buckets.set(key, current);
  }

  const preferredSet = new Set(preferredNeighborhoods.map(normalizeToken));

  return Array.from(buckets.entries())
    .map(([name, bucket]) => {
      const topGenres = Array.from(bucket.genreCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([genre]) => genre);

      const base = bucket.liveVenueCount * 3 + bucket.tonightEventCount * 2 + bucket.venueCount;
      const preferenceBoost = preferredSet.has(normalizeToken(name)) ? 4 : 0;

      return {
        name,
        venueCount: bucket.venueCount,
        liveVenueCount: bucket.liveVenueCount,
        tonightEventCount: bucket.tonightEventCount,
        topGenres,
        score: base + preferenceBoost,
      } satisfies NeighborhoodRecommendation;
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}
