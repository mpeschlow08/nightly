import { unstable_cache } from "next/cache";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { auth, currentUser } from "@clerk/nextjs/server";

import { resolveVenueImages } from "@/app/lib/venue-images";
import { db } from "@/db";
import { djProfiles, eventAnalyticsDaily, events, venueCameras, venueImages, venues } from "@/db/schema";
import { formatDistanceMiles, distanceMilesBetween } from "@/lib/consumer/distance";
import {
  buildHomeSections,
  buildDiscoveryDebugSnapshot,
  createDiscoveryProfile,
  getNeighborhoodDiscovery,
  getPersonalizedEventRecommendations,
  getPersonalizedVenueRecommendations,
  getTrendingEvents,
  getTrendingVenues,
  getFriendAwareRecommendations,
  getCityPulse,
} from "@/lib/discovery/service";
import { venueSocialSignals, eventSocialSignals } from "@/lib/discovery/social-signals";
import type { DiscoveryEventCandidate, DiscoveryProfile, DiscoveryVenueCandidate } from "@/lib/discovery/types";
import {
  fixturesEnabled,
  getFixtureExploreData,
  getFixtureHomeData,
  getFixtureLiveData,
} from "@/lib/consumer/fixtures";
import {
  formatDateLabel,
  formatTimeLabel,
  isEventLive,
  isInTonightWindow,
} from "@/lib/consumer/time";
import type {
  ConsumerDJCard,
  ConsumerEventCard,
  ConsumerEventDetail,
  ConsumerCityPulse,
  ConsumerVenueCard,
  ConsumerVenueDetail,
  ExploreDataPayload,
  HomeDataPayload,
  LiveDataPayload,
} from "@/lib/consumer/types";
import { isEventPublic, isVenuePublic } from "@/lib/consumer/visibility";

const DEFAULT_TIMEZONE = "America/New_York";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseStringArrayJson(value: string | null | undefined) {
  if (!value) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [] as string[];
    }

    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  } catch {
    return [] as string[];
  }
}

function toAgeRequirementLabel(value: number | null | undefined) {
  if (typeof value !== "number") {
    return null;
  }

  return `${value}+`;
}

function venueTimezone(value: string | null | undefined) {
  return value?.trim() || DEFAULT_TIMEZONE;
}

type VenueWithImages = {
  venue: typeof venues.$inferSelect;
  imageRows: Array<{ imageUrl: string }>;
  hasCameraLive: boolean;
  hasLiveEvent: boolean;
};

async function getPublicVenueRows() {
  const rows = await db.select().from(venues);

  return rows.filter(isVenuePublic);
}

async function getVenueImageRows(venueIds: number[]) {
  if (venueIds.length === 0) {
    return new Map<number, Array<{ imageUrl: string }>>();
  }

  const imageRows = await db
    .select({ venueId: venueImages.venueId, imageUrl: venueImages.imageUrl })
    .from(venueImages)
    .where(inArray(venueImages.venueId, venueIds))
    .orderBy(asc(venueImages.sortOrder), asc(venueImages.id));

  const imageMap = new Map<number, Array<{ imageUrl: string }>>();

  for (const row of imageRows) {
    const current = imageMap.get(row.venueId) ?? [];
    current.push({ imageUrl: row.imageUrl });
    imageMap.set(row.venueId, current);
  }

  return imageMap;
}

async function getLiveFlags(venueIds: number[], now: Date) {
  if (venueIds.length === 0) {
    return {
      cameraLive: new Set<number>(),
      eventLive: new Set<number>(),
    };
  }

  const cameras = await db
    .select({ venueId: venueCameras.venueId })
    .from(venueCameras)
    .where(and(inArray(venueCameras.venueId, venueIds), eq(venueCameras.status, "enabled")));

  const eventRows = await db
    .select({
      venueId: events.venueId,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      isPublished: events.isPublished,
      publicationStatus: events.publicationStatus,
      isCanceled: events.isCanceled,
      isArchived: events.isArchived,
      venuePublicationStatus: venues.publicationStatus,
      venueName: venues.name,
      venueCity: venues.city,
      venueLatitude: venues.latitude,
      venueLongitude: venues.longitude,
      venueArchivedAt: venues.archivedAt,
      venueSuspendedAt: venues.suspendedAt,
    })
    .from(events)
    .innerJoin(venues, eq(events.venueId, venues.id))
    .where(and(inArray(events.venueId, venueIds), sql`${events.startsAt} <= ${new Date(now.getTime() + 8 * 60 * 60 * 1000)}`));

  const cameraLive = new Set<number>(cameras.map((item) => item.venueId));
  const eventLive = new Set<number>();

  for (const row of eventRows) {
    const venueShadow = {
      id: row.venueId,
      publicationStatus: row.venuePublicationStatus,
      name: row.venueName,
      city: row.venueCity,
      latitude: row.venueLatitude,
      longitude: row.venueLongitude,
      archivedAt: row.venueArchivedAt,
      suspendedAt: row.venueSuspendedAt,
    } as typeof venues.$inferSelect;

    const eventShadow = {
      isPublished: row.isPublished,
      publicationStatus: row.publicationStatus,
      isCanceled: row.isCanceled,
      isArchived: row.isArchived,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
    } as typeof events.$inferSelect;

    if (!isEventPublic(eventShadow, venueShadow, now)) {
      continue;
    }

    if (isEventLive(row.startsAt, row.endsAt, now)) {
      eventLive.add(row.venueId);
    }
  }

  return { cameraLive, eventLive };
}

