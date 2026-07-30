import type { NightlyEvent } from "@/data/events";
import type { HomeVenueShowcase } from "@/data/home-nightlife";
import { discoverVenues } from "@/data/nightly";

export type ExploreVenue = HomeVenueShowcase & {
  mapPosition: {
    xPercent: number;
    yPercent: number;
  };
  categories: string[];
};

type ExploreVenueSeed = Omit<
  ExploreVenue,
  "heroImage" | "logoImage" | "galleryImages" | "thumbnailImage"
>;

export type ExploreDj = {
  id: number;
  name: string;
  genres: string[];
  isPerformingTonight: boolean;
  performingAt: string;
  imageUrl: string;
  profileHref: string;
};

export type ExploreNeighborhood = {
  id: number;
  name: string;
  summary: string;
  imageUrl: string;
  href: string;
};

export type ExploreCategory = {
  id: number;
  name: string;
  subtitle: string;
  imageUrl: string;
  href: string;
};

export const exploreQuickFilters = [
  "Live Now",
  "EDM",
  "Hip Hop",
  "Afrobeats",
  "Latin",
  "Rooftop",
  "Lounges",
  "Bars",
  "21+",
  "No Cover",
  "Open Late",
  "Trending",
] as const;

const exploreVenueSeeds: ExploreVenueSeed[] = [
  {
    id: 1,
    href: "/venues/1",
    name: "Tongue & Groove",
    neighborhood: "Midtown",
    genre: "House",
    crowdLevel: "Packed",
    distance: "1.2 mi",
    isLive: true,
    imageUrl: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1400&q=80",
    mapPosition: { xPercent: 54, yPercent: 30 },
    categories: ["Live Now", "House", "21+", "Open Late", "Trending"],
  },
  {
    id: 2,
    href: "/venues/2",
    name: "District Atlanta",
    neighborhood: "Downtown",
    genre: "EDM",
    crowdLevel: "Buzzing",
    distance: "0.9 mi",
    isLive: true,
    imageUrl: "https://images.unsplash.com/photo-1566737236500-c8ac43014a67?auto=format&fit=crop&w=1400&q=80",
    mapPosition: { xPercent: 48, yPercent: 44 },
    categories: ["Live Now", "EDM", "21+", "Trending", "Open Late"],
  },
  {
    id: 3,
    href: "/venues/3",
    name: "Believe Music Hall",
    neighborhood: "Old Fourth Ward",
    genre: "Hip Hop",
    crowdLevel: "Packed",
    distance: "1.7 mi",
    isLive: true,
    imageUrl: "https://images.unsplash.com/photo-1574391884720-bbc7cacb4e85?auto=format&fit=crop&w=1400&q=80",
    mapPosition: { xPercent: 57, yPercent: 40 },
    categories: ["Live Now", "Hip Hop", "Bars", "Open Late", "Trending"],
  },
  {
    id: 4,
    href: "/venues/4",
    name: "Havana Club",
    neighborhood: "Buckhead",
    genre: "Latin",
    crowdLevel: "Buzzing",
    distance: "3.6 mi",
    isLive: false,
    imageUrl: "https://images.unsplash.com/photo-1496024840928-4c417adf211d?auto=format&fit=crop&w=1400&q=80",
    mapPosition: { xPercent: 66, yPercent: 23 },
    categories: ["Latin", "Bars", "21+", "Open Late"],
  },
  {
    id: 5,
    href: "/venues/5",
    name: "Johnny's Hideaway",
    neighborhood: "Buckhead",
    genre: "Disco",
    crowdLevel: "Steady",
    distance: "3.4 mi",
    isLive: false,
    imageUrl: "https://images.unsplash.com/photo-1571266028243-d220c9f72f47?auto=format&fit=crop&w=1400&q=80",
    mapPosition: { xPercent: 69, yPercent: 18 },
    categories: ["Lounges", "Bars", "Open Late", "No Cover"],
  },
  {
    id: 6,
    href: "/venues/6",
    name: "The Ivy",
    neighborhood: "Buckhead",
    genre: "Afrobeats",
    crowdLevel: "Buzzing",
    distance: "3.1 mi",
    isLive: true,
    imageUrl: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1400&q=80",
    mapPosition: { xPercent: 72, yPercent: 27 },
    categories: ["Live Now", "Afrobeats", "Rooftop", "21+", "Trending"],
  },
  {
    id: 7,
    href: "/venues/7",
    name: "Rooftop L.O.A.",
    neighborhood: "West Midtown",
    genre: "Open Format",
    crowdLevel: "Packed",
    distance: "2.8 mi",
    isLive: true,
    imageUrl: "https://images.unsplash.com/photo-1505236858219-8359eb29e329?auto=format&fit=crop&w=1400&q=80",
    mapPosition: { xPercent: 39, yPercent: 31 },
    categories: ["Live Now", "Rooftop", "Lounges", "Open Late", "Trending"],
  },
  {
    id: 8,
    href: "/venues/8",
    name: "Red Phone Booth",
    neighborhood: "Downtown",
    genre: "Lounge",
    crowdLevel: "Steady",
    distance: "1.1 mi",
    isLive: false,
    imageUrl: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1400&q=80",
    mapPosition: { xPercent: 45, yPercent: 50 },
    categories: ["Lounges", "Bars", "21+", "No Cover"],
  },
];

