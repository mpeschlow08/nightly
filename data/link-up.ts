export type FriendStatus = "going-out" | "at-home" | "looking-for-plans" | "at-a-venue" | "offline";

export type FriendProfile = {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string;
  status: FriendStatus;
  favoriteGenres: string[];
  mutualFriends: number;
};

export type ActiveTonightFriend = {
  id: string;
  friendId: string;
  venue: string;
  arrivedAt: string;
  details: string;
};

export type FriendRequest = {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string;
  mutualFriends: number;
};

export type GroupPlan = {
  id: string;
  groupName: string;
  participantNames: string[];
  selectedVenue: string;
  plannedTime: string;
  rsvpStatus: "Confirmed" | "Pending" | "Mixed";
};

export type UpcomingPlan = {
  id: string;
  title: string;
  venue: string;
  time: string;
  attendeeCount: number;
};

export const statusPresentation: Record<
  FriendStatus,
  {
    label: string;
    indicatorClassName: string;
    badgeClassName: string;
  }
> = {
  "going-out": {
    label: "Going Out",
    indicatorClassName: "bg-fuchsia-400 shadow-[0_0_0_6px_rgba(232,121,249,0.2)]",
    badgeClassName: "border-fuchsia-300/35 bg-fuchsia-500/18 text-fuchsia-100",
  },
  "at-home": {
    label: "At Home",
    indicatorClassName: "bg-indigo-300 shadow-[0_0_0_6px_rgba(165,180,252,0.18)]",
    badgeClassName: "border-indigo-300/35 bg-indigo-500/16 text-indigo-100",
  },
  "looking-for-plans": {
    label: "Looking for Plans",
    indicatorClassName: "bg-violet-300 shadow-[0_0_0_6px_rgba(196,181,253,0.2)]",
    badgeClassName: "border-violet-300/35 bg-violet-500/18 text-violet-100",
  },
  "at-a-venue": {
    label: "At a Venue",
    indicatorClassName: "bg-purple-300 shadow-[0_0_0_6px_rgba(216,180,254,0.2)]",
    badgeClassName: "border-purple-300/35 bg-purple-500/18 text-purple-100",
  },
  offline: {
    label: "Offline",
    indicatorClassName: "bg-zinc-400 shadow-[0_0_0_6px_rgba(161,161,170,0.14)]",
    badgeClassName: "border-zinc-300/25 bg-zinc-700/30 text-zinc-200",
  },
};

export const linkUpFriends: FriendProfile[] = [
  {
    id: "friend-1",
    displayName: "Ari Moon",
    username: "@arimoon",
    avatarUrl:
      "https://images.unsplash.com/photo-1521146764736-56c929d59c83?auto=format&fit=crop&w=240&q=80",
    status: "going-out",
    favoriteGenres: ["Afro House", "Melodic Techno"],
    mutualFriends: 7,
  },
  {
    id: "friend-2",
    displayName: "Kai Rivera",
    username: "@kairivera",
    avatarUrl:
      "https://images.unsplash.com/photo-1521119989659-a83eee488004?auto=format&fit=crop&w=240&q=80",
    status: "at-a-venue",
    favoriteGenres: ["Hip Hop", "Open Format"],
    mutualFriends: 4,
  },
  {
    id: "friend-3",
    displayName: "Mila Frost",
    username: "@milafrost",
    avatarUrl:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=240&q=80",
    status: "looking-for-plans",
    favoriteGenres: ["Disco", "Funk House"],
    mutualFriends: 5,
  },
  {
    id: "friend-4",
    displayName: "Noah Vale",
    username: "@noahvale",
    avatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=240&q=80",
    status: "at-home",
    favoriteGenres: ["Lo-Fi House", "Deep House"],
    mutualFriends: 2,
  },
  {
    id: "friend-5",
    displayName: "Jules Park",
    username: "@julespark",
    avatarUrl:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=240&q=80",
    status: "offline",
    favoriteGenres: ["Drum and Bass", "UK Garage"],
    mutualFriends: 9,
  },
];

export const activeTonight: ActiveTonightFriend[] = [
  {
    id: "active-1",
    friendId: "friend-1",
    venue: "Neon District Rooftop",
    arrivedAt: "9:12 PM",
    details: "On the terrace near the back bar.",
  },
  {
    id: "active-2",
    friendId: "friend-2",
    venue: "Echo Room",
    arrivedAt: "10:01 PM",
    details: "Main floor left side by the booth.",
  },
  {
    id: "active-3",
    friendId: "friend-3",
    venue: "Velvet Signal",
    arrivedAt: "8:46 PM",
    details: "At the lounge deciding next stop.",
  },
];

export const incomingRequests: FriendRequest[] = [
  {
    id: "request-1",
    displayName: "Sage Lin",
    username: "@sagelin",
    avatarUrl:
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=240&q=80",
    mutualFriends: 3,
  },
  {
    id: "request-2",
    displayName: "Ty Monroe",
    username: "@tymonroe",
    avatarUrl:
      "https://images.unsplash.com/photo-1542204625-de293a2f16f1?auto=format&fit=crop&w=240&q=80",
    mutualFriends: 6,
  },
];

export const recentlyAddedFriendIds = ["friend-4", "friend-5"];

export const upcomingPlans: UpcomingPlan[] = [
  {
    id: "upcoming-1",
    title: "Afterparty Warmup",
    venue: "Northlight Loft",
    time: "Fri 11:30 PM",
    attendeeCount: 4,
  },
  {
    id: "upcoming-2",
    title: "Sunset Recovery Set",
    venue: "Harbor Side",
    time: "Sun 6:00 PM",
    attendeeCount: 3,
  },
];

export const groupPlans: GroupPlan[] = [
  {
    id: "group-1",
    groupName: "Friday Pulse Crew",
    participantNames: ["Ari", "Kai", "Mila", "You"],
    selectedVenue: "Neon District Rooftop",
    plannedTime: "Tonight 10:45 PM",
    rsvpStatus: "Mixed",
  },
  {
    id: "group-2",
    groupName: "Warehouse Wanderers",
    participantNames: ["Noah", "Jules", "You"],
    selectedVenue: "Echo Room",
    plannedTime: "Sat 11:15 PM",
    rsvpStatus: "Pending",
  },
];

export const meetHereVenues = [
  "Neon District Rooftop",
  "Echo Room",
  "Velvet Signal",
  "Northlight Loft",
  "Harbor Side",
];

export const meetHereArrivalTimes = [
  "In 15 min",
  "In 30 min",
  "In 45 min",
  "11:00 PM",
  "11:30 PM",
  "12:00 AM",
];

export const privacyModes = [
  "Share Venue Only",
  "Share Approximate Location",
  "Share Exact Location",
  "Invisible Mode",
] as const;

export function getFriendById(friendId: string) {
  return linkUpFriends.find((friend) => friend.id === friendId);
}
