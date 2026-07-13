import { discoverVenues } from "@/data/nightly";

export type CrewMember = {
  name: string;
  initials: string;
  accent: string;
};

export type CrewVoteOption = {
  id: string;
  venueName: string;
  votes: number;
  slug: string;
};

export type CrewActivityItem = {
  text: string;
  detail: string;
};

export type Crew = {
  id: number;
  slug: string;
  name: string;
  description: string;
  gradient: string;
  memberCount: number;
  nextNight: string;
  rsvpCount: number;
  recentActivity: string;
  members: CrewMember[];
  inviteLink: string;
  genres: string[];
  upcomingPlan: {
    title: string;
    time: string;
    venue: string;
    note: string;
  };
  voteOptions: CrewVoteOption[];
  activityFeed: CrewActivityItem[];
};

export const crewGenres = ["House", "EDM", "Hip-Hop", "R&B", "Latin", "Afrobeats"];

export const initialCrews: Crew[] = [
  {
    id: 1,
    slug: "weekend-crew",
    name: "Weekend Crew",
    description: "A polished group for Friday energy, late-night bites, and a smooth first stop before the main room.",
    gradient: "from-cyan-500/80 via-sky-500/70 to-violet-500/80",
    memberCount: 7,
    nextNight: "Friday • 10:30 PM",
    rsvpCount: 5,
    recentActivity: "Mia added a new late-night stop nearby.",
    members: [
      { name: "Mia", initials: "MI", accent: "from-cyan-400 to-sky-500" },
      { name: "Rae", initials: "RA", accent: "from-fuchsia-500 to-violet-500" },
      { name: "Jules", initials: "JU", accent: "from-amber-400 to-orange-500" },
    ],
    inviteLink: "https://nightly.app/invite/weekend-crew",
    genres: ["House", "R&B"],
    upcomingPlan: {
      title: "Golden Hour Kickoff",
      time: "10:30 PM",
      venue: "District Atlanta",
      note: "Meet at the front door and head to the main room together.",
    },
    voteOptions: [
      { id: "district", venueName: "District Atlanta", votes: 2, slug: discoverVenues[1].slug },
      { id: "tongue", venueName: "Tongue & Groove", votes: 1, slug: discoverVenues[0].slug },
      { id: "havana", venueName: "Havana Club", votes: 2, slug: discoverVenues[5].slug },
    ],
    activityFeed: [
      { text: "Mia pinned the first stop for the night.", detail: "12 min ago" },
      { text: "Rae voted for Havana Club.", detail: "27 min ago" },
      { text: "Jules shared the group playlist.", detail: "44 min ago" },
    ],
  },
  {
    id: 2,
    slug: "edm-crew",
    name: "EDM Crew",
    description: "A fast-moving crew for bass-heavy sets, immersive rooms, and zero hesitation once the doors open.",
    gradient: "from-fuchsia-500/80 via-violet-500/70 to-indigo-500/80",
    memberCount: 9,
    nextNight: "Saturday • 11:00 PM",
    rsvpCount: 6,
    recentActivity: "Kade added a second venue option for the main room.",
    members: [
      { name: "Kade", initials: "KA", accent: "from-indigo-400 to-violet-500" },
      { name: "Lena", initials: "LE", accent: "from-pink-500 to-rose-500" },
      { name: "Nico", initials: "NI", accent: "from-cyan-400 to-teal-500" },
    ],
    inviteLink: "https://nightly.app/invite/edm-crew",
    genres: ["EDM", "Tech House"],
    upcomingPlan: {
      title: "Main Room Drop",
      time: "11:00 PM",
      venue: "Future Atlanta",
      note: "Arrive early for a front-row spot near the speakers.",
    },
    voteOptions: [
      { id: "future", venueName: "Future Atlanta", votes: 3, slug: discoverVenues[10].slug },
      { id: "cosmo", venueName: "CosmoLava", votes: 2, slug: discoverVenues[7].slug },
      { id: "district", venueName: "District Atlanta", votes: 1, slug: discoverVenues[1].slug },
    ],
    activityFeed: [
      { text: "Lena shared the meetup timing.", detail: "8 min ago" },
      { text: "Nico voted for CosmoLava.", detail: "21 min ago" },
      { text: "Kade queued the after-hours setlist.", detail: "55 min ago" },
    ],
  },
  {
    id: 3,
    slug: "birthday-crew",
    name: "Birthday Crew",
    description: "A celebratory plan for cocktails, a photo-friendly room, and a smooth transition into the late-night set.",
    gradient: "from-pink-500/80 via-rose-500/70 to-amber-500/80",
    memberCount: 11,
    nextNight: "Sunday • 9:15 PM",
    rsvpCount: 8,
    recentActivity: "Tess confirmed the birthday toast and dress code.",
    members: [
      { name: "Tess", initials: "TE", accent: "from-pink-400 to-rose-500" },
      { name: "Ari", initials: "AR", accent: "from-amber-400 to-orange-500" },
      { name: "Nia", initials: "NI", accent: "from-violet-500 to-fuchsia-500" },
    ],
    inviteLink: "https://nightly.app/invite/birthday-crew",
    genres: ["R&B", "House"],
    upcomingPlan: {
      title: "Birthday Toast",
      time: "9:15 PM",
      venue: "Rose Bar",
      note: "Reserve a booth early and keep the night flexible after the first round.",
    },
    voteOptions: [
      { id: "rose", venueName: "Rose Bar", votes: 3, slug: discoverVenues[6].slug },
      { id: "mjq", venueName: "MJQ", votes: 2, slug: discoverVenues[3].slug },
      { id: "tongue", venueName: "Tongue & Groove", votes: 1, slug: discoverVenues[0].slug },
    ],
    activityFeed: [
      { text: "Ari updated the celebration playlist.", detail: "14 min ago" },
      { text: "Nia voted for Rose Bar.", detail: "32 min ago" },
      { text: "Tess confirmed the bottle service plan.", detail: "51 min ago" },
    ],
  },
];

export function getCrewBySlug(slug: string) {
  return initialCrews.find((crew) => crew.slug === slug);
}

export function getCrewSlugs() {
  return initialCrews.map((crew) => ({ slug: crew.slug }));
}
