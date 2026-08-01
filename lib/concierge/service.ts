import type { ConsumerCityPulse, ConsumerEventCard, ConsumerVenueCard } from "@/lib/consumer/types";
import type {
  ConciergeConversationContext,
  ConciergeIntent,
  ConciergeMessageMetadata,
  ConciergeRecommendationPack,
  ConciergeStarterPrompt,
} from "@/lib/concierge/types";

const DEFAULT_CITY_PULSE: ConsumerCityPulse = {
  headline: "Tell me the vibe you want.",
  summary: "I can narrow Nightly to live rooms, low-key lounges, date-night spots, or something genre-specific.",
  facts: [],
  generatedAtIso: new Date().toISOString(),
  freshness: "live concierge guidance",
  actionTargets: [
    { label: "Live now", href: "/live" },
    { label: "Explore", href: "/discover" },
  ],
};

export const conciergeStarterPrompts: ConciergeStarterPrompt[] = [
  { label: "Find something live now", message: "What is open now with a live crowd?" },
  { label: "Low-key date night", message: "Show me a low-key date night spot with a polished vibe." },
  { label: "Genre specific", message: "Find the best house or hip-hop night tonight." },
  { label: "Crew plans", message: "Where should my crew go if we want drinks and energy?" },
  { label: "Where is everyone?", message: "Where is everyone already downtown or in Midtown?" },
  { label: "Affordable group plan", message: "Find clubs everyone can afford and build tonight's plan." },
];

function dedupeById<T extends { id: number }>(items: T[]) {
  const seen = new Set<number>();
  const output: T[] = [];

  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }

    seen.add(item.id);
    output.push(item);
  }

  return output;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+&/\-\s]/g, " ");
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function detectIntent(message: string): ConciergeIntent {
  const normalized = normalizeText(message);

  if (includesAny(normalized, ["where is everyone", "whos already", "who is already", "everyone downtown", "checked into midtown", "already downtown"])) {
    return "where_is_everyone";
  }

  if (includesAny(normalized, ["afford", "affordable", "cheap", "budget", "under $", "under 20", "under 30"])) {
    return "budget";
  }

  if (includesAny(normalized, ["build tonight s plan", "build tonights plan", "tonights plan", "tonight s plan", "find somewhere all", "all five of us", "optimize tonight", "build a plan"])) {
    return "plan";
  }

  if (includesAny(normalized, ["open now", "live now", "live crowd", "right now", "open late", "camera live", "event live"])) {
    return "live_now";
  }

  if (includesAny(normalized, ["crew", "friends", "group", "with friends", "link up", "together"])) {
    return "friends";
  }

  if (includesAny(normalized, ["low key", "low-key", "date", "lounge", "conversation", "cozy", "polished", "chill", "quiet"])) {
    return "low_key";
  }

  if (includesAny(normalized, ["house", "techno", "hip hop", "hip-hop", "r&b", "afrobeats", "latin", "edm", "dancehall", "deep house"])) {
    return "genre";
  }

  if (includesAny(normalized, ["tonight", "event", "party", "show", "rsvp", "guest list", "dj", "set", "after hours", "late night", "late-night"])) {
    return "tonight";
  }

  return "general";
}

const GENRE_HINTS: Array<{ keywords: string[]; genres: string[] }> = [
  { keywords: ["hip hop", "hip-hop", "rap"], genres: ["hip-hop", "rap"] },
  { keywords: ["house", "deep house", "afro house"], genres: ["house", "deep house", "afro house"] },
  { keywords: ["techno"], genres: ["techno"] },
  { keywords: ["r&b", "rnb"], genres: ["r&b", "rnb"] },
  { keywords: ["afrobeats", "afro beats", "afrobeat"], genres: ["afrobeats", "afrobeat"] },
  { keywords: ["latin", "reggaeton"], genres: ["latin", "reggaeton"] },
  { keywords: ["edm", "electronic"], genres: ["edm", "electronic"] },
  { keywords: ["dancehall"], genres: ["dancehall"] },
];

function extractGenreHints(message: string) {
  const normalized = normalizeText(message);
  const hints: string[] = [];

  for (const entry of GENRE_HINTS) {
    if (includesAny(normalized, entry.keywords)) {
      hints.push(...entry.genres);
    }
  }

  return Array.from(new Set(hints));
}