function liveLabelForVenue(
  venue: typeof venues.$inferSelect,
  hasLiveEvent: boolean,
  hasCameraLive: boolean,
  isTrending: boolean
) {
  if (hasCameraLive) {
    return { label: "CAMERA LIVE" as const, provenance: "live_system" as const };
  }

  if (hasLiveEvent) {
    return { label: "EVENT LIVE" as const, provenance: "live_system" as const };
  }

  if (venue.isOpenNow) {
    return { label: "OPEN NOW" as const, provenance: "owner_reported" as const };
  }

  if (isTrending) {
    return { label: "TRENDING" as const, provenance: "estimated" as const };
  }

  return { label: null, provenance: "unavailable" as const };
}

function toVenueCardModel(
  source: VenueWithImages,
  userLocation: { latitude: number; longitude: number } | null = null
): ConsumerVenueCard {
  const genres = source.venue.genres?.filter(Boolean) ?? [];
  const resolvedImages = resolveVenueImages({
    venue: source.venue,
    ownerGalleryImageUrls: source.imageRows.map((row) => row.imageUrl),
    existingApprovedImageUrls: [source.venue.heroImageUrl, source.venue.thumbnailImageUrl].filter(
      (item): item is string => Boolean(item)
    ),
    existingApprovedLogoUrl: source.venue.logoUrl,
    fallbackHeroImageUrl: "/assets/nightly-fallback-image.svg",
    fallbackLogoImageUrl: "/assets/nightly-fallback-logo.svg",
  });

  const distanceLabel = formatDistanceMiles(
    distanceMilesBetween(
      userLocation,
      source.venue.latitude != null && source.venue.longitude != null
        ? { latitude: source.venue.latitude, longitude: source.venue.longitude }
        : null
    )
  );

  const trending = source.venue.isFeatured || (source.venue.vibeScore ?? 0) >= 90;
  const live = liveLabelForVenue(source.venue, source.hasLiveEvent, source.hasCameraLive, trending);

  return {
    id: source.venue.id,
    slug: source.venue.slug?.trim() || slugify(source.venue.name),
    href: source.venue.slug?.trim() ? `/venues/${source.venue.slug.trim()}` : `/venues/${source.venue.id}`,
    name: source.venue.name,
    neighborhood: source.venue.neighborhood ?? source.venue.city ?? "Atlanta",
    genre: genres[0] ?? "Open Format",
    genres,
    distanceLabel,
    isLive: Boolean(live.label),
    liveLabel: live.label,
    liveStatusProvenance: live.provenance,
    crowdLevel: source.venue.crowdLevel,
    heroImageUrl: resolvedImages.heroImageUrl,
    thumbnailImageUrl: resolvedImages.thumbnailImageUrl,
    logoImageUrl: resolvedImages.logoImageUrl,
    galleryImageUrls: resolvedImages.galleryImageUrls,
    imageSource: source.venue.imageSource ?? "existing",
  };
}

function parseEventGenres(row: typeof events.$inferSelect) {
  const parsed = parseStringArrayJson(row.genresJson);

  if (parsed.length > 0) {
    return parsed;
  }

  if (row.genre?.trim()) {
    return [row.genre.trim()];
  }

  return ["Open Format"];
}

function normalizeTicketStatus(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return "On sale";
  }

  if (normalized === "on_sale") return "On sale";
  if (normalized === "limited") return "Limited";
  if (normalized === "almost_sold_out") return "Almost sold out";
  if (normalized === "sold_out") return "Sold out";

  return value ?? "On sale";
}

function startingPriceCentsForEvent(row: typeof events.$inferSelect) {
  if (row.coverCents && row.coverCents > 0) {
    return row.coverCents;
  }

  return row.requiresTickets ? 0 : null;
}

function ticketSalesStateForEvent(row: typeof events.$inferSelect) {
  const now = new Date();
  const salesStartAt = row.ticketSalesStartAt ?? null;
  const salesEndAt = row.ticketSalesEndAt ?? null;

  if (!row.requiresTickets && !row.supportsFreeRsvp) {
    return "No ticketing";
  }

  if (row.ticketStatus?.trim()) {
    return normalizeTicketStatus(row.ticketStatus);
  }

  if (salesStartAt && salesStartAt > now) {
    return "On sale soon";
  }

  if (salesEndAt && salesEndAt < now) {
    return "Sales ended";
  }

  return row.capacity != null && row.capacity > 0 && row.ticketStatus === "sold_out"
    ? "Sold out"
    : "On sale";
}

