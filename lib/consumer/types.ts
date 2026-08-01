export type LiveStatusProvenance =
  | "live_system"
  | "owner_reported"
  | "estimated"
  | "scheduled"
  | "demo"
  | "unavailable";

export type ConsumerVenueCard = {
  id: number;
  slug: string;
  href: string;
  name: string;
  neighborhood: string;
  genre: string;
  genres: string[];
  distanceLabel: string | null;
  isLive: boolean;
  liveLabel: "OPEN NOW" | "EVENT LIVE" | "CAMERA LIVE" | "TRENDING" | null;
  liveStatusProvenance: LiveStatusProvenance;
  crowdLevel: string | null;
  heroImageUrl: string;
  thumbnailImageUrl: string;
  logoImageUrl: string | null;
  galleryImageUrls: string[];
  imageSource: string;
  recommendationReason?: string;
  recommendationReasonCode?: string;
  recommendationBadges?: string[];
};

export type ConsumerEventCard = {
  id: number;
  slug: string;
  href: string;
  name: string;
  venueId: number;
  venueName: string;
  venueSlug: string;
  neighborhood: string;
  startTimeLabel: string;
  endTimeLabel: string | null;
  dateLabel: string;
  genres: string[];
  cover: number;
  ageRequirementLabel: string | null;
  dressCode: string | null;
  crowdLevel: string | null;
  ticketStatus: string;
  ticketSalesVisibility?: string;
  requiresTickets?: boolean;
  supportsFreeRsvp?: boolean;
  waitlistEnabled?: boolean;
  guestListEnabled?: boolean;
  startingPriceCents?: number | null;
  capacity?: number | null;
  ticketUrl: string | null;
  guestListUrl: string | null;
  isLive: boolean;
  imageUrl: string;
  distanceMiles: number | null;
  recommendationReason?: string;
  recommendationReasonCode?: string;
  recommendationBadges?: string[];
};

export type ConsumerCityPulse = {
  headline: string;
  summary: string;
  facts: Array<{ label: string; value: string }>;
  generatedAtIso: string;
  freshness: string;
  actionTargets: Array<{ label: string; href: string }>;
};

export type ConsumerVenueDetail = {
  id: number;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  phone: string | null;
  websiteUrl: string | null;
  googleMapsUrl: string | null;
  timezone: string;
  openingHoursJson: string | null;
  genres: string[];
  categories: string[];
  amenities: string[];
  ageRequirementLabel: string | null;
  dressCode: string | null;
  parkingInformation: string | null;
  valetAvailable: boolean | null;
  coverChargeInformation: string | null;
  averageRating: number | null;
  reviewCount: number | null;
  imageSource: string;
  heroImageUrl: string;
  thumbnailImageUrl: string;
  logoImageUrl: string | null;
  galleryImageUrls: string[];
  isOpenNow: boolean;
  liveLabel: "OPEN NOW" | "EVENT LIVE" | "CAMERA LIVE" | "TRENDING" | null;
  liveStatusProvenance: LiveStatusProvenance;
};

export type ConsumerEventDetail = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  venueId: number;
  venueSlug: string;
  venueName: string;
  neighborhood: string;
  startsAtIso: string;
  endsAtIso: string | null;
  startLabel: string;
  endLabel: string | null;
  dateLabel: string;
  timezone: string;
  artworkImageUrl: string;
  genres: string[];
  ageRequirementLabel: string | null;
  dressCode: string | null;
  coverLabel: string;
  ticketUrl: string | null;
  guestListUrl: string | null;
  ticketStatus: string;
  requiresTickets: boolean;
  supportsFreeRsvp: boolean;
  waitlistEnabled: boolean;
  ticketSalesVisibility: string;
  startingPriceCents: number | null;
  salesStartAtIso: string | null;
  salesEndAtIso: string | null;
  doorsOpenAtIso: string | null;
  capacity: number | null;
  reservedCapacity: number;
  minimumAge: number | null;
  transferPolicy: string;
  refundPolicy: string;
  reEntryPolicy: string;
};

export type ConsumerDJCard = {
  id: number;
  name: string;
  profileHref: string;
  genres: string[];
  imageUrl: string | null;
  performingAt: string | null;
  isPerformingTonight: boolean;
};

export type ExploreDataPayload = {
  venues: ConsumerVenueCard[];
  events: ConsumerEventCard[];
  djs: ConsumerDJCard[];
  neighborhoods: Array<{ id: string; name: string; summary: string; imageUrl: string; href: string }>;
  categories: Array<{ id: string; name: string; subtitle: string; imageUrl: string; href: string }>;
  cityPulse: ConsumerCityPulse;
  friendsInterestedVenues: ConsumerVenueCard[];
  friendsInterestedEvents: ConsumerEventCard[];
};

export type HomeDataPayload = {
  heroSummary: {
    greeting: string;
    title: string;
    subtitle: string;
  };
  cityPulse: ConsumerCityPulse;
  tonightTopPicks: ConsumerVenueCard[];
  eventsStartingSoon: ConsumerEventCard[];
  vibeForYou: ConsumerVenueCard[];
  trendingNeighborhoods: Array<{ id: string; name: string; summary: string; imageUrl: string; href: string }>;
  friendsInterestedVenues: ConsumerVenueCard[];
  friendsInterestedEvents: ConsumerEventCard[];
  liveTonight: ConsumerVenueCard[];
  trending: ConsumerVenueCard[];
  eventsTonight: ConsumerEventCard[];
  popularNearby: ConsumerVenueCard[];
  recommended: ConsumerVenueCard[];
};

export type LiveDataPayload = {
  summary: string;
  venues: ConsumerVenueCard[];
  events: ConsumerEventCard[];
  djs: ConsumerDJCard[];
  activity: Array<{ id: string; label: string; detail: string; occurredAtLabel: string }>;
};
