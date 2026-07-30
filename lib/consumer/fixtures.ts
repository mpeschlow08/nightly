import { exploreCategories, exploreNeighborhoodCollections, exploreFeaturedDjs, exploreVenues } from "@/data/explore";
import { getNightlyEventArtwork, nightlyEvents } from "@/data/events";
import { homeVenueShowcase } from "@/data/home-nightlife";
import type {
  ConsumerDJCard,
  ConsumerEventCard,
  ConsumerVenueCard,
  ExploreDataPayload,
  HomeDataPayload,
  LiveDataPayload,
} from "@/lib/consumer/types";

function toVenueCardFixture(venue: (typeof homeVenueShowcase)[number]): ConsumerVenueCard {
  return {
    id: venue.id,
    slug: String(venue.id),
    href: venue.href,
    name: venue.name,
    neighborhood: venue.neighborhood,
    genre: venue.genre,
    genres: [venue.genre],
    distanceLabel: venue.distance,
    isLive: venue.isLive,
    liveLabel: venue.isLive ? "EVENT LIVE" : null,
    liveStatusProvenance: "demo",
    crowdLevel: venue.crowdLevel,
    heroImageUrl: venue.heroImage,
    thumbnailImageUrl: venue.thumbnailImage,
    logoImageUrl: venue.logoImage,
    galleryImageUrls: venue.galleryImages,
    imageSource: "demo",
  };
}

function toEventCardFixture(event: (typeof nightlyEvents)[number]): ConsumerEventCard {
  return {
    id: event.id,
    slug: event.slug,
    href: `/events/${event.slug}`,
    name: event.name,
    venueId: event.id,
    venueName: event.venueName,
    venueSlug: event.venueSlug,
    neighborhood: event.neighborhood,
    startTimeLabel: event.startTime,
    endTimeLabel: event.endTime,
    dateLabel: event.dateLabel,
    genres: event.genres,
    cover: event.cover,
    ageRequirementLabel: event.ageRequirement,
    dressCode: event.dressCode,
    crowdLevel: event.crowdLevel,
    ticketStatus: event.ticketStatus,
    ticketUrl: null,
    guestListUrl: null,
    isLive: event.live,
    imageUrl: getNightlyEventArtwork(event),
    distanceMiles: event.distanceMiles,
  };
}

function toDjCardFixture(dj: (typeof exploreFeaturedDjs)[number]): ConsumerDJCard {
  return {
    id: dj.id,
    name: dj.name,
    profileHref: dj.profileHref,
    genres: dj.genres,
    imageUrl: dj.imageUrl,
    performingAt: dj.performingAt,
    isPerformingTonight: dj.isPerformingTonight,
  };
}

export function fixturesEnabled() {
  if (process.env.NODE_ENV === "production") {
    return process.env.ENABLE_CONSUMER_FIXTURES === "true";
  }

  return process.env.ENABLE_CONSUMER_FIXTURES !== "false";
}

export function getFixtureHomeData(): HomeDataPayload {
  const venues = homeVenueShowcase.map(toVenueCardFixture);
  const events = nightlyEvents.map(toEventCardFixture);

  return {
    heroSummary: {
      greeting: "Good evening, Atlanta",
      title: "Atlanta is buzzing tonight.",
      subtitle: "Midtown is filling up quickly while Buckhead is just getting started.",
    },
    liveTonight: venues.filter((venue) => venue.isLive).slice(0, 6),
    trending: venues.slice(0, 6),
    eventsTonight: events.filter((event) => event.dateLabel === "Tonight").slice(0, 6),
    popularNearby: venues.slice(0, 6),
    recommended: venues.slice(2, 8),
  };
}

export function getFixtureExploreData(): ExploreDataPayload {
  const venueCards = exploreVenues.map((venue) =>
    toVenueCardFixture({
      id: venue.id,
      href: `/venues/${venue.id}`,
      name: venue.name,
      neighborhood: venue.neighborhood,
      genre: venue.genre,
      crowdLevel: venue.crowdLevel as "Mellow" | "Steady" | "Buzzing" | "Packed",
      distance: venue.distance,
      isLive: venue.isLive,
      imageUrl: venue.heroImage,
      heroImage: venue.heroImage,
      logoImage: venue.logoImage,
      galleryImages: venue.galleryImages,
      thumbnailImage: venue.thumbnailImage,
    })
  );

  return {
    venues: venueCards,
    events: nightlyEvents.map(toEventCardFixture),
    djs: exploreFeaturedDjs.map(toDjCardFixture),
    neighborhoods: exploreNeighborhoodCollections.map((item) => ({
      id: String(item.id),
      name: item.name,
      summary: item.summary,
      imageUrl: item.imageUrl,
      href: item.href,
    })),
    categories: exploreCategories.map((item) => ({
      id: String(item.id),
      name: item.name,
      subtitle: item.subtitle,
      imageUrl: item.imageUrl,
      href: item.href,
    })),
  };
}

export function getFixtureLiveData(): LiveDataPayload {
  return {
    summary: "Demo-mode nightlife summary is active.",
    venues: getFixtureHomeData().liveTonight,
    events: nightlyEvents.filter((event) => event.live).map(toEventCardFixture).slice(0, 8),
    djs: exploreFeaturedDjs.map(toDjCardFixture),
    activity: nightlyEvents.slice(0, 6).map((event) => ({
      id: `fixture-${event.id}`,
      label: event.name,
      detail: `${event.venueName} • ${event.startTime}`,
      occurredAtLabel: event.dateLabel,
    })),
  };
}
