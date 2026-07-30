export type HomeVenueShowcase = {
  id: number;
  href: string;
  name: string;
  neighborhood: string;
  genre: string;
  crowdLevel: "Mellow" | "Steady" | "Buzzing" | "Packed";
  distance: string;
  isLive: boolean;
  imageUrl: string;
  heroImage: string;
  logoImage: string | null;
  galleryImages: string[];
  thumbnailImage: string;
};

type HomeVenueShowcaseSeed = Omit<
  HomeVenueShowcase,
  "heroImage" | "logoImage" | "galleryImages" | "thumbnailImage"
>;

const homeVenueShowcaseSeeds: HomeVenueShowcaseSeed[] = [
  {
    id: 1,
    href: "/venues/1",
    name: "Tongue & Groove",
    neighborhood: "Midtown",
    genre: "House",
    crowdLevel: "Packed",
    distance: "1.2 mi",
    isLive: true,
    imageUrl:
      "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1400&q=80",
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
    imageUrl:
      "https://images.unsplash.com/photo-1566737236500-c8ac43014a67?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: 3,
    href: "/venues/3",
    name: "Believe Music Hall",
    neighborhood: "Old Fourth Ward",
    genre: "Hip-Hop",
    crowdLevel: "Packed",
    distance: "1.7 mi",
    isLive: true,
    imageUrl:
      "https://images.unsplash.com/photo-1574391884720-bbc7cacb4e85?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: 4,
    href: "/venues/4",
    name: "MJQ Concourse",
    neighborhood: "Poncey-Highland",
    genre: "Open Format",
    crowdLevel: "Steady",
    distance: "2.0 mi",
    isLive: false,
    imageUrl:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: 5,
    href: "/venues/5",
    name: "Havana Club",
    neighborhood: "Buckhead",
    genre: "Latin",
    crowdLevel: "Buzzing",
    distance: "3.6 mi",
    isLive: false,
    imageUrl:
      "https://images.unsplash.com/photo-1496024840928-4c417adf211d?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: 6,
    href: "/venues/6",
    name: "The Ivy",
    neighborhood: "Buckhead",
    genre: "Afrobeat",
    crowdLevel: "Buzzing",
    distance: "3.1 mi",
    isLive: true,
    imageUrl:
      "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: 7,
    href: "/venues/7",
    name: "Johnny's Hideaway",
    neighborhood: "Buckhead",
    genre: "Disco",
    crowdLevel: "Steady",
    distance: "3.4 mi",
    isLive: false,
    imageUrl:
      "https://images.unsplash.com/photo-1571266028243-d220c9f72f47?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: 8,
    href: "/venues/8",
    name: "Rooftop L.O.A.",
    neighborhood: "West Midtown",
    genre: "Tech House",
    crowdLevel: "Packed",
    distance: "2.8 mi",
    isLive: true,
    imageUrl:
      "https://images.unsplash.com/photo-1505236858219-8359eb29e329?auto=format&fit=crop&w=1400&q=80",
  },
];

export const homeVenueShowcase: HomeVenueShowcase[] = homeVenueShowcaseSeeds.map((venue) => ({
  ...venue,
  heroImage: venue.imageUrl,
  logoImage: null,
  galleryImages: [venue.imageUrl],
  thumbnailImage: venue.imageUrl,
}));

export const homeLiveTonightIds = [1, 2, 3, 8];
export const homeTrendingIds = [2, 1, 6, 3];
export const homeRecommendedIds = [4, 7, 5, 6];

export const homeVenuePhotoByName: Record<string, string> = {
  "Tongue & Groove":
    "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1400&q=80",
  "District Atlanta":
    "https://images.unsplash.com/photo-1566737236500-c8ac43014a67?auto=format&fit=crop&w=1400&q=80",
  "Believe Music Hall":
    "https://images.unsplash.com/photo-1574391884720-bbc7cacb4e85?auto=format&fit=crop&w=1400&q=80",
  "MJQ Concourse":
    "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1400&q=80",
  "Havana Club":
    "https://images.unsplash.com/photo-1496024840928-4c417adf211d?auto=format&fit=crop&w=1400&q=80",
  "Johnny's Hideaway":
    "https://images.unsplash.com/photo-1571266028243-d220c9f72f47?auto=format&fit=crop&w=1400&q=80",
  "Rooftop L.O.A.":
    "https://images.unsplash.com/photo-1505236858219-8359eb29e329?auto=format&fit=crop&w=1400&q=80",
};