export const exploreVenues: ExploreVenue[] = exploreVenueSeeds.map((venue) => ({
  ...venue,
  heroImage: venue.imageUrl,
  logoImage: null,
  galleryImages: [venue.imageUrl],
  thumbnailImage: venue.imageUrl,
}));

export const exploreFeaturedDjs: ExploreDj[] = [
  {
    id: 1,
    name: "DJ Sabine",
    genres: ["House", "Afrobeats"],
    isPerformingTonight: true,
    performingAt: "Tongue & Groove",
    imageUrl: "https://images.unsplash.com/photo-1521334884684-d80222895322?auto=format&fit=crop&w=900&q=80",
    profileHref: "/dj/profile/dj-sabine",
  },
  {
    id: 2,
    name: "Mia Cruz",
    genres: ["Hip Hop", "R&B"],
    isPerformingTonight: true,
    performingAt: "Believe Music Hall",
    imageUrl: "https://images.unsplash.com/photo-1487180144351-b8472da7d491?auto=format&fit=crop&w=900&q=80",
    profileHref: "/dj/profile/mia-cruz",
  },
  {
    id: 3,
    name: "DJ Niko",
    genres: ["EDM", "Tech House"],
    isPerformingTonight: true,
    performingAt: "District Atlanta",
    imageUrl: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=80",
    profileHref: "/dj/profile/dj-niko",
  },
  {
    id: 4,
    name: "Lena P",
    genres: ["Afrobeats", "Latin"],
    isPerformingTonight: false,
    performingAt: "The Ivy",
    imageUrl: "https://images.unsplash.com/photo-1549213783-8284d0336c4f?auto=format&fit=crop&w=900&q=80",
    profileHref: "/dj/profile/lena-p",
  },
];

export const exploreNeighborhoodCollections: ExploreNeighborhood[] = [
  {
    id: 1,
    name: "Buckhead",
    summary: "12 venues live tonight",
    imageUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1400&q=80",
    href: "/discover?area=buckhead",
  },
  {
    id: 2,
    name: "Midtown",
    summary: "9 venues buzzing after 10 PM",
    imageUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1400&q=80",
    href: "/discover?area=midtown",
  },
  {
    id: 3,
    name: "Old Fourth Ward",
    summary: "7 rooms with live sets",
    imageUrl: "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1400&q=80",
    href: "/discover?area=old-fourth-ward",
  },
  {
    id: 4,
    name: "Downtown",
    summary: "10 venues open late",
    imageUrl: "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=1400&q=80",
    href: "/discover?area=downtown",
  },
  {
    id: 5,
    name: "West Midtown",
    summary: "6 rooftop spots trending",
    imageUrl: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=1400&q=80",
    href: "/discover?area=west-midtown",
  },
];

export const exploreCategories: ExploreCategory[] = [
  {
    id: 1,
    name: "Rooftop Nights",
    subtitle: "Skyline views and open-air DJs",
    imageUrl: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1400&q=80",
    href: "/discover?category=rooftop",
  },
  {
    id: 2,
    name: "No Cover Picks",
    subtitle: "High energy without the fee",
    imageUrl: "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?auto=format&fit=crop&w=1400&q=80",
    href: "/discover?category=no-cover",
  },
  {
    id: 3,
    name: "Open Late",
    subtitle: "Dance floors running to 3 AM+",
    imageUrl: "https://images.unsplash.com/photo-1468818438311-4bab781ab9b8?auto=format&fit=crop&w=1400&q=80",
    href: "/discover?category=open-late",
  },
  {
    id: 4,
    name: "Cocktail Lounges",
    subtitle: "Speakeasy and luxe lounge scenes",
    imageUrl: "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=1400&q=80",
    href: "/discover?category=lounges",
  },
];

export const exploreRecentlyViewedIds = [2, 8, 1, 6];

export const exploreTrendingVenueIds = [7, 1, 2, 3, 6, 4];

export function getExploreEventsNearYou(events: NightlyEvent[]) {
  return events
    .filter((event) => event.dateLabel === "Tonight")
    .slice(0, 6)
    .map((event) => ({
      id: event.id,
      href: `/events/${event.slug}`,
      name: event.name,
      venue: event.venueName,
      neighborhood: event.neighborhood,
      startTime: event.startTime,
      ticketStatus: event.ticketStatus,
      isLive: event.live,
      imageUrl:
        discoverVenues.find((venue) => venue.slug === event.venueSlug)?.thumbnailImage ??
        discoverVenues.find((venue) => venue.name.toLowerCase() === event.venueName.toLowerCase())?.thumbnailImage ??
        "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1400&q=80",
    }));
}
