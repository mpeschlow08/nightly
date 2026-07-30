import { EVENT_SCORE_WEIGHTS } from "@/lib/discovery/constants";
import { isInTonightWindow } from "@/lib/consumer/time";
import type {
  DiscoveryEventCandidate,
  DiscoveryFilters,
  DiscoveryProfile,
  ScoredEventRecommendation,
  ScoreBreakdown,
} from "@/lib/discovery/types";
import {
  isWithinStartingSoonWindow,
  normalizeCollection,
  normalizeGenre,
  normalizeToken,
  scoreAffinity,
  scoreDistance,
  scoreStartingSoon,
  stableSortByScore,
} from "@/lib/discovery/scoring";

function lifecycleScore(status: string) {
  const normalized = normalizeToken(status);
  if (normalized === "published" || normalized === "live") return 1;
  if (normalized === "scheduled") return 0.8;
  if (normalized === "draft") return 0;
  if (normalized === "cancelled" || normalized === "archived" || normalized === "completed") return 0;
  return 0.5;
}

function eventTypeScore(eventType: string | null, preferredEventTypes: string[]) {
  if (preferredEventTypes.length === 0) {
    return 0.45;
  }

  if (!eventType) {
    return 0;
  }

  return preferredEventTypes.includes(normalizeToken(eventType)) ? 1 : 0;
}

function affordabilityScore(coverCents: number, pricePreference: number[]) {
  const coverDollars = coverCents / 100;
  if (pricePreference.length === 0) {
    if (coverDollars <= 0) return 1;
    if (coverDollars <= 15) return 0.8;
    if (coverDollars <= 30) return 0.6;
    return 0.35;
  }

  const min = Math.min(...pricePreference);
  const max = Math.max(...pricePreference);
  if (coverDollars >= min && coverDollars <= max) return 1;
  if (coverDollars <= max + 10) return 0.65;
  return 0.3;
}

export function isEventEligible(candidate: DiscoveryEventCandidate, profile: DiscoveryProfile, now: Date, filters?: DiscoveryFilters) {
  const publication = normalizeToken(candidate.publicationStatus);
  const approval = normalizeToken(candidate.approvalStatus);
  const lifecycle = normalizeToken(candidate.lifecycleStatus);

  if (!(publication === "published" || publication === "approved")) {
    return { eligible: false, reason: "not-published" };
  }

  if (approval === "rejected") {
    return { eligible: false, reason: "rejected" };
  }

  if (["draft", "archived", "cancelled"].includes(lifecycle)) {
    return { eligible: false, reason: "lifecycle-ineligible" };
  }

  if (candidate.isCancelled || candidate.isArchived) {
    return { eligible: false, reason: "cancelled-or-archived" };
  }

  if (candidate.endsAt != null && candidate.endsAt < now) {
    return { eligible: false, reason: "completed" };
  }

  if (filters?.tonight && !isInTonightWindow(candidate.startsAt, candidate.endsAt, now, candidate.timezone)) {
    return { eligible: false, reason: "outside-tonight-window" };
  }

  if (filters?.liveNow && !candidate.event.isLive) {
    return { eligible: false, reason: "not-live" };
  }

  if ((filters?.eventType?.length ?? 0) > 0) {
    const allowed = new Set((filters?.eventType ?? []).map(normalizeToken));
    if (!allowed.has(normalizeToken(candidate.eventType ?? ""))) {
      return { eligible: false, reason: "event-type-filter" };
    }
  }

  if ((filters?.genre?.length ?? 0) > 0) {
    const allowed = new Set((filters?.genre ?? []).map(normalizeGenre));
    const eventGenres = candidate.event.genres.map(normalizeGenre);
    if (!eventGenres.some((genre) => allowed.has(genre))) {
      return { eligible: false, reason: "genre-filter" };
    }
  }

  if ((filters?.neighborhood?.length ?? 0) > 0) {
    const allowed = new Set((filters?.neighborhood ?? []).map(normalizeToken));
    if (!allowed.has(normalizeToken(candidate.event.neighborhood))) {
      return { eligible: false, reason: "neighborhood-filter" };
    }
  }

  if (profile.age != null && candidate.event.ageRequirementLabel) {
    const required = Number.parseInt(candidate.event.ageRequirementLabel, 10);
    if (Number.isFinite(required) && profile.age < required) {
      return { eligible: false, reason: "age-restricted" };
    }
  }

  return { eligible: true, reason: null };
}

