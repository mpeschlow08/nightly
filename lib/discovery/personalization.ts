import { MOOD_INTENT_MAP } from "@/lib/discovery/constants";
import type { DiscoveryIntent, DiscoveryProfile } from "@/lib/discovery/types";
import { normalizeCategory, normalizeCollection, normalizeGenre, normalizeToken } from "@/lib/discovery/scoring";

type UserPreferenceSources = {
  clerkUserId: string | null;
  metadata?: Record<string, unknown> | null;
  savedVenueIds?: number[];
  savedEventIds?: number[];
  viewedVenueIds?: number[];
  viewedEventIds?: number[];
  discoveredGenres?: string[];
  discoveredNeighborhoods?: string[];
};

function readStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function readNumberList(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as number[];
  }

  return value
    .map((entry) => (typeof entry === "number" ? entry : Number.NaN))
    .filter((entry) => Number.isFinite(entry));
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function inferIntents(genres: string[], categories: string[]) {
  const intents = new Set<DiscoveryIntent>();
  const joined = [...genres, ...categories].join(" ");

  for (const key of Object.keys(MOOD_INTENT_MAP) as DiscoveryIntent[]) {
    const intent = MOOD_INTENT_MAP[key];
    const genreHit = (intent.genres ?? []).some((genre) => joined.includes(genre));
    const categoryHit = (intent.categories ?? []).some((category) => joined.includes(category));

    if (genreHit || categoryHit) {
      intents.add(key);
    }
  }

  return Array.from(intents);
}

export function buildDiscoveryProfile(sources: UserPreferenceSources): DiscoveryProfile {
  const metadata = sources.metadata ?? {};
  const genresFromMetadata = readStringList(metadata.favoriteGenres);
  const categoriesFromMetadata = readStringList(metadata.favoriteVenueCategories);
  const neighborhoodsFromMetadata = readStringList(metadata.favoriteNeighborhoods);

  const preferredGenres = normalizeCollection([...genresFromMetadata, ...(sources.discoveredGenres ?? [])], normalizeGenre);
  const preferredNeighborhoods = normalizeCollection(
    [...neighborhoodsFromMetadata, ...(sources.discoveredNeighborhoods ?? [])],
    normalizeToken
  );

  const preferredVenueCategories = normalizeCollection(categoriesFromMetadata, normalizeCategory);
  const preferredEventTypes = normalizeCollection(readStringList(metadata.favoriteEventTypes), normalizeToken);
  const preferredPriceLevels = readNumberList(metadata.pricePreferences);
  const typicalNightlifeDays = readNumberList(metadata.typicalNightlifeDays).map((day) => Math.trunc(day));
  const typicalNightlifeHours = readNumberList(metadata.typicalNightlifeHours).map((hour) => Math.trunc(hour));

  const intentsFromMetadata = normalizeCollection(readStringList(metadata.discoveryIntents), normalizeToken)
    .filter((intent): intent is DiscoveryIntent => intent in MOOD_INTENT_MAP);

  const inferredIntents = inferIntents(preferredGenres, preferredVenueCategories);

  return {
    clerkUserId: sources.clerkUserId,
    preferredGenres,
    preferredNeighborhoods,
    preferredVenueCategories,
    preferredEventTypes,
    preferredPriceLevels,
    typicalNightlifeDays,
    typicalNightlifeHours,
    age: readNumber(metadata.age),
    savedVenueIds: sources.savedVenueIds ?? [],
    savedEventIds: sources.savedEventIds ?? [],
    recentlyViewedVenueIds: sources.viewedVenueIds ?? [],
    recentlyViewedEventIds: sources.viewedEventIds ?? [],
    preferredDistanceMiles: readNumber(metadata.preferredDistanceMiles),
    liveStreamInterest: readBoolean(metadata.liveStreamInterest),
    premiumStatus: readBoolean(metadata.premiumStatus),
    intents: Array.from(new Set([...intentsFromMetadata, ...inferredIntents])),
  };
}