function toEventCardModel(
  row: typeof events.$inferSelect,
  venue: typeof venues.$inferSelect,
  now: Date,
  userLocation: { latitude: number; longitude: number } | null = null
): ConsumerEventCard {
  const tz = venueTimezone(row.timezone ?? venue.timezone);
  const startsAt = row.startsAt;
  const distanceMiles = distanceMilesBetween(
    userLocation,
    venue.latitude != null && venue.longitude != null
      ? { latitude: venue.latitude, longitude: venue.longitude }
      : null
  );

  return {
    id: row.id,
    slug: row.slug?.trim() || slugify(`${venue.name}-${row.title}`),
    href: row.slug?.trim() ? `/events/${row.slug.trim()}` : `/events/${row.id}`,
    name: row.title,
    venueId: venue.id,
    venueName: venue.name,
    venueSlug: venue.slug?.trim() || slugify(venue.name),
    neighborhood: venue.neighborhood ?? venue.city ?? "Atlanta",
    startTimeLabel: formatTimeLabel(startsAt, tz),
    endTimeLabel: row.endsAt ? formatTimeLabel(row.endsAt, tz) : null,
    dateLabel: formatDateLabel(startsAt, now, tz),
    genres: parseEventGenres(row),
    cover: Math.round((row.coverCents ?? 0) / 100),
    ageRequirementLabel: toAgeRequirementLabel(row.ageRequirement),
    dressCode: row.dressCode,
    crowdLevel: venue.crowdLevel,
    ticketStatus: ticketSalesStateForEvent(row),
    ticketSalesVisibility: row.ticketSalesVisibility ?? "public",
    requiresTickets: Boolean(row.requiresTickets),
    supportsFreeRsvp: Boolean(row.supportsFreeRsvp),
    waitlistEnabled: Boolean(row.waitlistEnabled),
    guestListEnabled: Boolean(row.guestListUrl || row.rsvpUrl),
    startingPriceCents: startingPriceCentsForEvent(row),
    capacity: row.capacity ?? null,
    ticketUrl: row.ticketUrl,
    guestListUrl: row.guestListUrl,
    isLive: isEventLive(row.startsAt, row.endsAt, now),
    imageUrl: row.coverImageUrl ?? venue.thumbnailImageUrl ?? venue.heroImageUrl ?? "/assets/nightly-fallback-event.svg",
    distanceMiles,
  };
}

async function getPublicEventRows(now: Date) {
  const rows = await db
    .select({ event: events, venue: venues })
    .from(events)
    .innerJoin(venues, eq(events.venueId, venues.id))
    .where(sql`${events.startsAt} >= ${new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)}`)
    .orderBy(asc(events.startsAt));

  return rows.filter((row) => isEventPublic(row.event, row.venue, now));
}

function toConsumerCityPulse(pulse: ReturnType<typeof getCityPulse>): ConsumerCityPulse {
  return {
    headline: pulse.headline,
    summary: pulse.summary,
    facts: pulse.facts,
    generatedAtIso: pulse.generatedAt.toISOString(),
    freshness: pulse.freshness,
    actionTargets: pulse.actionTargets ?? [],
  };
}

async function getEventPopularitySignals(eventIds: number[]) {
  if (eventIds.length === 0) {
    return new Map<number, { views: number; saves: number; shares: number }>();
  }

  const rows = await db
    .select({
      eventId: eventAnalyticsDaily.eventId,
      views: sql<number>`sum(${eventAnalyticsDaily.views})::int`,
      favorites: sql<number>`sum(${eventAnalyticsDaily.favorites})::int`,
      shares: sql<number>`sum(${eventAnalyticsDaily.shares})::int`,
    })
    .from(eventAnalyticsDaily)
    .where(inArray(eventAnalyticsDaily.eventId, eventIds))
    .groupBy(eventAnalyticsDaily.eventId);

  const result = new Map<number, { views: number; saves: number; shares: number }>();
  for (const row of rows) {
    result.set(row.eventId, {
      views: row.views ?? 0,
      saves: row.favorites ?? 0,
      shares: row.shares ?? 0,
    });
  }

  return result;
}

type DiscoveryDataset = {
  venueCandidates: DiscoveryVenueCandidate[];
  eventCandidates: DiscoveryEventCandidate[];
  venueCards: ConsumerVenueCard[];
  eventCards: ConsumerEventCard[];
};

