import type { NightlyEvent } from "@/data/events";
import { discoverVenues } from "@/data/nightly";

export type EventLineupProfile = {
  name: string;
  genre: string;
  imageUrl: string;
};

export type EventFriendPulse = {
  interested: string[];
  attending: string[];
};

export const eventHeroFallbackByVenue: Record<string, string> = {
  "Tongue & Groove": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1800&q=80",
  "District Atlanta": "https://images.unsplash.com/photo-1566737236500-c8ac43014a67?auto=format&fit=crop&w=1800&q=80",
  "Believe Music Hall": "https://images.unsplash.com/photo-1574391884720-bbc7cacb4e85?auto=format&fit=crop&w=1800&q=80",
  "Havana Club": "https://images.unsplash.com/photo-1496024840928-4c417adf211d?auto=format&fit=crop&w=1800&q=80",
  "Johnny's Hideaway": "https://images.unsplash.com/photo-1571266028243-d220c9f72f47?auto=format&fit=crop&w=1800&q=80",
  "Rooftop L.O.A.": "https://images.unsplash.com/photo-1505236858219-8359eb29e329?auto=format&fit=crop&w=1800&q=80",
};

export const eventFallbackArtwork =
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1800&q=80";

const lineupPortraits: string[] = [
  "https://images.unsplash.com/photo-1521334884684-d80222895322?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1487180144351-b8472da7d491?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1549213783-8284d0336c4f?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=900&q=80",
];

const friendNames = [
  "Taylor",
  "Jordan",
  "Nia",
  "Marcus",
  "Rae",
  "Avery",
  "Jules",
  "Dev",
  "Kai",
  "Mina",
];

export function getEventArtwork(event: NightlyEvent) {
  const discoverVenue =
    discoverVenues.find((item) => item.slug === event.venueSlug) ??
    discoverVenues.find((item) => item.name.toLowerCase() === event.venueName.toLowerCase()) ??
    null;

  return discoverVenue?.heroImage ?? eventHeroFallbackByVenue[event.venueName] ?? eventFallbackArtwork;
}

export function getEventGallery(event: NightlyEvent) {
  return [
    getEventArtwork(event),
    "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1468818438311-4bab781ab9b8?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?auto=format&fit=crop&w=1400&q=80",
  ];
}

export function getLineupProfiles(event: NightlyEvent): EventLineupProfile[] {
  return event.supportingActs.map((act, index) => ({
    name: act.name,
    genre: event.genres[index % event.genres.length] ?? "Open Format",
    imageUrl: lineupPortraits[index % lineupPortraits.length],
  }));
}

export function getGuestListStatus(event: NightlyEvent) {
  if (event.ticketStatus === "Sold out") {
    return "Waitlist only";
  }

  if (event.ticketStatus === "Almost sold out") {
    return "Limited guest list spots";
  }

  return "Open guest list";
}

export function getFriendPulse(event: NightlyEvent): EventFriendPulse {
  const seed = event.id * 13;

  const interested = Array.from({ length: 5 }, (_, index) => friendNames[(seed + index * 2) % friendNames.length]);
  const attending = Array.from({ length: 3 }, (_, index) => friendNames[(seed + index * 3 + 1) % friendNames.length]);

  return { interested, attending };
}

export function getVenuePreview(event: NightlyEvent) {
  const venue =
    discoverVenues.find((item) => item.slug === event.venueSlug) ??
    discoverVenues.find((item) => item.name.toLowerCase() === event.venueName.toLowerCase()) ??
    null;

  return {
    venueId: venue?.id ?? null,
    imageUrl: venue?.thumbnailImage ?? (venue ? eventHeroFallbackByVenue[venue.name] ?? eventFallbackArtwork : getEventArtwork(event)),
    name: event.venueName,
    neighborhood: event.neighborhood,
    crowdLevel: event.venueCrowdLevel,
    isLive: event.live,
  };
}
