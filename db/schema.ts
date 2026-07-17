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