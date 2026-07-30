import { discoverVenues } from "@/data/nightly";

export type VenueDetailReview = {
  id: number;
  author: string;
  rating: number;
  text: string;
  when: string;
};

export type VenueDetailDj = {
  id: number;
  name: string;
  genres: string[];
  imageUrl: string;
  profileHref: string;
};

export const venueHeroImageFallbackByName: Record<string, string> = {
  "Tongue & Groove": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1800&q=80",
  "District Atlanta": "https://images.unsplash.com/photo-1566737236500-c8ac43014a67?auto=format&fit=crop&w=1800&q=80",
  "Believe Music Hall": "https://images.unsplash.com/photo-1574391884720-bbc7cacb4e85?auto=format&fit=crop&w=1800&q=80",
  "Havana Club": "https://images.unsplash.com/photo-1496024840928-4c417adf211d?auto=format&fit=crop&w=1800&q=80",
  "Johnny's Hideaway": "https://images.unsplash.com/photo-1571266028243-d220c9f72f47?auto=format&fit=crop&w=1800&q=80",
  "Rooftop L.O.A.": "https://images.unsplash.com/photo-1505236858219-8359eb29e329?auto=format&fit=crop&w=1800&q=80",
};

export const venueDefaultHeroImage =
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1800&q=80";

const djPortraits = [
  "https://images.unsplash.com/photo-1521334884684-d80222895322?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1487180144351-b8472da7d491?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1549213783-8284d0336c4f?auto=format&fit=crop&w=900&q=80",
];

const reviewLibrary = [
  {
    author: "Taylor M.",
    rating: 5,
    text: "Sound system was incredible and the crowd energy stayed high all night.",
    when: "2 days ago",
  },
  {
    author: "Ari W.",
    rating: 4,
    text: "Great DJ rotations and fast bar service. Worth arriving before peak.",
    when: "5 days ago",
  },
  {
    author: "Nina P.",
    rating: 5,
    text: "Perfect lighting, great playlist flow, and a premium vibe throughout.",
    when: "1 week ago",
  },
];

export function inferNowPlaying(genres: string[]) {
  const genre = genres[0]?.toLowerCase() ?? "open format";

  if (genre.includes("house")) {
    return "Deep house with afro-house cuts";
  }

  if (genre.includes("latin")) {
    return "Latin club edits and reggaeton";
  }

  if (genre.includes("hip")) {
    return "Hip-hop anthems and trap remixes";
  }

  if (genre.includes("r&b") || genre.includes("soul")) {
    return "R&B slow-burners and dance edits";
  }

  return "Open format crowd favorites";
}

export function inferPeakHours(openUntil: string | null | undefined) {
  if (!openUntil) {
    return "11:30 PM - 1:30 AM";
  }

  if (openUntil.includes("4")) {
    return "12:00 AM - 2:30 AM";
  }

  if (openUntil.includes("3")) {
    return "11:30 PM - 2:00 AM";
  }

  return "10:30 PM - 12:30 AM";
}

export function normalizeAmenities(source: string[]) {
  const map: Record<string, string> = {
    "vip tables": "VIP Tables",
    "bottle service": "Bottle Service",
    "outdoor area": "Outdoor Patio",
    rooftop: "Rooftop",
    hookah: "Hookah",
    food: "Food",
    "dance floor": "Dance Floor",
    "live music": "Live Music",
    "lgbtq+ friendly": "LGBTQ+ Friendly",
    accessibility: "Wheelchair Accessible",
    "wheelchair accessible": "Wheelchair Accessible",
    "coat check": "Coat Check",
  };

  return source
    .map((item) => map[item.trim().toLowerCase()] ?? item)
    .filter((item, index, all) => all.indexOf(item) === index);
}

export function buildDemoReviews(seed: number, vibeScore: number): {
  rating: number;
  totalReviews: number;
  recent: VenueDetailReview[];
} {
  const rating = Math.max(3.8, Math.min(4.9, Math.round((3.4 + vibeScore / 100 + (seed % 7) * 0.03) * 10) / 10));
  const totalReviews = 120 + (seed % 11) * 27;

  const recent = reviewLibrary.map((review, index) => ({
    id: index + 1,
    author: review.author,
    rating: Math.max(4, Math.min(5, review.rating - ((seed + index) % 2))),
    text: review.text,
    when: review.when,
  }));

  return { rating, totalReviews, recent };
}

export function buildFeaturedDjsFromLineup(lineup: string[], fallbackVenueId: number): VenueDetailDj[] {
  return lineup.slice(0, 4).map((name, index) => ({
    id: index + 1,
    name,
    genres:
      index % 3 === 0
        ? ["House", "Afrobeats"]
        : index % 3 === 1
          ? ["Hip Hop", "R&B"]
          : ["EDM", "Open Format"],
    imageUrl: djPortraits[index % djPortraits.length],
    profileHref: `/dj/profile/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || `dj-${fallbackVenueId}-${index + 1}`}`,
  }));
}

export function getSimilarDiscoverVenues(venueId: number, genre: string) {
  const loweredGenre = genre.toLowerCase();

  return discoverVenues
    .filter((venue) => venue.id !== venueId)
    .sort((a, b) => {
      const aMatch = a.genres.some((value) => value.toLowerCase().includes(loweredGenre));
      const bMatch = b.genres.some((value) => value.toLowerCase().includes(loweredGenre));

      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;

      return a.distanceMiles - b.distanceMiles;
    })
    .slice(0, 6);
}