async function buildDiscoveryDataset(now: Date): Promise<DiscoveryDataset> {
  const venueRows = await getPublicVenueRows();
  const venueIds = venueRows.map((venue) => venue.id);

  const [imageMap, liveFlags, eventRows] = await Promise.all([
    getVenueImageRows(venueIds),
    getLiveFlags(venueIds, now),
    getPublicEventRows(now),
  ]);

  const venueCards = venueRows.map((venue) =>
    toVenueCardModel({
      venue,
      imageRows: imageMap.get(venue.id) ?? [],
      hasCameraLive: liveFlags.cameraLive.has(venue.id),
      hasLiveEvent: liveFlags.eventLive.has(venue.id),
    })
  );

  const eventsForCards = eventRows.map((row) => toEventCardModel(row.event, row.venue, now));
  const eventSignalMap = await getEventPopularitySignals(eventsForCards.map((event) => event.id));
  const venueCardById = new Map(venueCards.map((venue) => [venue.id, venue]));

  const venueCandidatesBase: DiscoveryVenueCandidate[] = venueRows.map((venue) => {
    const venueCard = venueCardById.get(venue.id)!;
    const hasEventTonight = eventRows.some((eventRow) => eventRow.event.venueId === venue.id && isInTonightWindow(
      eventRow.event.startsAt,
      eventRow.event.endsAt,
      now,
      venueTimezone(eventRow.event.timezone ?? eventRow.venue.timezone)
    ));

    return {
      venue: venueCard,
      categories: parseStringArrayJson(venue.venueCategoriesJson),
      priceLevel: venue.priceLevel ?? null,
      ageRequirement: venue.ageRequirement ?? null,
      averageRating: venue.averageRating ?? null,
      reviewCount: venue.reviewCount ?? null,
      isPublished: venue.publicationStatus === "published" || venue.publicationStatus === "approved",
      isVerified: venue.verificationStatus === "verified",
      isArchived: Boolean(venue.archivedAt),
      isSuspended: Boolean(venue.suspendedAt),
      isOpenNow: Boolean(venue.isOpenNow),
      hasLivePreview: Boolean(venue.livePreviewAvailable),
      hasEventTonight,
      updatedAt: venue.updatedAt ?? null,
      social: { interestedFriends: 0, activeFriends: 0 },
    };
  });

  const profileForSocial = createDiscoveryProfile({ clerkUserId: null });
  const venueSocialMap = venueSocialSignals(venueCandidatesBase, profileForSocial);
  const venueCandidates = venueCandidatesBase.map((candidate) => ({
    ...candidate,
    social: venueSocialMap.get(candidate.venue.id) ?? { interestedFriends: 0, activeFriends: 0 },
  }));

  const eventCandidatesBase: DiscoveryEventCandidate[] = eventRows.map((row) => {
    const eventCard = eventsForCards.find((event) => event.id === row.event.id)!;
    const venueCard = venueCardById.get(row.venue.id)!;
    const popularity = eventSignalMap.get(row.event.id) ?? { views: 0, saves: 0, shares: 0 };

    return {
      event: eventCard,
      venue: venueCard,
      eventType: row.event.eventType,
      startsAt: row.event.startsAt,
      endsAt: row.event.endsAt,
      timezone: venueTimezone(row.event.timezone ?? row.venue.timezone),
      publicationStatus: row.event.publicationStatus,
      lifecycleStatus: row.event.lifecycleStatus,
      approvalStatus: row.event.approvalStatus,
      isCancelled: row.event.isCanceled,
      isArchived: row.event.isArchived,
      isFeatured: row.event.isFeatured,
      coverCents: row.event.coverCents,
      views: popularity.views,
      saves: popularity.saves,
      shares: popularity.shares,
      social: { interestedFriends: 0, attendingFriends: 0 },
    };
  });

  const eventSocialMap = eventSocialSignals(eventCandidatesBase, profileForSocial);
  const eventCandidates = eventCandidatesBase.map((candidate) => ({
    ...candidate,
    social: eventSocialMap.get(candidate.event.id) ?? { interestedFriends: 0, attendingFriends: 0 },
  }));

  return {
    venueCandidates,
    eventCandidates,
    venueCards,
    eventCards: eventsForCards,
  };
}

async function resolveViewerProfile(baseDataset: DiscoveryDataset): Promise<{ profile: DiscoveryProfile; cacheScope: "public" | "user" }> {
  const { userId } = await auth();
  if (!userId) {
    return { profile: createDiscoveryProfile({ clerkUserId: null }), cacheScope: "public" };
  }

  const viewer = await currentUser();
  const metadata = (viewer?.unsafeMetadata ?? {}) as Record<string, unknown>;
  const profile = createDiscoveryProfile({
    clerkUserId: userId,
    metadata,
    discoveredGenres: baseDataset.eventCards.slice(0, 6).flatMap((event) => event.genres),
    discoveredNeighborhoods: baseDataset.venueCards.slice(0, 6).map((venue) => venue.neighborhood),
  });

  return { profile, cacheScope: "user" };
}

