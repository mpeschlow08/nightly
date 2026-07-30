import { VENUE_SCORE_WEIGHTS } from "@/lib/discovery/constants";
import type {
  DiscoveryFilters,
  DiscoveryProfile,
  DiscoveryVenueCandidate,
  ScoredVenueRecommendation,
  ScoreBreakdown,
} from "@/lib/discovery/types";
import {
  normalizeCategory,
  normalizeCollection,
  normalizeGenre,
  normalizeToken,
  scoreAffinity,
  scoreDistance,
  scoreFreshness,
  scoreRatingConfidence,
  stableSortByScore,
} from "@/lib/discovery/scoring";

function crowdMomentum(level: string | null) {
  const normalized = normalizeToken(level ?? "");
  if (normalized === "packed") return 1;
  if (normalized === "buzzing") return 0.8;
  if (normalized === "steady") return 0.6;
  if (normalized === "mellow") return 0.4;
  return 0.5;
}

export function isVenueEligible(candidate: DiscoveryVenueCandidate, profile: DiscoveryProfile, filters?: DiscoveryFilters) {
  if (!candidate.isPublished || candidate.isArchived || candidate.isSuspended) {
    return { eligible: false, reason: "not-public" };
  }

  if (profile.age != null && candidate.ageRequirement != null && profile.age < candidate.ageRequirement) {
    return { eligible: false, reason: "age-restricted" };
  }

  if (filters?.liveNow && !candidate.venue.isLive) {
    return { eligible: false, reason: "not-live" };
  }

  if (filters?.openNow && !candidate.isOpenNow) {
    return { eligible: false, reason: "not-open" };
  }

  if ((filters?.neighborhood?.length ?? 0) > 0) {
    const allowed = new Set((filters?.neighborhood ?? []).map(normalizeToken));
    if (!allowed.has(normalizeToken(candidate.venue.neighborhood))) {
      return { eligible: false, reason: "neighborhood-filter" };
    }
  }

  if ((filters?.genre?.length ?? 0) > 0) {
    const allowed = new Set((filters?.genre ?? []).map(normalizeGenre));
    const hasGenre = candidate.venue.genres.map(normalizeGenre).some((genre) => allowed.has(genre));
    if (!hasGenre) {
      return { eligible: false, reason: "genre-filter" };
    }
  }

  return { eligible: true, reason: null };
}

function reasonFromBreakdown(candidate: DiscoveryVenueCandidate, breakdown: ScoreBreakdown) {
  if (breakdown.friendSignal >= 0.06) {
    return { reason: "Popular with people in your circle", reasonCode: "friend-aware" };
  }

  if (candidate.venue.isLive) {
    return { reason: "Live now near you", reasonCode: "live-now" };
  }

  if (breakdown.genreMatch >= 0.08) {
    return { reason: "Matches your usual vibe", reasonCode: "genre-match" };
  }

  if (breakdown.neighborhoodMatch >= 0.06) {
    return { reason: `Popular tonight in ${candidate.venue.neighborhood}`, reasonCode: "neighborhood-match" };
  }

  if (breakdown.distance >= 0.08) {
    return { reason: "Top pick nearby", reasonCode: "distance" };
  }

  return { reason: "Strong citywide momentum", reasonCode: "trending" };
}

export function scoreVenueCandidate(
  candidate: DiscoveryVenueCandidate,
  profile: DiscoveryProfile,
  now: Date
): ScoredVenueRecommendation {
  const normalizedGenres = normalizeCollection(candidate.venue.genres, normalizeGenre);
  const normalizedCategories = normalizeCollection(candidate.categories, normalizeCategory);

  const genreMatch = scoreAffinity(profile.preferredGenres, normalizedGenres);
  const neighborhoodMatch = scoreAffinity(profile.preferredNeighborhoods, [normalizeToken(candidate.venue.neighborhood)]);
  const categoryMatch = scoreAffinity(profile.preferredVenueCategories, normalizedCategories);

  const breakdown: ScoreBreakdown = {
    publication: (candidate.isPublished ? 1 : 0) * VENUE_SCORE_WEIGHTS.publication,
    liveNow: (candidate.venue.isLive ? 1 : 0) * VENUE_SCORE_WEIGHTS.liveNow,
    openNow: (candidate.isOpenNow ? 1 : 0) * VENUE_SCORE_WEIGHTS.openNow,
    livePreview: (candidate.hasLivePreview ? 1 : 0) * VENUE_SCORE_WEIGHTS.livePreview,
    vibe: Math.max(0.25, (candidate.venue.liveLabel === "TRENDING" ? 1 : 0.65)) * VENUE_SCORE_WEIGHTS.vibe,
    ratingConfidence:
      scoreRatingConfidence(candidate.averageRating, candidate.reviewCount) * VENUE_SCORE_WEIGHTS.ratingConfidence,
    distance: scoreDistance(candidate.venue.distanceLabel, profile.preferredDistanceMiles) * VENUE_SCORE_WEIGHTS.distance,
    neighborhoodMatch: neighborhoodMatch * VENUE_SCORE_WEIGHTS.neighborhoodMatch,
    genreMatch: genreMatch * VENUE_SCORE_WEIGHTS.genreMatch,
    categoryMatch: categoryMatch * VENUE_SCORE_WEIGHTS.categoryMatch,
    friendSignal:
      Math.min(1, (candidate.social.activeFriends + candidate.social.interestedFriends * 0.5) / 3) *
      VENUE_SCORE_WEIGHTS.friendSignal,
    activeEventTonight: (candidate.hasEventTonight ? 1 : 0) * VENUE_SCORE_WEIGHTS.activeEventTonight,
    featured: (candidate.venue.liveLabel === "TRENDING" ? 1 : 0) * VENUE_SCORE_WEIGHTS.featured,
    imageCompleteness:
      Math.min(1, Math.max(0.3, candidate.venue.galleryImageUrls.length * 0.2 + 0.4)) * VENUE_SCORE_WEIGHTS.imageCompleteness,
    profileCompleteness: Math.min(1, normalizedCategories.length > 0 ? 0.9 : 0.55) * VENUE_SCORE_WEIGHTS.profileCompleteness,
    freshness: scoreFreshness(candidate.updatedAt, now) * VENUE_SCORE_WEIGHTS.freshness,
    crowdMomentum: crowdMomentum(candidate.venue.crowdLevel) * VENUE_SCORE_WEIGHTS.crowdMomentum,
  };

  const score = Object.values(breakdown).reduce((total, value) => total + value, 0);
  const reason = reasonFromBreakdown(candidate, breakdown);

  const badges = [
    candidate.venue.isLive ? "Live" : null,
    candidate.hasEventTonight ? "Tonight" : null,
    candidate.social.activeFriends > 0 ? "Friends" : null,
  ].filter((badge): badge is string => Boolean(badge));

  return {
    venue: candidate.venue,
    score,
    reason: reason.reason,
    reasonCode: reason.reasonCode,
    badges,
    breakdown,
  };
}

export function rankVenueRecommendations(
  candidates: DiscoveryVenueCandidate[],
  profile: DiscoveryProfile,
  now: Date,
  filters?: DiscoveryFilters,
  limit = 12
) {
  const scored: Array<ScoredVenueRecommendation & { id: number }> = [];

  for (const candidate of candidates) {
    const eligibility = isVenueEligible(candidate, profile, filters);
    if (!eligibility.eligible) {
      continue;
    }

    const result = scoreVenueCandidate(candidate, profile, now);
    scored.push({ ...result, id: result.venue.id });
  }

  return stableSortByScore(scored).slice(0, limit);
}
