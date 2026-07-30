import type { ConsumerEventCard, ConsumerVenueCard } from "@/lib/consumer/types";

export type DiscoveryIntent =
  | "high-energy"
  | "hip-hop"
  | "afrobeats"
  | "r&b"
  | "edm"
  | "latin"
  | "upscale"
  | "casual"
  | "lounge"
  | "dancing"
  | "date-night"
  | "group-night"
  | "live-music"
  | "rooftop"
  | "budget-friendly"
  | "vip"
  | "late-night"
  | "near-me";

export type DiscoveryProfile = {
  clerkUserId: string | null;
  preferredGenres: string[];
  preferredNeighborhoods: string[];
  preferredVenueCategories: string[];
  preferredEventTypes: string[];
  preferredPriceLevels: number[];
  typicalNightlifeDays: number[];
  typicalNightlifeHours: number[];
  age: number | null;
  savedVenueIds: number[];
  savedEventIds: number[];
  recentlyViewedVenueIds: number[];
  recentlyViewedEventIds: number[];
  preferredDistanceMiles: number | null;
  liveStreamInterest: boolean | null;
  premiumStatus: boolean | null;
  intents: DiscoveryIntent[];
};

export type DiscoveryFilters = {
  query?: string;
  sort?: "recommended" | "trending" | "distance" | "rating" | "starting-soon";
  liveNow?: boolean;
  openNow?: boolean;
  tonight?: boolean;
  neighborhood?: string[];
  genre?: string[];
  venueCategory?: string[];
  eventType?: string[];
  priceLevel?: number[];
  ageMax?: number;
  friendActivityOnly?: boolean;
};

export type SocialVenueSignal = {
  interestedFriends: number;
  activeFriends: number;
};

export type SocialEventSignal = {
  interestedFriends: number;
  attendingFriends: number;
};

export type DiscoveryVenueCandidate = {
  venue: ConsumerVenueCard;
  categories: string[];
  priceLevel: number | null;
  ageRequirement: number | null;
  averageRating: number | null;
  reviewCount: number | null;
  isPublished: boolean;
  isVerified: boolean;
  isArchived: boolean;
  isSuspended: boolean;
  isOpenNow: boolean;
  hasLivePreview: boolean;
  hasEventTonight: boolean;
  updatedAt: Date | null;
  social: SocialVenueSignal;
};

export type DiscoveryEventCandidate = {
  event: ConsumerEventCard;
  venue: ConsumerVenueCard;
  eventType: string | null;
  startsAt: Date;
  endsAt: Date | null;
  timezone: string;
  publicationStatus: string;
  lifecycleStatus: string;
  approvalStatus: string;
  isCancelled: boolean;
  isArchived: boolean;
  isFeatured: boolean;
  coverCents: number;
  views: number;
  saves: number;
  shares: number;
  social: SocialEventSignal;
};

export type ScoreBreakdown = Record<string, number>;

export type ScoredVenueRecommendation = {
  venue: ConsumerVenueCard;
  score: number;
  reason: string;
  reasonCode: string;
  badges: string[];
  breakdown: ScoreBreakdown;
};

export type ScoredEventRecommendation = {
  event: ConsumerEventCard;
  score: number;
  reason: string;
  reasonCode: string;
  badges: string[];
  breakdown: ScoreBreakdown;
};

export type DiscoveryFact = {
  label: string;
  value: string;
};

export type CityPulse = {
  headline: string;
  summary: string;
  facts: DiscoveryFact[];
  generatedAt: Date;
  freshness: string;
  actionTargets?: Array<{ label: string; href: string }>;
};

export type DiscoveryDebugVenueRow = {
  venueId: number;
  venueName: string;
  included: boolean;
  exclusionReason: string | null;
  score: number;
  reason: string;
  breakdown: ScoreBreakdown;
};

export type DiscoveryDebugEventRow = {
  eventId: number;
  eventName: string;
  included: boolean;
  exclusionReason: string | null;
  score: number;
  reason: string;
  breakdown: ScoreBreakdown;
};

export type DiscoveryDebugSnapshot = {
  generatedAt: Date;
  venueRows: DiscoveryDebugVenueRow[];
  eventRows: DiscoveryDebugEventRow[];
  cacheScope: "public" | "user";
};