async function buildHomeDataForProfile(profile: DiscoveryProfile, now: Date, dataset: DiscoveryDataset): Promise<HomeDataPayload> {
  const sections = buildHomeSections({
    venues: dataset.venueCandidates,
    events: dataset.eventCandidates,
    profile,
    now,
  });

  const trending = getTrendingVenues(dataset.venueCandidates, profile, now, 8);
  const recommended = getPersonalizedVenueRecommendations({
    venues: dataset.venueCandidates,
    profile,
    now,
    limit: 8,
  });
  const popularNearby = getPersonalizedVenueRecommendations({
    venues: dataset.venueCandidates,
    profile,
    now,
    filters: { sort: "distance" },
    limit: 8,
  });
  const eventsTonight = getTrendingEvents(dataset.eventCandidates, profile, now, 8);

  const cityPulseSummary = sections.cityPulse.summary;

  return {
    heroSummary: {
      greeting: "Good evening, Atlanta",
      title: "Atlanta is buzzing tonight.",
      subtitle: cityPulseSummary,
    },
    cityPulse: toConsumerCityPulse(sections.cityPulse),
    tonightTopPicks: sections.topPicks,
    eventsStartingSoon: sections.startingSoon,
    vibeForYou: sections.topPicks,
    trendingNeighborhoods: sections.neighborhoods.map((item) => ({
      id: slugify(item.name),
      name: item.name,
      summary: `${item.venueCount} venues • ${item.liveVenueCount} live`,
      imageUrl: dataset.venueCards.find((venue) => venue.neighborhood === item.name)?.heroImageUrl ?? "/assets/nightly-fallback-image.svg",
      href: `/discover?neighborhood=${encodeURIComponent(item.name)}`,
    })),
    friendsInterestedVenues: sections.friendVenuePicks,
    friendsInterestedEvents: sections.friendEventPicks,
    liveTonight: sections.liveRightNow,
    trending: trending.map((item) => ({ ...item.venue, recommendationReason: item.reason, recommendationReasonCode: item.reasonCode, recommendationBadges: item.badges })),
    eventsTonight: eventsTonight.map((item) => ({ ...item.event, recommendationReason: item.reason, recommendationReasonCode: item.reasonCode, recommendationBadges: item.badges })),
    popularNearby: popularNearby.map((item) => ({ ...item.venue, recommendationReason: item.reason, recommendationReasonCode: item.reasonCode, recommendationBadges: item.badges })),
    recommended: recommended.map((item) => ({ ...item.venue, recommendationReason: item.reason, recommendationReasonCode: item.reasonCode, recommendationBadges: item.badges })),
  };
}

const getPublicHomeDataCached = unstable_cache(
  async (): Promise<HomeDataPayload> => {
    const now = new Date();
    const dataset = await buildDiscoveryDataset(now);
    if (dataset.venueCards.length === 0 && fixturesEnabled()) {
      return getFixtureHomeData();
    }

    const profile = createDiscoveryProfile({ clerkUserId: null });
    return buildHomeDataForProfile(profile, now, dataset);
  },
  ["consumer-home-data"],
  { revalidate: 45, tags: ["consumer:home", "consumer:venues", "consumer:events"] }
);

export async function getHomeData(): Promise<HomeDataPayload> {
  const now = new Date();
  const dataset = await buildDiscoveryDataset(now);
  if (dataset.venueCards.length === 0 && fixturesEnabled()) {
    return getFixtureHomeData();
  }

  const viewer = await resolveViewerProfile(dataset);
  if (viewer.cacheScope === "public") {
    return getPublicHomeDataCached();
  }

  return buildHomeDataForProfile(viewer.profile, now, dataset);
}

const getPublicExploreDataCached = unstable_cache(
  async (): Promise<ExploreDataPayload> => {
    const now = new Date();
    const dataset = await buildDiscoveryDataset(now);

    if (dataset.venueCards.length === 0 && fixturesEnabled()) {
      return {
        ...getFixtureExploreData(),
        cityPulse: {
          headline: "No public data yet",
          summary: "Add published venues and events to power City Pulse.",
          facts: [],
          generatedAtIso: now.toISOString(),
          freshness: "pending data",
          actionTargets: [],
        },
        friendsInterestedVenues: [],
        friendsInterestedEvents: [],
      };
    }

    const profile = createDiscoveryProfile({ clerkUserId: null });
    const rankedVenues = getPersonalizedVenueRecommendations({ venues: dataset.venueCandidates, profile, now, limit: 50 });
    const rankedEvents = getPersonalizedEventRecommendations({ events: dataset.eventCandidates, profile, now, limit: 50 });
    const neighborhoods = getNeighborhoodDiscovery(dataset.venueCandidates, dataset.eventCandidates, profile, 10);
    const cityPulse = toConsumerCityPulse(getCityPulse(dataset.venueCandidates, dataset.eventCandidates, now));

    const djs = await db.select().from(djProfiles).orderBy(desc(djProfiles.createdAt)).limit(40);
    const djCards: ConsumerDJCard[] = djs.map((dj) => ({
      id: dj.id,
      name: dj.stageName,
      profileHref: `/dj/profile/${dj.username}`,
      genres: dj.genres,
      imageUrl: dj.profileImageUrl,
      performingAt: dj.residentVenueName,
      isPerformingTonight: Boolean(rankedEvents.find((event) => event.event.venueName === (dj.residentVenueName ?? "") && event.event.isLive)),
    }));

    const categories = Array.from(new Set(rankedVenues.flatMap((row) => row.venue.genres))).slice(0, 12).map((name) => ({
      id: slugify(name),
      name,
      subtitle: `${rankedVenues.filter((row) => row.venue.genres.includes(name)).length} venues`,
      imageUrl: rankedVenues.find((row) => row.venue.genres.includes(name))?.venue.heroImageUrl ?? "/assets/nightly-fallback-image.svg",
      href: `/discover?genre=${encodeURIComponent(name)}`,
    }));

    const friendAware = getFriendAwareRecommendations({ venues: dataset.venueCandidates, events: dataset.eventCandidates, profile, now, limit: 8 });

    return {
      venues: rankedVenues.map((item) => ({ ...item.venue, recommendationReason: item.reason, recommendationReasonCode: item.reasonCode, recommendationBadges: item.badges })),
      events: rankedEvents.map((item) => ({ ...item.event, recommendationReason: item.reason, recommendationReasonCode: item.reasonCode, recommendationBadges: item.badges })),
      djs: djCards,
      neighborhoods: neighborhoods.map((insight) => ({
        id: slugify(insight.name),
        name: insight.name,
        summary: `${insight.venueCount} venues • ${insight.liveVenueCount} live`,
        imageUrl: rankedVenues.find((venue) => venue.venue.neighborhood === insight.name)?.venue.heroImageUrl ?? "/assets/nightly-fallback-image.svg",
        href: `/discover?neighborhood=${encodeURIComponent(insight.name)}`,
      })),
      categories,
      cityPulse,
      friendsInterestedVenues: friendAware.venues.map((item) => ({ ...item.venue, recommendationReason: item.reason, recommendationReasonCode: item.reasonCode, recommendationBadges: item.badges })),
      friendsInterestedEvents: friendAware.events.map((item) => ({ ...item.event, recommendationReason: item.reason, recommendationReasonCode: item.reasonCode, recommendationBadges: item.badges })),
    };
  },
  ["consumer-explore-data"],
  { revalidate: 45, tags: ["consumer:explore", "consumer:venues", "consumer:events", "consumer:djs"] }
);

