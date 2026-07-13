export const genres = [
  "Hip-Hop",
  "EDM",
  "Latin",
  "Afrobeats",
  "R&B",
  "Live Music",
  "Lounges",
  "Country",
];

export const happeningTonight = [
  {
    id: 1,
    venue: "The Roof at Ponce",
    event: "Midnight Mirage",
    genre: "Hip-Hop",
    time: "9:30 PM",
    cover: "$25",
    distance: "1.2 mi",
    crowd: "Packed",
    badge: "Live",
    imageClass: "from-fuchsia-500/80 via-purple-600/70 to-slate-950",
  },
  {
    id: 2,
    venue: "Luna Lounge",
    event: "Afterglow Sessions",
    genre: "Afrobeats",
    time: "10:00 PM",
    cover: "$20",
    distance: "2.0 mi",
    crowd: "Buzzing",
    badge: "",
    imageClass: "from-cyan-500/80 via-blue-600/70 to-slate-950",
  },
  {
    id: 3,
    venue: "Velvet Room",
    event: "Neon After Dark",
    genre: "EDM",
    time: "11:15 PM",
    cover: "$35",
    distance: "0.8 mi",
    crowd: "Hot",
    badge: "Live",
    imageClass: "from-violet-500/80 via-pink-500/70 to-slate-950",
  },
  {
    id: 4,
    venue: "The Soundbar",
    event: "Satin Sundays",
    genre: "R&B",
    time: "8:45 PM",
    cover: "$18",
    distance: "3.1 mi",
    crowd: "Easy",
    badge: "",
    imageClass: "from-emerald-500/80 via-cyan-500/70 to-slate-950",
  },
];

export const liveVibes = [
  {
    id: 1,
    name: "AURA Atlanta",
    crowd: "High energy",
    genre: "House / Tech",
    wait: "12 min",
    vibeScore: 94,
  },
  {
    id: 2,
    name: "Marlowe",
    crowd: "Lively",
    genre: "Latin Nights",
    wait: "8 min",
    vibeScore: 91,
  },
  {
    id: 3,
    name: "The Eastern",
    crowd: "Steady buzz",
    genre: "Live Jazz",
    wait: "5 min",
    vibeScore: 89,
  },
];

export const popularVenues = [
  {
    id: 1,
    name: "The Roof at Ponce",
    blurb: "Skyline cocktails and late-night sets",
    imageClass: "from-fuchsia-500/85 via-violet-500/70 to-slate-950",
  },
  {
    id: 2,
    name: "Luna Lounge",
    blurb: "Soft lighting and artful house sets",
    imageClass: "from-cyan-500/85 via-blue-600/70 to-slate-950",
  },
  {
    id: 3,
    name: "The Soundbar",
    blurb: "Intimate suppers and velvet dance floors",
    imageClass: "from-pink-500/85 via-purple-600/70 to-slate-950",
  },
];

export type DiscoverVenue = {
  id: number;
  name: string;
  tagline: string;
  genres: string[];
  crowdLevel: string;
  distance: string;
  cover: string;
  hours: string;
  badge: string;
  imageClass: string;
};

export const discoverVenues: DiscoverVenue[] = [
  {
    id: 1,
    name: "The Roof at Ponce",
    tagline: "Skyline cocktails and a velvet dancefloor",
    genres: ["Hip-Hop", "R&B"],
    crowdLevel: "Packed",
    distance: "1.2 mi away",
    cover: "$25",
    hours: "9 PM - 3 AM",
    badge: "Live",
    imageClass: "from-fuchsia-500/85 via-violet-500/70 to-slate-950",
  },
  {
    id: 2,
    name: "Luna Lounge",
    tagline: "Lush lighting and intimate late sets",
    genres: ["Afrobeats", "House"],
    crowdLevel: "Buzzing",
    distance: "2.1 mi away",
    cover: "$20",
    hours: "10 PM - 2 AM",
    badge: "New",
    imageClass: "from-cyan-500/85 via-blue-600/70 to-slate-950",
  },
  {
    id: 3,
    name: "Marlowe",
    tagline: "A polished room for Latin night energy",
    genres: ["Latin", "EDM"],
    crowdLevel: "Hot",
    distance: "0.8 mi away",
    cover: "$30",
    hours: "8 PM - 4 AM",
    badge: "Tonight",
    imageClass: "from-pink-500/85 via-purple-600/70 to-slate-950",
  },
  {
    id: 4,
    name: "The Soundbar",
    tagline: "Soft shadows, warm lights, and deep grooves",
    genres: ["Live Music", "R&B"],
    crowdLevel: "Steady",
    distance: "3.3 mi away",
    cover: "$18",
    hours: "7 PM - 1 AM",
    badge: "Chill",
    imageClass: "from-emerald-500/85 via-cyan-500/70 to-slate-950",
  },
  {
    id: 5,
    name: "AURA Atlanta",
    tagline: "Immersive visuals and high-energy DJs",
    genres: ["EDM", "House"],
    crowdLevel: "High",
    distance: "1.7 mi away",
    cover: "$35",
    hours: "10 PM - 3 AM",
    badge: "Peak",
    imageClass: "from-violet-500/85 via-fuchsia-500/70 to-slate-950",
  },
  {
    id: 6,
    name: "The Eastern",
    tagline: "A cinematic lounge with live performances",
    genres: ["Live Music", "Jazz"],
    crowdLevel: "Easy",
    distance: "4.0 mi away",
    cover: "$22",
    hours: "8 PM - 12 AM",
    badge: "Relaxed",
    imageClass: "from-slate-500/85 via-blue-700/70 to-slate-950",
  },
];
