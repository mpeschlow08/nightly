import type { ConsumerCityPulse, ConsumerEventCard, ConsumerVenueCard, ExploreDataPayload, HomeDataPayload } from "@/lib/consumer/types";

export type ConciergeIntent = "live_now" | "tonight" | "low_key" | "genre" | "friends" | "where_is_everyone" | "budget" | "plan" | "general";

export type ConciergeStarterPrompt = {
  label: string;
  message: string;
};

export type ConciergeMessageRole = "user" | "assistant";

export type ConciergeMessageMetadata = {
  intent?: ConciergeIntent;
  summary?: string;
  followUps?: string[];
  recommendedVenues?: ConsumerVenueCard[];
  recommendedEvents?: ConsumerEventCard[];
  cityPulse?: ConsumerCityPulse | null;
};

export type ConciergeThreadMessage = {
  id: number;
  role: ConciergeMessageRole;
  content: string;
  intent: ConciergeIntent | null;
  createdAtIso: string;
  metadata: ConciergeMessageMetadata;
};

export type ConciergeThreadPayload = {
  id: number;
  title: string;
  sessionKey: string;
  status: "active" | "archived";
  createdAtIso: string;
  updatedAtIso: string;
  lastMessageAtIso: string;
  messages: ConciergeThreadMessage[];
};

export type ConciergeRecommendationPack = {
  intent: ConciergeIntent;
  summary: string;
  followUps: string[];
  recommendedVenues: ConsumerVenueCard[];
  recommendedEvents: ConsumerEventCard[];
  cityPulse: ConsumerCityPulse | null;
};

export type ConciergeApiPayload = {
  thread: ConciergeThreadPayload;
  recommendations: ConciergeRecommendationPack | null;
  starterPrompts: ConciergeStarterPrompt[];
};

export type ConciergeConversationContext = {
  homeData: HomeDataPayload;
  exploreData: ExploreDataPayload;
};