function venueMatchesGenre(venue: ConsumerVenueCard, genres: string[]) {
  const normalizedVenueGenres = venue.genres.map((genre) => genre.toLowerCase());
  return genres.some((genre) => normalizedVenueGenres.some((candidate) => candidate.includes(genre)));
}

function eventMatchesGenre(event: ConsumerEventCard, genres: string[]) {
  const normalizedEventGenres = event.genres.map((genre) => genre.toLowerCase());
  return genres.some((genre) => normalizedEventGenres.some((candidate) => candidate.includes(genre)));
}

function lowKeyCrowdRank(crowdLevel: string | null) {
  switch (crowdLevel) {
    case "Mellow":
      return 0;
    case "Steady":
      return 1;
    case "Buzzing":
      return 2;
    case "Packed":
      return 3;
    default:
      return 4;
  }
}

function buildFallbackSummary(message: string, intent: ConciergeIntent, venueCount: number, eventCount: number) {
  if (intent === "where_is_everyone") {
    return `I prioritized group-friendly districts and active rooms, with ${venueCount} venue options and ${eventCount} event options that fit social coordination.`;
  }

  if (intent === "budget") {
    return `I filtered this toward lower-cover, better-value nightlife with ${venueCount} venue matches and ${eventCount} event matches.`;
  }

  if (intent === "plan") {
    return `I built a crew-oriented short list with ${venueCount} venue options and ${eventCount} event options for a full-night plan.`;
  }

  if (intent === "live_now") {
    return `I found ${venueCount} live venues and ${eventCount} event picks that feel active right now.`;
  }

  if (intent === "low_key") {
    return `I found ${venueCount} lower-key venues that fit a smoother pace.`;
  }

  if (intent === "genre") {
    return `I narrowed this to ${venueCount} venue matches and ${eventCount} event matches for that sound.`;
  }

  if (intent === "friends") {
    return `I pulled ${venueCount} crew-friendly venues and ${eventCount} group-ready events.`;
  }

  if (intent === "tonight") {
    return `I found ${venueCount} venues and ${eventCount} events worth checking tonight.`;
  }

  return message.trim().length > 0
    ? "Give me a neighborhood, vibe, or genre and I’ll narrow it down fast."
    : "Tell me the mood, area, or genre you want and I’ll narrow the city for you.";
}

function buildFollowUps(intent: ConciergeIntent) {
  switch (intent) {
    case "where_is_everyone":
      return ["Only show Midtown", "Make it more affordable", "Build a full-night plan"];
    case "budget":
      return ["Keep it under $20 cover", "Show the best guest-list options", "Find a cheaper Midtown option"];
    case "plan":
      return ["Prioritize walkable stops", "Add a rooftop opener", "Only show places with tickets tonight"];
    case "live_now":
      return ["Show something closer to Midtown", "Find bottle-service options", "What is open late?"];
    case "low_key":
      return ["Make it more upscale", "Show a rooftop option", "Find something in Buckhead"];
    case "genre":
      return ["Keep it tonight only", "Show the best venue picks", "Find a late set"];
    case "friends":
      return ["Make it more energetic", "Find something with reservations", "Show a later crowd"];
    case "tonight":
      return ["Only show events with tickets", "Find a venue nearby", "Narrow to 21+"];
    default:
      return ["What is open now?", "Show a low-key date night", "Find a house or hip-hop crowd"];
  }
}

function titleFromPrompt(message: string, intent: ConciergeIntent) {
  const trimmed = message.trim();

  if (trimmed.length === 0) {
    return "Nightly Concierge";
  }

  if (intent === "where_is_everyone") return "Where is everyone";
  if (intent === "budget") return "Affordable plans";
  if (intent === "plan") return "Tonight's plan";
  if (intent === "live_now") return "Live now";
  if (intent === "low_key") return "Low-key night";
  if (intent === "genre") return "Genre search";
  if (intent === "friends") return "Crew plans";
  if (intent === "tonight") return "Tonight's picks";

  return trimmed.length > 42 ? `${trimmed.slice(0, 39).trimEnd()}...` : trimmed;
}

