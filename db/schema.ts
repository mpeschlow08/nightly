import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", ["consumer", "dj", "owner", "admin"]);
export const venueMemberRoleEnum = pgEnum("venue_member_role", ["owner", "manager"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  role: userRoleEnum("role").notNull().default("consumer"),
  isOnboarded: boolean("is_onboarded").notNull().default(false),
  isVerified: boolean("is_verified").notNull().default(false),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const djProfiles = pgTable("dj_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  stageName: text("stage_name").notNull(),
  username: text("username").notNull().unique(),
  bio: text("bio"),
  city: text("city"),
  profileImageUrl: text("profile_image_url"),
  genres: text("genres").array().notNull().default(sql`ARRAY[]::text[]`),
  yearsPerforming: integer("years_performing"),
  isResidentDj: boolean("is_resident_dj").notNull().default(false),
  residentVenueName: text("resident_venue_name"),
  instagramUrl: text("instagram_url"),
  tiktokUrl: text("tiktok_url"),
  soundcloudUrl: text("soundcloud_url"),
  websiteUrl: text("website_url"),
  bookingEmail: text("booking_email"),
  rateCents: integer("rate_cents"),
  isAvailableForBooking: boolean("is_available_for_booking").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const djSampleMixes = pgTable(
  "dj_sample_mixes",
  {
    id: serial("id").primaryKey(),
    djProfileId: integer("dj_profile_id")
      .notNull()
      .references(() => djProfiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    audioUrl: text("audio_url").notNull(),
    audioFilename: text("audio_filename"),
    durationSeconds: integer("duration_seconds"),
    coverImageUrl: text("cover_image_url"),
    genre: text("genre"),
    isFeatured: boolean("is_featured").notNull().default(false),
    isPublic: boolean("is_public").notNull().default(true),
    playCount: integer("play_count").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    djProfileIdIdx: index("dj_sample_mixes_dj_profile_id_idx").on(table.djProfileId),
  })
);

export const venues = pgTable(
  "venues",
  {
    id: serial("id").primaryKey(),

    name: text("name").notNull(),
    description: text("description"),
    shortDescription: text("short_description"),
    city: text("city"),
    state: text("state"),
    postalCode: text("postal_code"),

    slug: text("slug"),
    neighborhood: text("neighborhood"),
    tagline: text("tagline"),
    googlePlaceId: text("google_place_id"),
    logoUrl: text("logo_url"),
    heroImageUrl: text("hero_image_url"),
    thumbnailImageUrl: text("thumbnail_image_url"),
    imageSource: text("image_source").default("nightly_fallback"),
    galleryImageUrlsJson: text("gallery_image_urls_json"),
    googlePhotoReferencesJson: text("google_photo_references_json"),
    googleCoverPhotoReference: text("google_cover_photo_reference"),
    googleLogoImageUrl: text("google_logo_image_url"),
    officialWebsiteUrl: text("official_website_url"),
    officialWebsiteImageUrl: text("official_website_image_url"),
    officialWebsiteIconUrl: text("official_website_icon_url"),
    officialWebsiteCanonicalUrl: text("official_website_canonical_url"),
    officialWebsiteTitle: text("official_website_title"),
    imagesLastRefreshedAt: timestamp("images_last_refreshed_at"),
    imageRefreshError: text("image_refresh_error"),
    address: text("address"),
    phone: text("phone"),
    websiteUrl: text("website_url"),
    priceLevel: integer("price_level"),
    dressCode: text("dress_code"),
    ageRequirement: integer("age_requirement"),
    openingHoursJson: text("opening_hours_json"),
    timezone: text("timezone").default("America/New_York"),
    venueCategoriesJson: text("venue_categories_json"),
    amenitiesJson: text("amenities_json"),
    parkingInformation: text("parking_information"),
    valetAvailable: boolean("valet_available"),
    coverChargeInformation: text("cover_charge_information"),
    averageRating: real("average_rating"),
    reviewCount: integer("review_count"),
    publicationStatus: text("publication_status").notNull().default("published"),
    verificationStatus: text("verification_status").notNull().default("unverified"),
    isFeatured: boolean("is_featured").notNull().default(false),
    archivedAt: timestamp("archived_at"),
    suspendedAt: timestamp("suspended_at"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    googleMapsUrl: text("google_maps_url"),
    googleImportedAt: timestamp("google_imported_at"),
    googleDataConfirmedByOwnerAt: timestamp("google_data_confirmed_by_owner_at"),

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
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: index("venues_slug_idx").on(table.slug),
    googlePlaceIdIdx: index("venues_google_place_id_idx").on(table.googlePlaceId),
    publicationStatusIdx: index("venues_publication_status_idx").on(table.publicationStatus),
    nameIdx: index("venues_name_idx").on(table.name),
    neighborhoodIdx: index("venues_neighborhood_idx").on(table.neighborhood),
  })
);

export const venueMembers = pgTable(
  "venue_members",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "cascade" }),
    clerkUserId: text("clerk_user_id").notNull(),
    role: venueMemberRoleEnum("role").notNull().default("owner"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdIdx: index("venue_members_venue_id_idx").on(table.venueId),
    clerkUserIdIdx: index("venue_members_clerk_user_id_idx").on(table.clerkUserId),
    venueUserUnique: unique("venue_members_venue_id_clerk_user_id_unique").on(
      table.venueId,
      table.clerkUserId
    ),
  })
);

export const venueImages = pgTable("venue_images", {
  id: serial("id").primaryKey(),
  venueId: integer("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  caption: text("caption"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "cascade" }),
    slug: text("slug"),
    title: text("title").notNull(),
    description: text("description"),
    eventDate: timestamp("event_date").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time"),
    startsAt: timestamp("starts_at").notNull(),
    endsAt: timestamp("ends_at"),
    timezone: text("timezone").default("America/New_York"),
    coverImageUrl: text("cover_image_url"),
    ticketUrl: text("ticket_url"),
    guestListUrl: text("guest_list_url"),
    ticketStatus: text("ticket_status").default("on_sale"),
    coverCents: integer("cover_cents").notNull().default(0),
    ageRequirement: integer("age_requirement"),
    genre: text("genre"),
    genresJson: text("genres_json"),
    dressCode: text("dress_code"),
    isFeatured: boolean("is_featured").notNull().default(false),
    featuredStatus: text("featured_status").notNull().default("none"),
    is21Plus: boolean("is_21_plus").notNull().default(false),
    isPublished: boolean("is_published").notNull().default(false),
    publicationStatus: text("publication_status").notNull().default("draft"),
    isCanceled: boolean("is_canceled").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: index("events_slug_idx").on(table.slug),
    venueIdIdx: index("events_venue_id_idx").on(table.venueId),
    startsAtIdx: index("events_starts_at_idx").on(table.startsAt),
    publicationStatusIdx: index("events_publication_status_idx").on(table.publicationStatus),
  })
);

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

export const venueCameras = pgTable(
  "venue_cameras",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    streamUrl: text("stream_url").notNull(),
    streamType: text("stream_type").notNull(),
    status: text("status").notNull().default("enabled"),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdIdx: index("venue_cameras_venue_id_idx").on(table.venueId),
    isPrimaryIdx: index("venue_cameras_is_primary_idx").on(table.isPrimary),
  })
);