function reasonFromBreakdown(candidate: DiscoveryEventCandidate, breakdown: ScoreBreakdown, now: Date) {
  if (breakdown.friendSignal >= 0.03) {
    return { reason: "Saved by people in your circle", reasonCode: "friend-aware" };
  }

  if (candidate.event.isLive) {
    return { reason: "Happening right now", reasonCode: "live-now" };
  }

  if (isWithinStartingSoonWindow(candidate.startsAt, now)) {
    return { reason: "Event starts soon", reasonCode: "starts-soon" };
  }

  if (breakdown.genreMatch >= 0.08) {
    return { reason: "Matches your usual vibe", reasonCode: "genre-match" };
  }

  if (breakdown.distance >= 0.06) {
    return { reason: "Near you and active tonight", reasonCode: "distance" };
  }

  return { reason: "Popular tonight in your city", reasonCode: "trending" };
}

export function scoreEventCandidate(candidate: DiscoveryEventCandidate, profile: DiscoveryProfile, now: Date): ScoredEventRecommendation {
  const normalizedGenres = normalizeCollection(candidate.event.genres, normalizeGenre);
  const neighborhood = normalizeToken(candidate.event.neighborhood);

  const genreMatch = scoreAffinity(profile.preferredGenres, normalizedGenres);
  const neighborhoodMatch = scoreAffinity(profile.preferredNeighborhoods, [neighborhood]);

  const breakdown: ScoreBreakdown = {
    publication: (normalizeToken(candidate.publicationStatus) === "published" ? 1 : 0.8) * EVENT_SCORE_WEIGHTS.publication,
    lifecycle: lifecycleScore(candidate.lifecycleStatus) * EVENT_SCORE_WEIGHTS.lifecycle,
    timing: scoreStartingSoon(candidate.startsAt, now) * EVENT_SCORE_WEIGHTS.timing,
    venueQuality: (candidate.venue.liveLabel === "TRENDING" || candidate.venue.isLive ? 0.9 : 0.55) * EVENT_SCORE_WEIGHTS.venueQuality,
    genreMatch: genreMatch * EVENT_SCORE_WEIGHTS.genreMatch,
    eventTypeMatch: eventTypeScore(candidate.eventType, profile.preferredEventTypes) * EVENT_SCORE_WEIGHTS.eventTypeMatch,
    neighborhoodMatch: neighborhoodMatch * EVENT_SCORE_WEIGHTS.neighborhoodMatch,
    distance: scoreDistance(candidate.event.distanceMiles != null ? `${candidate.event.distanceMiles} mi` : null, profile.preferredDistanceMiles) * EVENT_SCORE_WEIGHTS.distance,
    ticketAccess: (candidate.event.guestListUrl || candidate.event.ticketUrl ? 1 : 0.4) * EVENT_SCORE_WEIGHTS.ticketAccess,
    featured: (candidate.isFeatured ? 1 : 0) * EVENT_SCORE_WEIGHTS.featured,
    popularity: Math.min(1, (candidate.views + candidate.saves * 2 + candidate.shares * 2) / 80) * EVENT_SCORE_WEIGHTS.popularity,
    friendSignal:
      Math.min(1, (candidate.social.attendingFriends + candidate.social.interestedFriends * 0.5) / 4) *
      EVENT_SCORE_WEIGHTS.friendSignal,
    liveNow: (candidate.event.isLive ? 1 : 0) * EVENT_SCORE_WEIGHTS.liveNow,
    affordability: affordabilityScore(candidate.coverCents, profile.preferredPriceLevels) * EVENT_SCORE_WEIGHTS.affordability,
    imageCompleteness: (candidate.event.imageUrl.includes("fallback") ? 0.35 : 0.95) * EVENT_SCORE_WEIGHTS.imageCompleteness,
  };

  const score = Object.values(breakdown).reduce((total, value) => total + value, 0);
  const reason = reasonFromBreakdown(candidate, breakdown, now);

  const badges = [
    candidate.event.isLive ? "Live" : null,
    isWithinStartingSoonWindow(candidate.startsAt, now) ? "Starting Soon" : null,
    candidate.event.guestListUrl ? "Guest List" : null,
  ].filter((badge): badge is string => Boolean(badge));

  return {
    event: candidate.event,
    score,
    reason: reason.reason,
    reasonCode: reason.reasonCode,
    badges,
    breakdown,
  };
}

export function rankEventRecommendations(
  candidates: DiscoveryEventCandidate[],
  profile: DiscoveryProfile,
  now: Date,
  filters?: DiscoveryFilters,
  limit = 12
) {
  const scored: Array<ScoredEventRecommendation & { id: number }> = [];

  for (const candidate of candidates) {
    const eligibility = isEventEligible(candidate, profile, now, filters);
    if (!eligibility.eligible) {
      continue;
    }

    const result = scoreEventCandidate(candidate, profile, now);
    scored.push({ ...result, id: result.event.id });
  }

  return stableSortByScore(scored).slice(0, limit);
}