function scoreVenueByIntent(venue: ConsumerVenueCard, intent: ConciergeIntent) {
  if (intent === "where_is_everyone") {
    return venue.neighborhood.toLowerCase().includes("midtown") || venue.neighborhood.toLowerCase().includes("downtown") ? 0 : venue.isLive ? 1 : 2;
  }

  if (intent === "budget") {
    return venue.liveLabel === "EVENT LIVE" ? 0 : venue.crowdLevel === "Steady" ? 1 : 2;
  }

  if (intent === "plan") {
    return venue.recommendationBadges?.includes("Popular") ? 0 : venue.isLive ? 1 : 2;
  }

  if (intent === "live_now") {
    return (venue.isLive ? 0 : 1) + (venue.liveLabel === "EVENT LIVE" || venue.liveLabel === "CAMERA LIVE" ? 0 : 1);
  }

  if (intent === "low_key") {
    return lowKeyCrowdRank(venue.crowdLevel);
  }

  if (intent === "friends") {
    return venue.recommendationBadges?.includes("Friends") ? 0 : venue.recommendationBadges?.includes("Popular") ? 1 : 2;
  }

  return venue.isLive ? 0 : venue.crowdLevel === "Buzzing" ? 1 : 2;
}

function scoreEventByIntent(event: ConsumerEventCard, intent: ConciergeIntent) {
  if (intent === "where_is_everyone") {
    return event.neighborhood.toLowerCase().includes("midtown") || event.neighborhood.toLowerCase().includes("downtown") ? 0 : event.dateLabel === "Tonight" ? 1 : 2;
  }

  if (intent === "budget") {
    return event.cover <= 20 ? 0 : event.cover <= 30 ? 1 : 2;
  }

  if (intent === "plan") {
    return event.dateLabel === "Tonight" ? 0 : event.cover <= 25 ? 1 : 2;
  }

  if (intent === "live_now") {
    return event.isLive ? 0 : event.dateLabel === "Tonight" ? 1 : 2;
  }

  if (intent === "low_key") {
    return event.crowdLevel === "Mellow" ? 0 : event.crowdLevel === "Steady" ? 1 : 2;
  }

  return event.dateLabel === "Tonight" ? 0 : 1;
}

