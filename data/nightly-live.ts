export type LiveVenue = {
  id: number;
  name: string;
  href: string;
  heroImageUrl: string;
  crowdLevel: "Steady" | "Buzzing" | "Packed";
  genre: string;
  estimatedWait: string;
  distance: string;
  cameraName: string;
  cameraLastUpdated: string;
};

export type LiveEvent = {
  id: number;
  title: string;
  venue: string;
  time: string;
  href: string;
  artworkUrl: string;
};

export type LiveDj = {
  id: number;
  name: string;
  genre: string;
  venue: string;
  profileHref: string;
  photoUrl: string;
};

export type LiveActivity = {
  id: number;
  label: string;
  timestamp: string;
  type: "venue-open" | "crowd-up" | "event-start" | "dj-start";
};

export type ComingSoonFeature = {
  id: number;
  title: string;
  summary: string;
  gradientClass: string;
};

export const aiTonightSummary =
  "AI Tonight Summary: Atlanta is buzzing tonight. Midtown clubs are reaching capacity while Buckhead lounges are just getting started.";

export const liveVenues: LiveVenue[] = [
  {
    id: 1,
    name: "Tongue & Groove",
    href: "/venues/1",
    heroImageUrl:
      "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1400&q=80",
    crowdLevel: "Packed",
    genre: "House",
    estimatedWait: "14 min",
    distance: "1.2 mi",
    cameraName: "Main Floor Cam",
    cameraLastUpdated: "10:38 PM",
  },
  {
    id: 2,
    name: "District Atlanta",
    href: "/venues/2",
    heroImageUrl:
      "https://images.unsplash.com/photo-1566737236500-c8ac43014a67?auto=format&fit=crop&w=1400&q=80",
    crowdLevel: "Buzzing",
    genre: "EDM",
    estimatedWait: "8 min",
    distance: "0.9 mi",
    cameraName: "Booth Cam",
    cameraLastUpdated: "10:40 PM",
  },
  {
    id: 3,
    name: "Believe Music Hall",
    href: "/venues/3",
    heroImageUrl:
      "https://images.unsplash.com/photo-1574391884720-bbc7cacb4e85?auto=format&fit=crop&w=1400&q=80",
    crowdLevel: "Packed",
    genre: "Hip Hop",
    estimatedWait: "11 min",
    distance: "1.7 mi",
    cameraName: "Stage Cam",
    cameraLastUpdated: "10:41 PM",
  },
  {
    id: 4,
    name: "Rooftop L.O.A.",
    href: "/venues/8",
    heroImageUrl:
      "https://images.unsplash.com/photo-1505236858219-8359eb29e329?auto=format&fit=crop&w=1400&q=80",
    crowdLevel: "Steady",
    genre: "Open Format",
    estimatedWait: "5 min",
    distance: "2.8 mi",
    cameraName: "Skyline Cam",
    cameraLastUpdated: "10:35 PM",
  },
];

export const trendingNowChips = [
  "EDM",
  "Hip Hop",
  "Afrobeats",
  "Latin",
  "House",
  "Open Late",
  "No Cover",
];

export const liveEventsNow: LiveEvent[] = [
  {
    id: 1,
    title: "Midnight Mirage",
    venue: "Tongue & Groove",
    time: "Now - 2:00 AM",
    href: "/events/midnight-mirage",
    artworkUrl:
      "https://images.unsplash.com/photo-1461784121038-f088ca1e7714?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: 2,
    title: "Apex Night",
    venue: "District Atlanta",
    time: "Now - 3:30 AM",
    href: "/events/apex-night",
    artworkUrl:
      "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: 3,
    title: "Velvet Royale",
    venue: "Believe Music Hall",
    time: "Now - 1:50 AM",
    href: "/events/velvet-royale",
    artworkUrl:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80",
  },
];

export const featuredDjsLive: LiveDj[] = [
  {
    id: 1,
    name: "DJ Sabine",
    genre: "House",
    venue: "Tongue & Groove",
    profileHref: "/dj/profile/dj-sabine",
    photoUrl:
      "https://images.unsplash.com/photo-1521119989659-a83eee488004?auto=format&fit=crop&w=700&q=80",
  },
  {
    id: 2,
    name: "DJ Niko",
    genre: "EDM",
    venue: "District Atlanta",
    profileHref: "/dj/profile/dj-niko",
    photoUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=700&q=80",
  },
  {
    id: 3,
    name: "Mia Cruz",
    genre: "Hip Hop",
    venue: "Believe Music Hall",
    profileHref: "/dj/profile/mia-cruz",
    photoUrl:
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=700&q=80",
  },
];

export const liveActivityFeed: LiveActivity[] = [
  {
    id: 1,
    label: "Venue just opened: Rooftop L.O.A.",
    timestamp: "2m ago",
    type: "venue-open",
  },
  {
    id: 2,
    label: "Crowd increasing at Tongue & Groove",
    timestamp: "5m ago",
    type: "crowd-up",
  },
  {
    id: 3,
    label: "New event started: Midnight Mirage",
    timestamp: "7m ago",
    type: "event-start",
  },
  {
    id: 4,
    label: "DJ Niko just began performing",
    timestamp: "10m ago",
    type: "dj-start",
  },
];

export const recentlyStartedItems = [
  {
    id: 1,
    title: "Main room set opened",
    venue: "District Atlanta",
    startedAt: "Started 8m ago",
  },
  {
    id: 2,
    title: "After-hours lounge unlocked",
    venue: "Tongue & Groove",
    startedAt: "Started 12m ago",
  },
  {
    id: 3,
    title: "Rooftop set kicked off",
    venue: "Rooftop L.O.A.",
    startedAt: "Started 16m ago",
  },
];

export const comingSoonFeatures: ComingSoonFeature[] = [
  {
    id: 1,
    title: "Multi-Camera View",
    summary: "Switch between venue cameras in one synchronized view.",
    gradientClass: "from-fuchsia-500/30 to-violet-500/20",
  },
  {
    id: 2,
    title: "AI Night Recaps",
    summary: "Get personalized recaps of your city's energy and highlights.",
    gradientClass: "from-indigo-500/30 to-fuchsia-500/20",
  },
  {
    id: 3,
    title: "Venue Highlights",
    summary: "See the moments everyone is clipping and sharing in real time.",
    gradientClass: "from-purple-500/30 to-pink-500/20",
  },
  {
    id: 4,
    title: "Live Crowd Analytics",
    summary: "Understand crowd shifts and wait trends before you arrive.",
    gradientClass: "from-violet-500/30 to-cyan-500/20",
  },
];