export async function getExploreData(): Promise<ExploreDataPayload> {
  const dataset = await buildDiscoveryDataset(new Date());
  const viewer = await resolveViewerProfile(dataset);

  if (viewer.cacheScope === "public") {
    return getPublicExploreDataCached();
  }

  const now = new Date();
  const profile = viewer.profile;
  const base = await getPublicExploreDataCached();
  const rankedVenues = getPersonalizedVenueRecommendations({ venues: dataset.venueCandidates, profile, now, limit: 50 });
  const rankedEvents = getPersonalizedEventRecommendations({ events: dataset.eventCandidates, profile, now, limit: 50 });
  const friendAware = getFriendAwareRecommendations({ venues: dataset.venueCandidates, events: dataset.eventCandidates, profile, now, limit: 8 });

  return {
    ...base,
    venues: rankedVenues.map((item) => ({ ...item.venue, recommendationReason: item.reason, recommendationReasonCode: item.reasonCode, recommendationBadges: item.badges })),
    events: rankedEvents.map((item) => ({ ...item.event, recommendationReason: item.reason, recommendationReasonCode: item.reasonCode, recommendationBadges: item.badges })),
    friendsInterestedVenues: friendAware.venues.map((item) => ({ ...item.venue, recommendationReason: item.reason, recommendationReasonCode: item.reasonCode, recommendationBadges: item.badges })),
    friendsInterestedEvents: friendAware.events.map((item) => ({ ...item.event, recommendationReason: item.reason, recommendationReasonCode: item.reasonCode, recommendationBadges: item.badges })),
    cityPulse: toConsumerCityPulse(getCityPulse(dataset.venueCandidates, dataset.eventCandidates, now)),
  };
}

export async function searchVenues(query: string) {
  const term = query.trim();

  if (!term) {
    return [] as ConsumerVenueCard[];
  }

  const rows = await db
    .select()
    .from(venues)
    .where(
      and(
        eq(venues.publicationStatus, "published"),
        or(
          ilike(venues.name, `%${term}%`),
          ilike(venues.neighborhood, `%${term}%`),
          ilike(venues.city, `%${term}%`)
        )
      )
    )
    .limit(40);

  const ids = rows.map((venue) => venue.id);
  const [images, liveFlags] = await Promise.all([getVenueImageRows(ids), getLiveFlags(ids, new Date())]);

  const cards = rows.map((venue) =>
    toVenueCardModel({
      venue,
      imageRows: images.get(venue.id) ?? [],
      hasCameraLive: liveFlags.cameraLive.has(venue.id),
      hasLiveEvent: liveFlags.eventLive.has(venue.id),
    })
  );

  const search = term.toLowerCase();
  const terms = search.split(/\s+/).filter(Boolean);

  return [...cards]
    .sort((a, b) => {
      const score = (venue: ConsumerVenueCard) => {
        const haystack = [venue.name, venue.neighborhood, venue.genre, ...venue.genres].join(" ").toLowerCase();
        const exact = venue.name.toLowerCase().startsWith(search) ? 1.2 : 0;
        const full = haystack.includes(search) ? 1 : 0;
        const partial = terms.reduce((count, token) => count + Number(haystack.includes(token)), 0) * 0.2;
        const liveBoost = venue.isLive ? 0.25 : 0;
        return exact + full + partial + liveBoost;
      };

      return score(b) - score(a) || a.id - b.id;
    })
    .slice(0, 20);
}

