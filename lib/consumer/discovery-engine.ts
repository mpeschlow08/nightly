import type { ConsumerEventCard, ConsumerVenueCard } from "@/lib/consumer/types";

const CROWD_SCORE: Record<string, number> = {
  mellow: 0.2,
  steady: 0.5,
  buzzing: 0.8,
  packed: 1,
};

const TRENDING_WEIGHTS = {
  live: 0.42,
  trending: 0.2,
  crowd: 0.14,
  proximity: 0.1,
  diversity: 0.08,
  visual: 0.06,
};

const EVENT_WEIGHTS = {
  live: 0.35,
  freshness: 0.24,
  affordability: 0.16,
  socialProof: 0.15,
  proximity: 0.1,
};

export type DiscoveryPreferences = {
  preferredGenres?: string[];
  preferredNeighborhoods?: string[];
};

type CityPulseInput = {
  venues: ConsumerVenueCard[];
  events: ConsumerEventCard[];
  now?: Date;
};

type NeighborhoodInsight = {
  name: string;
  venueCount: number;
  liveVenueCount: number;
  liveEventCount: number;
  topGenres: string[];
};

type CategoryInsight = {
  name: string;
  venueCount: number;
  liveVenueCount: number;
};

function normalizeGenre(value: string) {
  return value.toLowerCase().trim();
}

function parseDistanceMiles(distanceLabel: string | null) {
  if (!distanceLabel) {
    return Number.POSITIVE_INFINITY;
  }

  const match = distanceLabel.match(/([0-9]+(?:\.[0-9]+)?)/);

  if (!match) {
    return Number.POSITIVE_INFINITY;
  }

  return Number.parseFloat(match[1]);
}

function proximityScore(distanceLabel: string | null) {
  const miles = parseDistanceMiles(distanceLabel);

  if (!Number.isFinite(miles)) {
    return 0.25;
  }

  if (miles <= 1) return 1;
  if (miles <= 3) return 0.8;
  if (miles <= 5) return 0.65;
  if (miles <= 10) return 0.45;
  return 0.25;
}

function crowdScore(crowdLevel: string | null) {
  if (!crowdLevel) {
    return 0.45;
  }

  return CROWD_SCORE[crowdLevel.toLowerCase()] ?? 0.45;
}

function diversityScore(genres: string[]) {
  if (genres.length === 0) {
    return 0.2;
  }

  return Math.min(1, 0.35 + genres.length * 0.16);
}

function visualScore(venue: ConsumerVenueCard) {
  const galleryBonus = Math.min(0.4, venue.galleryImageUrls.length * 0.1);
  const sourceBonus = venue.imageSource === "nightly_fallback" ? 0.15 : 0.45;

  return Math.min(1, sourceBonus + galleryBonus);
}

function venueAffinityScore(venue: ConsumerVenueCard, preferences?: DiscoveryPreferences) {
  if (!preferences) {
    return 0;
  }

  const preferredGenres = (preferences.preferredGenres ?? []).map(normalizeGenre);
  const preferredNeighborhoods = (preferences.preferredNeighborhoods ?? []).map((item) => item.toLowerCase().trim());
  const venueGenres = venue.genres.map(normalizeGenre);

  const hasGenreAffinity = preferredGenres.some((genre) => venueGenres.includes(genre));
  const hasNeighborhoodAffinity = preferredNeighborhoods.includes(venue.neighborhood.toLowerCase().trim());

  if (hasGenreAffinity && hasNeighborhoodAffinity) {
    return 1;
  }

  if (hasGenreAffinity || hasNeighborhoodAffinity) {
    return 0.7;
  }

  return 0;
}

function scoreVenueForTrending(venue: ConsumerVenueCard, preferences?: DiscoveryPreferences) {
  return (
    Number(venue.isLive) * TRENDING_WEIGHTS.live +
    Number(venue.liveLabel === "TRENDING") * TRENDING_WEIGHTS.trending +
    crowdScore(venue.crowdLevel) * TRENDING_WEIGHTS.crowd +
    proximityScore(venue.distanceLabel) * TRENDING_WEIGHTS.proximity +
    diversityScore(venue.genres) * TRENDING_WEIGHTS.diversity +
    visualScore(venue) * TRENDING_WEIGHTS.visual +
    venueAffinityScore(venue, preferences) * 0.1
  );
}

function scoreEvent(event: ConsumerEventCard) {
  const affordability = event.cover <= 0 ? 1 : event.cover <= 10 ? 0.75 : event.cover <= 20 ? 0.55 : 0.35;
  const socialProof = event.ticketStatus.toLowerCase().includes("sold")
    ? 0.45
    : event.ticketStatus.toLowerCase().includes("limited")
      ? 0.9
      : 0.7;

  return (
    Number(event.isLive) * EVENT_WEIGHTS.live +
    Number(event.dateLabel.toLowerCase().includes("tonight")) * EVENT_WEIGHTS.freshness +
    affordability * EVENT_WEIGHTS.affordability +
    socialProof * EVENT_WEIGHTS.socialProof +
    proximityScore(event.distanceMiles != null ? `${event.distanceMiles} mi` : null) * EVENT_WEIGHTS.proximity
  );
}

function stableRank<T extends { id: number }>(items: T[], scorer: (item: T) => number, limit: number) {
  return [...items]
    .sort((a, b) => {
      const scoreDelta = scorer(b) - scorer(a);

      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      return a.id - b.id;
    })
    .slice(0, limit);
}