export function buildConciergeRecommendations(input: ConciergeConversationContext & { message: string }) {
  const intent = detectIntent(input.message);
  const genreHints = extractGenreHints(input.message);

  const venuePool = dedupeById([
    ...input.homeData.liveTonight,
    ...input.homeData.tonightTopPicks,
    ...input.homeData.vibeForYou,
    ...input.homeData.recommended,
    ...input.exploreData.venues,
    ...input.exploreData.friendsInterestedVenues,
  ]).filter(Boolean);

  const eventPool = dedupeById([
    ...input.homeData.eventsStartingSoon,
    ...input.homeData.eventsTonight,
    ...input.exploreData.events,
    ...input.exploreData.friendsInterestedEvents,
  ]).filter(Boolean);

  let recommendedVenues = venuePool;
  let recommendedEvents = eventPool;

  if (intent === "live_now") {
    recommendedVenues = venuePool.filter((venue) => venue.isLive || venue.liveLabel === "EVENT LIVE" || venue.liveLabel === "CAMERA LIVE");
    recommendedEvents = eventPool.filter((event) => event.isLive || event.dateLabel === "Tonight");
  }

  if (intent === "where_is_everyone") {
    recommendedVenues = venuePool.filter((venue) => venue.neighborhood.toLowerCase().includes("midtown") || venue.neighborhood.toLowerCase().includes("downtown") || venue.isLive);
    recommendedEvents = eventPool.filter((event) => event.neighborhood.toLowerCase().includes("midtown") || event.neighborhood.toLowerCase().includes("downtown") || event.dateLabel === "Tonight");
  }

  if (intent === "budget") {
    recommendedVenues = venuePool.filter((venue) => venue.crowdLevel !== "Packed");
    recommendedEvents = eventPool.filter((event) => event.cover <= 30);
  }

  if (intent === "plan") {
    recommendedVenues = venuePool.filter((venue) => venue.isLive || venue.recommendationBadges?.includes("Popular") || venue.crowdLevel !== "Packed");
    recommendedEvents = eventPool.filter((event) => event.dateLabel === "Tonight" || event.cover <= 30);
  }

  if (intent === "low_key") {
    recommendedVenues = venuePool.filter((venue) => venue.crowdLevel !== "Packed").sort((left, right) => lowKeyCrowdRank(left.crowdLevel) - lowKeyCrowdRank(right.crowdLevel));
    recommendedEvents = eventPool.filter((event) => event.crowdLevel !== "Packed").sort((left, right) => scoreEventByIntent(left, intent) - scoreEventByIntent(right, intent));
  }

  if (intent === "friends") {
    recommendedVenues = venuePool.filter((venue) => Boolean(venue.recommendationBadges?.includes("Friends") || venue.recommendationBadges?.includes("Popular")));
    recommendedEvents = eventPool.filter((event) => event.recommendationBadges?.includes("Friends") || event.dateLabel === "Tonight");
  }

  if (intent === "tonight") {
    recommendedVenues = venuePool.filter((venue) => venue.isLive || venue.recommendationBadges?.includes("Trending") || venue.crowdLevel !== "Packed");
    recommendedEvents = eventPool.filter((event) => event.dateLabel === "Tonight");
  }

  if (genreHints.length > 0) {
    const genreVenues = venuePool.filter((venue) => venueMatchesGenre(venue, genreHints));
    const genreEvents = eventPool.filter((event) => eventMatchesGenre(event, genreHints));
    recommendedVenues = genreVenues.length > 0 ? genreVenues : recommendedVenues;
    recommendedEvents = genreEvents.length > 0 ? genreEvents : recommendedEvents;
  }

  recommendedVenues = recommendedVenues.sort((left, right) => scoreVenueByIntent(left, intent) - scoreVenueByIntent(right, intent)).slice(0, 6);
  recommendedEvents = recommendedEvents.sort((left, right) => scoreEventByIntent(left, intent) - scoreEventByIntent(right, intent)).slice(0, 4);

  const cityPulse = input.homeData.cityPulse ?? DEFAULT_CITY_PULSE;
  const summary = buildFallbackSummary(input.message, intent, recommendedVenues.length, recommendedEvents.length);

  const venueNames = recommendedVenues.slice(0, 3).map((venue) => venue.name).join(", ");
  const eventNames = recommendedEvents.slice(0, 2).map((event) => event.name).join(", ");
  const intro = intent === "genre"
    ? `I narrowed Nightly to the ${genreHints.join(" and ") || "sound"} lane.`
    : intent === "where_is_everyone"
      ? "I prioritized active areas where a crew is most likely to already be moving."
      : intent === "budget"
        ? "I filtered toward options that are easier to split across a group budget."
        : intent === "plan"
          ? "I shaped this like a multi-stop night instead of a single pick."
    : intent === "low_key"
      ? "I kept this on the smoother side."
      : intent === "live_now"
        ? "I prioritized places that feel active right now."
        : intent === "friends"
          ? "I focused on spots that work for a group."
          : intent === "tonight"
            ? "I centered this on tonight's momentum."
            : "I used the current city pulse and active recommendations to narrow things down.";

  const reply = [
    intro,
    summary,
    venueNames ? `Top venue picks: ${venueNames}.` : null,
    eventNames ? `Event picks: ${eventNames}.` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join(" ");

  const followUps = buildFollowUps(intent);

  return {
    intent,
    reply,
    summary,
    followUps,
    recommendedVenues,
    recommendedEvents,
    cityPulse,
    title: titleFromPrompt(input.message, intent),
    metadata: {
      intent,
      summary,
      followUps,
      recommendedVenues,
      recommendedEvents,
      cityPulse,
    } satisfies ConciergeMessageMetadata,
  } satisfies ConciergeRecommendationPack & { reply: string; title: string; metadata: ConciergeMessageMetadata };
}

export function buildConciergeWelcomeMessage(cityPulse: ConsumerCityPulse | null): ConciergeMessageMetadata {
  return {
    intent: "general",
    summary: cityPulse?.summary ?? DEFAULT_CITY_PULSE.summary,
    followUps: conciergeStarterPrompts.map((prompt) => prompt.message),
    recommendedVenues: [],
    recommendedEvents: [],
    cityPulse: cityPulse ?? DEFAULT_CITY_PULSE,
  };
}