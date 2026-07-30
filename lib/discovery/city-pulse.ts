import type { CityPulse, DiscoveryEventCandidate, DiscoveryVenueCandidate } from "@/lib/discovery/types";
import { getNeighborhoodRecommendations } from "@/lib/discovery/neighborhoods";
import { normalizeGenre } from "@/lib/discovery/scoring";

function topGenreTonight(events: DiscoveryEventCandidate[]) {
  const counts = new Map<string, number>();

  for (const event of events) {
    for (const genre of event.event.genres) {
      const normalized = normalizeGenre(genre);
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export function buildCityPulse(
  venues: DiscoveryVenueCandidate[],
  eventsTonight: DiscoveryEventCandidate[],
  now = new Date()
): CityPulse {
  const liveVenues = venues.filter((venue) => venue.venue.isLive).length;
  const guestListOpportunities = eventsTonight.filter((event) => Boolean(event.event.guestListUrl)).length;
  const topNeighborhood = getNeighborhoodRecommendations(venues, eventsTonight, [], 1)[0] ?? null;
  const topGenre = topGenreTonight(eventsTonight);

  const featuredEvent = eventsTonight.find((event) => event.isFeatured) ?? eventsTonight[0] ?? null;
  const risingVenue = venues
    .filter((venue) => venue.venue.liveLabel === "TRENDING" || venue.venue.isLive)
    .sort((a, b) => (b.venue.isLive ? 1 : 0) - (a.venue.isLive ? 1 : 0))[0] ?? null;

  const energy =
    liveVenues >= 10 ? "High" : liveVenues >= 6 ? "Strong" : liveVenues >= 3 ? "Building" : "Calm";

  const headline = `${eventsTonight.length} events are active for Atlanta tonight`;
  const summary =
    topNeighborhood
      ? `${topNeighborhood.name} is leading tonight with ${topNeighborhood.tonightEventCount} events and ${topNeighborhood.liveVenueCount} live venues.`
      : "Nightly is tracking citywide movement as the night unfolds.";

  return {
    headline,
    summary,
    facts: [
      { label: "Published events tonight", value: String(eventsTonight.length) },
      { label: "Live venues", value: String(liveVenues) },
      { label: "Most active neighborhood", value: topNeighborhood?.name ?? "No clear leader yet" },
      { label: "Most common genre", value: topGenre ?? "Open format" },
      { label: "Featured event", value: featuredEvent?.event.name ?? "No featured event" },
      { label: "Rising venue", value: risingVenue?.venue.name ?? "No trend spike yet" },
      { label: "Guest-list opportunities", value: String(guestListOpportunities) },
      { label: "Approximate crowd energy", value: energy },
    ],
    generatedAt: now,
    freshness: "real-time snapshot",
    actionTargets: [
      { label: "See events", href: "/events" },
      { label: "Explore neighborhoods", href: "/discover" },
    ],
  };
}