export async function getVenueBySlug(slugOrId: string): Promise<ConsumerVenueDetail | null> {
  const numericId = Number.parseInt(slugOrId, 10);
  const [row] = await db
    .select()
    .from(venues)
    .where(
      Number.isFinite(numericId)
        ? eq(venues.id, numericId)
        : eq(venues.slug, slugOrId)
    )
    .limit(1);

  if (!row || !isVenuePublic(row)) {
    return null;
  }

  const [images, liveFlags] = await Promise.all([
    getVenueImageRows([row.id]),
    getLiveFlags([row.id], new Date()),
  ]);

  const card = toVenueCardModel({
    venue: row,
    imageRows: images.get(row.id) ?? [],
    hasCameraLive: liveFlags.cameraLive.has(row.id),
    hasLiveEvent: liveFlags.eventLive.has(row.id),
  });

  return {
    id: row.id,
    slug: card.slug,
    name: row.name,
    shortDescription: row.shortDescription,
    description: row.description,
    address: row.address,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    phone: row.phone,
    websiteUrl: row.websiteUrl,
    googleMapsUrl: row.googleMapsUrl,
    timezone: venueTimezone(row.timezone),
    openingHoursJson: row.openingHoursJson,
    genres: row.genres ?? [],
    categories: parseStringArrayJson(row.venueCategoriesJson),
    amenities: parseStringArrayJson(row.amenitiesJson),
    ageRequirementLabel: toAgeRequirementLabel(row.ageRequirement),
    dressCode: row.dressCode,
    parkingInformation: row.parkingInformation,
    valetAvailable: row.valetAvailable,
    coverChargeInformation: row.coverChargeInformation,
    averageRating: row.averageRating,
    reviewCount: row.reviewCount,
    imageSource: row.imageSource ?? "existing",
    heroImageUrl: card.heroImageUrl,
    thumbnailImageUrl: card.thumbnailImageUrl,
    logoImageUrl: card.logoImageUrl,
    galleryImageUrls: card.galleryImageUrls,
    isOpenNow: Boolean(row.isOpenNow),
    liveLabel: card.liveLabel,
    liveStatusProvenance: card.liveStatusProvenance,
  };
}

export async function getEventsForVenue(venueId: number) {
  const now = new Date();
  const rows = await db
    .select({ event: events, venue: venues })
    .from(events)
    .innerJoin(venues, eq(events.venueId, venues.id))
    .where(eq(events.venueId, venueId))
    .orderBy(asc(events.startsAt));

  return rows
    .filter((row) => isEventPublic(row.event, row.venue, now))
    .map((row) => toEventCardModel(row.event, row.venue, now));
}

export async function getEventBySlug(slugOrId: string): Promise<ConsumerEventDetail | null> {
  const numericId = Number.parseInt(slugOrId, 10);
  const [row] = await db
    .select({ event: events, venue: venues })
    .from(events)
    .innerJoin(venues, eq(events.venueId, venues.id))
    .where(Number.isFinite(numericId) ? eq(events.id, numericId) : eq(events.slug, slugOrId))
    .limit(1);

  if (!row || !isEventPublic(row.event, row.venue, new Date())) {
    return null;
  }

  const model = toEventCardModel(row.event, row.venue, new Date());

  return {
    id: row.event.id,
    slug: model.slug,
    title: row.event.title,
    description: row.event.description,
    venueId: row.venue.id,
    venueSlug: row.venue.slug?.trim() || slugify(row.venue.name),
    venueName: row.venue.name,
    neighborhood: row.venue.neighborhood ?? row.venue.city ?? "Atlanta",
    startsAtIso: row.event.startsAt.toISOString(),
    endsAtIso: row.event.endsAt?.toISOString() ?? null,
    startLabel: model.startTimeLabel,
    endLabel: model.endTimeLabel,
    dateLabel: model.dateLabel,
    timezone: venueTimezone(row.event.timezone ?? row.venue.timezone),
    artworkImageUrl: model.imageUrl,
    genres: model.genres,
    ageRequirementLabel: model.ageRequirementLabel,
    dressCode: model.dressCode,
    coverLabel: model.cover > 0 ? `$${model.cover}` : "No cover",
    ticketUrl: row.event.ticketUrl,
    guestListUrl: row.event.guestListUrl,
    ticketStatus: model.ticketStatus,
    requiresTickets: Boolean(row.event.requiresTickets),
    supportsFreeRsvp: Boolean(row.event.supportsFreeRsvp),
    waitlistEnabled: Boolean(row.event.waitlistEnabled),
    ticketSalesVisibility: row.event.ticketSalesVisibility ?? "public",
    startingPriceCents: startingPriceCentsForEvent(row.event),
    salesStartAtIso: row.event.ticketSalesStartAt?.toISOString() ?? null,
    salesEndAtIso: row.event.ticketSalesEndAt?.toISOString() ?? null,
    doorsOpenAtIso: row.event.doorsOpenAt?.toISOString() ?? null,
    capacity: row.event.capacity ?? null,
    reservedCapacity: row.event.reservedCapacity ?? 0,
    minimumAge: row.event.minimumAge ?? null,
    transferPolicy: row.event.ticketTransferPolicy ?? "allowed",
    refundPolicy: row.event.refundPolicy ?? "standard",
    reEntryPolicy: row.event.reEntryPolicy ?? "no_reentry",
  };
}

