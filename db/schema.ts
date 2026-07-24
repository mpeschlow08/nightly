import {
  boolean,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const venues = pgTable("venues", {
  id: serial("id").primaryKey(),

  name: text("name").notNull(),
  city: text("city"),

  slug: text("slug"),
  neighborhood: text("neighborhood"),
  tagline: text("tagline"),

  genres: text("genres").array(),

  crowdLevel: text("crowd_level").default("Mellow"),
  distanceMiles: real("distance_miles").default(0),
  cover: integer("cover").default(0),
  vibeScore: integer("vibe_score").default(80),

  isOpenNow: boolean("is_open_now").default(false),
  livePreviewAvailable: boolean("live_preview_available").default(false),
  isLive: boolean("is_live").default(false),

  imageClass: text("image_class").default(
    "from-cyan-500/85 via-blue-600/70 to-slate-950"
  ),

  createdAt: timestamp("created_at").defaultNow(),
});

export const venueImages = pgTable("venue_images", {
  id: serial("id").primaryKey(),
  venueId: integer("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  venueId: integer("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  eventDate: timestamp("event_date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time"),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at"),
  coverCents: integer("cover_cents").notNull().default(0),
  genre: text("genre"),
  dressCode: text("dress_code"),
  isFeatured: boolean("is_featured").notNull().default(false),
  is21Plus: boolean("is_21_plus").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const venueBusinessHours = pgTable("venue_business_hours", {
  id: serial("id").primaryKey(),
  venueId: integer("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(),
  openTime: text("open_time"),
  closeTime: text("close_time"),
  isClosed: boolean("is_closed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});