export function rankTrendingVenues(venues: ConsumerVenueCard[], limit = 8, preferences?: DiscoveryPreferences) {
  return stableRank(venues, (venue) => scoreVenueForTrending(venue, preferences), limit);
}

export function rankRecommendedVenues(venues: ConsumerVenueCard[], preferences?: DiscoveryPreferences, limit = 8) {
  if (!preferences || ((preferences.preferredGenres?.length ?? 0) === 0 && (preferences.preferredNeighborhoods?.length ?? 0) === 0)) {
    return rankTrendingVenues(venues, limit);
  }

  return stableRank(
    venues,
    (venue) => scoreVenueForTrending(venue, preferences) + venueAffinityScore(venue, preferences) * 0.45,
    limit
  );
}

export function rankPopularNearbyVenues(venues: ConsumerVenueCard[], limit = 8) {
  return stableRank(
    venues,
    (venue) => proximityScore(venue.distanceLabel) * 0.62 + Number(venue.isLive) * 0.26 + crowdScore(venue.crowdLevel) * 0.12,
    limit
  );
}

export function rankLiveVenues(venues: ConsumerVenueCard[], limit = 12) {
  const live = venues.filter((venue) => venue.isLive || venue.liveLabel != null);

  return stableRank(live, (venue) => scoreVenueForTrending(venue), limit);
}

export function rankDiscoveryEvents(events: ConsumerEventCard[], limit = 12) {
  return stableRank(events, scoreEvent, limit);
}

export function rankVenueSearchResults(query: string, venues: ConsumerVenueCard[], limit = 20) {
  const search = query.toLowerCase().trim();

  if (!search) {
    return rankTrendingVenues(venues, limit);
  }

  const terms = search.split(/\s+/).filter(Boolean);

  return stableRank(
    venues,
    (venue) => {
      const haystack = [venue.name, venue.neighborhood, venue.genre, ...venue.genres].join(" ").toLowerCase();
      const exactStart = venue.name.toLowerCase().startsWith(search) ? 1 : 0;
      const substring = haystack.includes(search) ? 1 : 0;
      const termMatches = terms.reduce((count, term) => count + Number(haystack.includes(term)), 0);

      return exactStart * 1.6 + substring * 1 + termMatches * 0.42 + scoreVenueForTrending(venue) * 0.35;
    },
    limit
  );
}

export function buildNeighborhoodInsights(venues: ConsumerVenueCard[], events: ConsumerEventCard[], limit = 10): NeighborhoodInsight[] {
  const buckets = new Map<string, { venues: ConsumerVenueCard[]; events: ConsumerEventCard[] }>();

  for (const venue of venues) {
    const key = venue.neighborhood;
    const current = buckets.get(key) ?? { venues: [], events: [] };
    current.venues.push(venue);
    buckets.set(key, current);
  }

  for (const event of events) {
    const key = event.neighborhood;
    const current = buckets.get(key) ?? { venues: [], events: [] };
    current.events.push(event);
    buckets.set(key, current);
  }

  return Array.from(buckets.entries())
    .map(([name, bucket]) => {
      const genreCounts = new Map<string, number>();

      for (const venue of bucket.venues) {
        for (const genre of venue.genres) {
          const normalized = genre.trim();

          if (!normalized) {
            continue;
          }

          genreCounts.set(normalized, (genreCounts.get(normalized) ?? 0) + 1);
        }
      }

      const topGenres = Array.from(genreCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([genre]) => genre);

      return {
        name,
        venueCount: bucket.venues.length,
        liveVenueCount: bucket.venues.filter((venue) => venue.isLive).length,
        liveEventCount: bucket.events.filter((event) => event.isLive).length,
        topGenres,
      };
    })
    .sort((a, b) => b.liveVenueCount + b.liveEventCount - (a.liveVenueCount + a.liveEventCount))
    .slice(0, limit);
}

export function buildCategoryInsights(venues: ConsumerVenueCard[], limit = 12): CategoryInsight[] {
  const buckets = new Map<string, { venueCount: number; liveVenueCount: number }>();

  for (const venue of venues) {
    for (const genre of venue.genres) {
      const key = genre.trim();

      if (!key) {
        continue;
      }

      const current = buckets.get(key) ?? { venueCount: 0, liveVenueCount: 0 };
      current.venueCount += 1;

      if (venue.isLive) {
        current.liveVenueCount += 1;
      }

      buckets.set(key, current);
    }
  }

  return Array.from(buckets.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.liveVenueCount - a.liveVenueCount || b.venueCount - a.venueCount)
    .slice(0, limit);
}

export function buildCityPulseSummary(input: CityPulseInput) {
  const now = input.now ?? new Date();
  const liveVenues = input.venues.filter((venue) => venue.isLive).length;
  const liveEvents = input.events.filter((event) => event.isLive).length;
  const tonightEvents = input.events.filter((event) => event.dateLabel.toLowerCase().includes("tonight")).length;
  const topNeighborhood = buildNeighborhoodInsights(input.venues, input.events, 1)[0]?.name;
  const topCategory = buildCategoryInsights(input.venues, 1)[0]?.name;

  const hour = now.getHours();
  const timeBand = hour < 20 ? "early-night" : hour < 24 ? "peak-night" : "late-night";

  const neighborhoodSnippet = topNeighborhood ? `${topNeighborhood} is leading` : "Citywide momentum is balanced";
  const categorySnippet = topCategory ? `${topCategory} is setting the tone` : "Open-format rooms are dominating";

  return `${neighborhoodSnippet} in ${timeBand} with ${liveVenues} venues live, ${liveEvents} events active, and ${tonightEvents} events on deck. ${categorySnippet}.`;
}