export const DISCOVERY_DEFAULTS = {
  nightlifeCutoffHour: 5,
  startingSoonMinutes: 120,
  fallbackMaxDistanceMiles: 25,
} as const;

export const VENUE_SCORE_WEIGHTS = {
  publication: 0.14,
  liveNow: 0.12,
  openNow: 0.08,
  livePreview: 0.05,
  vibe: 0.07,
  ratingConfidence: 0.08,
  distance: 0.1,
  neighborhoodMatch: 0.08,
  genreMatch: 0.1,
  categoryMatch: 0.05,
  friendSignal: 0.07,
  activeEventTonight: 0.04,
  featured: 0.03,
  imageCompleteness: 0.03,
  profileCompleteness: 0.03,
  freshness: 0.02,
  crowdMomentum: 0.01,
} as const;

export const EVENT_SCORE_WEIGHTS = {
  publication: 0.16,
  lifecycle: 0.08,
  timing: 0.15,
  venueQuality: 0.09,
  genreMatch: 0.1,
  eventTypeMatch: 0.06,
  neighborhoodMatch: 0.08,
  distance: 0.08,
  ticketAccess: 0.04,
  featured: 0.03,
  popularity: 0.05,
  friendSignal: 0.04,
  liveNow: 0.02,
  affordability: 0.07,
  imageCompleteness: 0.05,
} as const;

export const GENRE_ALIASES: Record<string, string> = {
  rap: "hip-hop",
  hiphop: "hip-hop",
  "hip hop": "hip-hop",
  "afro beats": "afrobeats",
  "afro-beats": "afrobeats",
  electronic: "edm",
  "tech house": "house",
  "drum and bass": "dnb",
};

export const CATEGORY_ALIASES: Record<string, string> = {
  nightclub: "club",
  loungebar: "lounge",
  rooftopbar: "rooftop",
  cocktailbar: "cocktail",
};

export const MOOD_INTENT_MAP: Record<string, { genres?: string[]; categories?: string[]; crowdLevels?: string[] }> = {
  "high-energy": { genres: ["edm", "hip-hop", "afrobeats"], crowdLevels: ["buzzing", "packed"] },
  "hip-hop": { genres: ["hip-hop"] },
  afrobeats: { genres: ["afrobeats"] },
  "r&b": { genres: ["r&b"] },
  edm: { genres: ["edm"] },
  latin: { genres: ["latin"] },
  upscale: { categories: ["upscale", "vip"], crowdLevels: ["steady", "buzzing"] },
  casual: { categories: ["casual", "bar", "lounge"] },
  lounge: { categories: ["lounge"], crowdLevels: ["mellow", "steady"] },
  dancing: { categories: ["club"], genres: ["edm", "hip-hop", "house"] },
  "date-night": { categories: ["lounge", "rooftop", "cocktail"], crowdLevels: ["mellow", "steady"] },
  "group-night": { categories: ["club", "rooftop", "bar"], crowdLevels: ["steady", "buzzing"] },
  "live-music": { categories: ["live-music"], genres: ["r&b", "latin", "house"] },
  rooftop: { categories: ["rooftop"] },
  "budget-friendly": { categories: ["casual", "bar"] },
  vip: { categories: ["vip", "upscale"] },
  "late-night": { crowdLevels: ["buzzing", "packed"] },
  "near-me": {},
};

export const RECOMMENDATION_REASON_PRIORITY = [
  "friend-aware",
  "live-now",
  "starts-soon",
  "genre-match",
  "neighborhood-match",
  "trending",
  "distance",
  "top-rated",
] as const;
