import { CATEGORY_ALIASES, DISCOVERY_DEFAULTS, GENRE_ALIASES } from "@/lib/discovery/constants";

export function normalizeToken(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9+&\s-]/g, "")
    .replace(/\s+/g, " ");
}

export function normalizeGenre(value: string) {
  const normalized = normalizeToken(value);
  return GENRE_ALIASES[normalized] ?? normalized;
}

export function normalizeCategory(value: string) {
  const normalized = normalizeToken(value).replace(/\s+/g, "");
  return CATEGORY_ALIASES[normalized] ?? normalizeToken(value);
}

export function normalizeCollection(values: string[], normalizer: (value: string) => string) {
  return Array.from(new Set(values.map(normalizer).filter(Boolean)));
}

export function scoreDistance(distanceLabel: string | null, preferredDistanceMiles: number | null) {
  const parsed = parseDistanceMiles(distanceLabel);
  const maxDistance = preferredDistanceMiles ?? DISCOVERY_DEFAULTS.fallbackMaxDistanceMiles;

  if (!Number.isFinite(parsed)) {
    return 0.4;
  }

  if (parsed <= 1) return 1;
  if (parsed <= 3) return 0.86;
  if (parsed <= 5) return 0.72;
  if (parsed <= maxDistance) {
    const extra = parsed - 5;
    const span = Math.max(1, maxDistance - 5);
    return Math.max(0.25, 0.72 - extra / span * 0.47);
  }

  return 0;
}

export function parseDistanceMiles(distanceLabel: string | null) {
  if (!distanceLabel) {
    return Number.POSITIVE_INFINITY;
  }

  const match = distanceLabel.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!match) {
    return Number.POSITIVE_INFINITY;
  }

  return Number.parseFloat(match[1]);
}

export function scoreRatingConfidence(averageRating: number | null, reviewCount: number | null) {
  if (averageRating == null || reviewCount == null || reviewCount <= 0) {
    return 0.35;
  }

  const normalizedRating = Math.max(0, Math.min(1, averageRating / 5));
  const confidence = Math.min(1, Math.log10(reviewCount + 1) / 2);
  return normalizedRating * 0.7 + confidence * 0.3;
}

export function scoreFreshness(updatedAt: Date | null, now: Date) {
  if (!updatedAt) {
    return 0.4;
  }

  const ageDays = (now.getTime() - updatedAt.getTime()) / (24 * 60 * 60 * 1000);
  if (ageDays <= 2) return 1;
  if (ageDays <= 7) return 0.85;
  if (ageDays <= 30) return 0.65;
  if (ageDays <= 90) return 0.45;
  return 0.25;
}

export function stableSortByScore<T extends { score: number; id: number }>(items: T[]) {
  return [...items].sort((a, b) => b.score - a.score || a.id - b.id);
}

export function scoreAffinity(preferences: string[], candidate: string[]) {
  if (preferences.length === 0 || candidate.length === 0) {
    return 0;
  }

  const prefSet = new Set(preferences);
  const hits = candidate.filter((item) => prefSet.has(item));
  return Math.min(1, hits.length / Math.min(prefSet.size, 3));
}

export function isWithinStartingSoonWindow(startsAt: Date, now: Date, windowMinutes = DISCOVERY_DEFAULTS.startingSoonMinutes) {
  const deltaMinutes = (startsAt.getTime() - now.getTime()) / (60 * 1000);
  return deltaMinutes >= 0 && deltaMinutes <= windowMinutes;
}

export function scoreStartingSoon(startsAt: Date, now: Date, windowMinutes = DISCOVERY_DEFAULTS.startingSoonMinutes) {
  const deltaMinutes = (startsAt.getTime() - now.getTime()) / (60 * 1000);
  if (deltaMinutes < 0) {
    return 0;
  }

  if (deltaMinutes > windowMinutes) {
    return 0;
  }

  return Math.max(0.1, 1 - deltaMinutes / windowMinutes);
}