export async function getEventsTonight() {
  const now = new Date();
  const rows = await getPublicEventRows(now);

  return rows
    .filter((row) => isInTonightWindow(row.event.startsAt, row.event.endsAt, now, venueTimezone(row.event.timezone ?? row.venue.timezone)))
    .map((row) => toEventCardModel(row.event, row.venue, now));
}

export async function getUpcomingEvents(limit = 24) {
  const now = new Date();
  const rows = await getPublicEventRows(now);

  return rows
    .filter((row) => row.event.startsAt >= now)
    .slice(0, limit)
    .map((row) => toEventCardModel(row.event, row.venue, now));
}

export async function getSimilarVenues(venueId: number) {
  const all = await getPublicVenueRows();
  const target = all.find((venue) => venue.id === venueId);

  if (!target) {
    return [] as ConsumerVenueCard[];
  }

  const related = all
    .filter((venue) => venue.id !== target.id)
    .filter((venue) => {
      const sameNeighborhood = venue.neighborhood && target.neighborhood && venue.neighborhood === target.neighborhood;
      const sharedGenre = (venue.genres ?? []).some((genre) => (target.genres ?? []).includes(genre));

      return Boolean(sameNeighborhood || sharedGenre);
    })
    .slice(0, 8);

  const ids = related.map((venue) => venue.id);
  const [images, liveFlags] = await Promise.all([getVenueImageRows(ids), getLiveFlags(ids, new Date())]);

  return related.map((venue) =>
    toVenueCardModel({
      venue,
      imageRows: images.get(venue.id) ?? [],
      hasCameraLive: liveFlags.cameraLive.has(venue.id),
      hasLiveEvent: liveFlags.eventLive.has(venue.id),
    })
  );
}

export async function getFeaturedDJsForVenue(venueName: string, limit = 8) {
  const rows = await db
    .select()
    .from(djProfiles)
    .where(ilike(djProfiles.residentVenueName, `%${venueName}%`))
    .limit(limit);

  return rows.map((dj) => ({
    id: dj.id,
    name: dj.stageName,
    profileHref: `/dj/profile/${dj.username}`,
    genres: dj.genres,
    imageUrl: dj.profileImageUrl,
    performingAt: dj.residentVenueName,
    isPerformingTonight: true,
  }));
}

export const getLiveData = unstable_cache(
  async (): Promise<LiveDataPayload> => {
    const now = new Date();
    const dataset = await buildDiscoveryDataset(now);

    if (dataset.venueCards.length === 0 && fixturesEnabled()) {
      return getFixtureLiveData();
    }
    const profile = createDiscoveryProfile({ clerkUserId: null });
    const rankedVenueRows = getPersonalizedVenueRecommendations({
      venues: dataset.venueCandidates,
      profile,
      now,
      filters: { liveNow: true },
      limit: 12,
    });
    const rankedEventRows = getPersonalizedEventRecommendations({
      events: dataset.eventCandidates,
      profile,
      now,
      filters: { liveNow: true },
      limit: 12,
    });

    const venueCards = rankedVenueRows.map((item) => item.venue);
    const liveEvents = rankedEventRows.map((item) => item.event);

    const djRows = await db.select().from(djProfiles).orderBy(desc(djProfiles.createdAt)).limit(20);

    const liveDjs = djRows
      .map((dj) => ({
        id: dj.id,
        name: dj.stageName,
        profileHref: `/dj/profile/${dj.username}`,
        genres: dj.genres,
        imageUrl: dj.profileImageUrl,
        performingAt: dj.residentVenueName,
        isPerformingTonight: Boolean(liveEvents.find((event) => event.venueName === dj.residentVenueName)),
      }))
      .slice(0, 12);

    const summary = getCityPulse(dataset.venueCandidates, dataset.eventCandidates, now).summary;

    return {
      summary,
      venues: venueCards,
      events: liveEvents,
      djs: liveDjs,
      activity: liveEvents.slice(0, 6).map((event) => ({
        id: `event-${event.id}`,
        label: event.name,
        detail: `${event.venueName} • ${event.startTimeLabel}`,
        occurredAtLabel: event.dateLabel,
      })),
    };
  },
  ["consumer-live-data"],
  { revalidate: 30, tags: ["consumer:live", "consumer:venues", "consumer:events", "consumer:cameras"] }
);

export async function getPublishedVenueCount() {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(venues)
    .where(eq(venues.publicationStatus, "published"));

  return result?.count ?? 0;
}

export async function getPublishedEventCount() {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(events)
    .where(eq(events.publicationStatus, "published"));

  return result?.count ?? 0;
}

export async function getAdminDiscoveryDebugSnapshot() {
  const now = new Date();
  const dataset = await buildDiscoveryDataset(now);
  const viewer = await resolveViewerProfile(dataset);

  return buildDiscoveryDebugSnapshot({
    venueCandidates: dataset.venueCandidates,
    eventCandidates: dataset.eventCandidates,
    profile: viewer.profile,
    now,
    cacheScope: viewer.cacheScope,
  });
}
