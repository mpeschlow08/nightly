import { activeTonight, linkUpFriends } from "@/data/link-up";
import type {
  DiscoveryEventCandidate,
  DiscoveryProfile,
  DiscoveryVenueCandidate,
  SocialEventSignal,
  SocialVenueSignal,
} from "@/lib/discovery/types";
import { normalizeGenre, normalizeToken } from "@/lib/discovery/scoring";

function friendGenreSet() {
  const values = new Set<string>();
  for (const friend of linkUpFriends) {
    for (const genre of friend.favoriteGenres) {
      values.add(normalizeGenre(genre));
    }
  }

  return values;
}

export function venueSocialSignals(venues: DiscoveryVenueCandidate[], profile: DiscoveryProfile) {
  const byVenue = new Map<number, SocialVenueSignal>();
  const normalizedVenueNames = new Map<string, number>();
  const sharedGenres = friendGenreSet();

  for (const venue of venues) {
    normalizedVenueNames.set(normalizeToken(venue.venue.name), venue.venue.id);

    byVenue.set(venue.venue.id, {
      interestedFriends: 0,
      activeFriends: 0,
    });
  }

  for (const presence of activeTonight) {
    const venueId = normalizedVenueNames.get(normalizeToken(presence.venue));
    if (!venueId) {
      continue;
    }

    const current = byVenue.get(venueId);
    if (!current) {
      continue;
    }

    // Respect privacy by surfacing only aggregate counts.
    current.activeFriends += 1;
  }

  for (const friend of linkUpFriends) {
    for (const venue of venues) {
      const current = byVenue.get(venue.venue.id);
      if (!current) {
        continue;
      }

      const hasGenreAffinity = venue.venue.genres
        .map(normalizeGenre)
        .some((genre) => sharedGenres.has(genre) || friend.favoriteGenres.map(normalizeGenre).includes(genre));

      const inViewerSaved = profile.savedVenueIds.includes(venue.venue.id);
      if (hasGenreAffinity || inViewerSaved) {
        current.interestedFriends += 1;
      }
    }
  }

  return byVenue;
}

export function eventSocialSignals(events: DiscoveryEventCandidate[], profile: DiscoveryProfile) {
  const byEvent = new Map<number, SocialEventSignal>();

  for (const event of events) {
    const crowdAffinity = linkUpFriends.filter((friend) =>
      event.event.genres.map(normalizeGenre).some((genre) => friend.favoriteGenres.map(normalizeGenre).includes(genre))
    ).length;

    const venuePresence = activeTonight.filter(
      (presence) => normalizeToken(presence.venue) === normalizeToken(event.event.venueName)
    ).length;

    byEvent.set(event.event.id, {
      interestedFriends: crowdAffinity,
      attendingFriends: profile.savedEventIds.includes(event.event.id) ? venuePresence + 1 : venuePresence,
    });
  }

  return byEvent;
}
