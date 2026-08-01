import {
  boolean,
  date,
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
export const userAccountStatusEnum = pgEnum("user_account_status", ["active", "suspended", "disabled"]);
export const venueMemberRoleEnum = pgEnum("venue_member_role", ["owner", "manager"]);
export const claimStatusEnum = pgEnum("claim_status", ["pending", "approved", "rejected", "claimed"]);
export const moderationStatusEnum = pgEnum("moderation_status", ["pending", "approved", "rejected"]);
export const eventTypeEnum = pgEnum("event_type", [
  "event",
  "special",
  "guest_list",
  "reservation",
]);
export const eventLifecycleStatusEnum = pgEnum("event_lifecycle_status", [
  "draft",
  "scheduled",
  "published",
  "live",
  "completed",
  "cancelled",
  "archived",
]);

export const ticketProductTypeEnum = pgEnum("ticket_product_type", [
  "free_rsvp",
  "general_admission",
  "early_bird",
  "tiered_admission",
  "vip_admission",
  "backstage_admission",
  "guest_list",
  "promoter_guest_list",
  "venue_comp",
  "staff_comp",
  "table_reservation",
  "bottle_service",
  "private_event_invitation",
  "group_bundle",
  "timed_entry",
  "custom_tier",
  "door_sale",
]);

export const ticketOrderStatusEnum = pgEnum("ticket_order_status", [
  "reserved",
  "pending_payment",
  "completed",
  "cancelled",
  "expired",
  "refund_pending",
  "refunded",
  "disputed",
  "chargeback",
]);

export const ticketStatusEnum = pgEnum("ticket_status", [
  "reserved",
  "pending_payment",
  "issued",
  "active",
  "transferred",
  "transfer_pending",
  "checked_in",
  "partially_checked_in",
  "voided",
  "cancelled",
  "refund_pending",
  "refunded",
  "expired",
  "disputed",
  "chargeback",
  "blocked",
  "replaced",
]);

export const ticketTransferStatusEnum = pgEnum("ticket_transfer_status", [
  "pending",
  "accepted",
  "cancelled",
  "expired",
  "rejected",
]);

export const ticketScanDecisionEnum = pgEnum("ticket_scan_decision", [
  "valid",
  "duplicate",
  "wrong_event",
  "wrong_venue",
  "invalid",
  "blocked",
  "refunded",
  "voided",
  "expired",
  "transfer_pending",
  "already_checked_in",
  "zone_mismatch",
  "insufficient_access",
  "reentry_blocked",
]);

export const guestListEntryStatusEnum = pgEnum("guest_list_entry_status", [
  "invited",
  "requested",
  "approved",
  "waitlisted",
  "denied",
  "checked_in",
  "partially_checked_in",
  "no_show",
  "cancelled",
  "expired",
  "blocked",
]);

export const ticketSalesVisibilityEnum = pgEnum("ticket_sales_visibility", ["public", "private", "invite_only", "hidden"]);

export const ticketRefundStatusEnum = pgEnum("ticket_refund_status", ["requested", "pending", "approved", "rejected", "processed", "failed"]);

export const promoterAssignmentStatusEnum = pgEnum("promoter_assignment_status", ["active", "paused", "revoked", "completed"]);

export const socialVisibilityEnum = pgEnum("social_visibility", ["public", "friends", "close_friends", "private"]);
export const friendRequestStatusEnum = pgEnum("friend_request_status", ["pending", "accepted", "declined", "cancelled", "blocked", "expired"]);
export const friendRelationshipStatusEnum = pgEnum("friend_relationship_status", ["active", "removed", "muted"]);
export const groupVisibilityEnum = pgEnum("social_group_visibility", ["public", "private"]);
export const groupMemberRoleEnum = pgEnum("social_group_member_role", ["host", "cohost", "member"]);
export const groupMemberStatusEnum = pgEnum("social_group_member_status", ["invited", "active", "left", "kicked"]);
export const groupMessageTypeEnum = pgEnum("social_group_message_type", ["text", "image", "gif", "system", "reply", "video", "voice", "thread_reply"]);
export const groupPollStatusEnum = pgEnum("social_group_poll_status", ["open", "closed", "cancelled"]);
export const nightOutStatusEnum = pgEnum("night_out_status", ["active", "ended", "expired"]);
export const nightOutLocationModeEnum = pgEnum("night_out_location_mode", ["venue_only", "approximate", "exact", "invisible"]);
export const presenceStatusEnum = pgEnum("presence_status", ["offline", "online", "idle", "heading_out", "at_venue", "changing_venue", "leaving", "night_over", "hidden"]);
export const meetRequestTypeEnum = pgEnum("meet_request_type", ["meet_here", "im_lost", "find_my_friends", "group_eta", "pinned_meeting_spot", "walking_handoff", "emergency_regroup", "venue_pin"]);
export const meetRequestStatusEnum = pgEnum("meet_request_status", ["pending", "accepted", "declined", "expired", "cancelled"]);
export const socialNotificationStatusEnum = pgEnum("social_notification_status", ["queued", "processing", "sent", "read", "failed", "dismissed"]);
export const socialReportStatusEnum = pgEnum("social_report_status", ["open", "in_review", "resolved", "dismissed"]);
export const socialMessageReceiptStatusEnum = pgEnum("social_message_receipt_status", ["sent", "delivered", "read"]);
export const socialMediaAssetKindEnum = pgEnum("social_media_asset_kind", ["image", "video", "voice", "story", "thumbnail"]);
export const socialMediaModerationStatusEnum = pgEnum("social_media_moderation_status", ["pending", "approved", "rejected"]);
export const socialGroupInviteStatusEnum = pgEnum("social_group_invite_status", ["active", "accepted", "expired", "revoked"]);
export const socialGroupJoinRequestStatusEnum = pgEnum("social_group_join_request_status", ["pending", "approved", "declined", "cancelled"]);
export const socialStoryPostStatusEnum = pgEnum("social_story_post_status", ["active", "expired", "archived"]);

export const bookingLifecycleStatusEnum = pgEnum("booking_lifecycle_status", [
  "draft",
  "requested",
  "pending_review",
  "counter_offered",
  "accepted",
  "deposit_required",
  "deposit_paid",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled_by_consumer",
  "cancelled_by_venue",
  "cancelled_by_dj",
  "expired",
  "refund_pending",
  "refunded",
  "disputed",
  "closed",
]);

export const bookingParticipantRoleEnum = pgEnum("booking_participant_role", [
  "consumer",
  "dj",
  "venue",
  "owner",
  "manager",
  "admin",
  "promoter",
  "system",
]);

export const bookingPaymentStatusEnum = pgEnum("booking_payment_status", [
  "pending",
  "due",
  "authorized",
  "captured",
  "partially_refunded",
  "refunded",
  "failed",
  "voided",
]);

export const bookingContractStatusEnum = pgEnum("booking_contract_status", [
  "draft",
  "sent",
  "accepted",
  "superseded",
  "voided",
]);

export const bookingDisputeStatusEnum = pgEnum("booking_dispute_status", [
  "open",
  "under_review",
  "resolved",
  "closed",
]);

export const bookingCheckinStatusEnum = pgEnum("booking_checkin_status", [
  "pending",
  "checked_in",
  "no_show",
]);

export const bookingAttachmentKindEnum = pgEnum("booking_attachment_kind", [
  "image",
  "document",
  "inspiration",
  "contract",
  "receipt",
]);

export const bookingPricingKindEnum = pgEnum("booking_pricing_kind", [
  "quote",
  "counter_offer",
  "final",
  "refund",
]);

export const bookingDiscountKindEnum = pgEnum("booking_discount_kind", [
  "coupon",
  "manual",
  "promotion",
]);

export const bookingNotificationStatusEnum = pgEnum("booking_notification_status", [
  "queued",
  "processing",
  "sent",
  "failed",
]);

export const bookingReviewSubjectEnum = pgEnum("booking_review_subject", [
  "dj",
  "venue",
  "consumer",
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  role: userRoleEnum("role").notNull().default("consumer"),
  accountStatus: userAccountStatusEnum("account_status").notNull().default("active"),
  requiresReverification: boolean("requires_reverification").notNull().default(false),
  suspendedAt: timestamp("suspended_at"),
  suspendedReason: text("suspended_reason"),
  disabledAt: timestamp("disabled_at"),
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
    googlePlaceResourceName: text("google_place_resource_name"),
    googleBusinessStatus: text("google_business_status"),
    googlePrimaryType: text("google_primary_type"),
    googleTypesJson: text("google_types_json"),
    googleDisplayName: text("google_display_name"),
    googleFormattedAddress: text("google_formatted_address"),
    googleNationalPhoneNumber: text("google_national_phone_number"),
    googleInternationalPhoneNumber: text("google_international_phone_number"),
    googleWebsiteUri: text("google_website_uri"),
    googleMapsUri: text("google_maps_uri"),
    googleRegularOpeningHoursJson: text("google_regular_opening_hours_json"),
    googleCurrentOpeningHoursJson: text("google_current_opening_hours_json"),
    googleUtcOffsetMinutes: integer("google_utc_offset_minutes"),
    googleRating: real("google_rating"),
    googleUserRatingCount: integer("google_user_rating_count"),
    googlePriceLevel: integer("google_price_level"),
    googlePhotosJson: text("google_photos_json"),
    googleAttributionsJson: text("google_attributions_json"),
    googleDataLastFetchedAt: timestamp("google_data_last_fetched_at"),
    googleDataExpiresAt: timestamp("google_data_expires_at"),
    googleRefreshStatus: text("google_refresh_status").notNull().default("never"),
    googleRefreshError: text("google_refresh_error"),
    googleRefreshAttemptedAt: timestamp("google_refresh_attempted_at"),
    googleRefreshVersion: text("google_refresh_version"),
    ownerOverrideFieldsJson: text("owner_override_fields_json").notNull().default("[]"),
    adminOverrideFieldsJson: text("admin_override_fields_json").notNull().default("[]"),
    googleRefreshSuspendedAt: timestamp("google_refresh_suspended_at"),
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
    vipAvailable: boolean("vip_available"),
    bottleServiceAvailable: boolean("bottle_service_available"),
    socialLinksJson: text("social_links_json"),
    contactEmail: text("contact_email"),
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
    googleRefreshStatusIdx: index("venues_google_refresh_status_idx").on(table.googleRefreshStatus),
    googleDataExpiresAtIdx: index("venues_google_data_expires_at_idx").on(table.googleDataExpiresAt),
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

export const venueGooglePhotoMetadata = pgTable(
  "venue_google_photo_metadata",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "cascade" }),
    photoResourceName: text("photo_resource_name").notNull(),
    widthPx: integer("width_px"),
    heightPx: integer("height_px"),
    authorAttributionsJson: text("author_attributions_json").notNull().default("[]"),
    rankingPurpose: text("ranking_purpose"),
    source: text("source").notNull().default("google_places"),
    status: text("status").notNull().default("active"),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    venueIdx: index("venue_google_photo_metadata_venue_id_idx").on(table.venueId),
    venuePhotoUnique: unique("venue_google_photo_metadata_venue_photo_unique").on(
      table.venueId,
      table.photoResourceName
    ),
  })
);

export const venueDataRefreshRuns = pgTable(
  "venue_data_refresh_runs",
  {
    id: serial("id").primaryKey(),
    jobKey: text("job_key").notNull().default("venue_google_data_refresh"),
    trigger: text("trigger").notNull().default("manual"),
    status: text("status").notNull().default("queued"),
    dryRun: boolean("dry_run").notNull().default(false),
    force: boolean("force").notNull().default(false),
    requestedByClerkUserId: text("requested_by_clerk_user_id"),
    correlationId: text("correlation_id"),
    requestEstimateCount: integer("request_estimate_count"),
    selectedVenueCount: integer("selected_venue_count").notNull().default(0),
    processedVenueCount: integer("processed_venue_count").notNull().default(0),
    successCount: integer("success_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    metadataJson: text("metadata_json").notNull().default("{}"),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    jobIdx: index("venue_data_refresh_runs_job_key_idx").on(table.jobKey),
    statusIdx: index("venue_data_refresh_runs_status_idx").on(table.status),
    createdIdx: index("venue_data_refresh_runs_created_at_idx").on(table.createdAt),
  })
);

export const venueDataRefreshItems = pgTable(
  "venue_data_refresh_items",
  {
    id: serial("id").primaryKey(),
    runId: integer("run_id")
      .notNull()
      .references(() => venueDataRefreshRuns.id, { onDelete: "cascade" }),
    venueId: integer("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("queued"),
    requestCount: integer("request_count").notNull().default(0),
    changedFieldsJson: text("changed_fields_json").notNull().default("[]"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    runIdx: index("venue_data_refresh_items_run_id_idx").on(table.runId),
    venueIdx: index("venue_data_refresh_items_venue_id_idx").on(table.venueId),
    statusIdx: index("venue_data_refresh_items_status_idx").on(table.status),
    runVenueUnique: unique("venue_data_refresh_items_run_venue_unique").on(table.runId, table.venueId),
  })
);

export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "cascade" }),
    slug: text("slug"),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    description: text("description"),
    eventDate: timestamp("event_date").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time"),
    startsAt: timestamp("starts_at").notNull(),
    endsAt: timestamp("ends_at"),
    timezone: text("timezone").default("America/New_York"),
    coverImageUrl: text("cover_image_url"),
    galleryImagesJson: text("gallery_images_json"),
    flyerImageUrlsJson: text("flyer_image_urls_json"),
    promoVideoUrlsJson: text("promo_video_urls_json"),
    importedVenueImageUrlsJson: text("imported_venue_image_urls_json"),
    ownerUploadedImageUrlsJson: text("owner_uploaded_image_urls_json"),
    ticketUrl: text("ticket_url"),
    guestListUrl: text("guest_list_url"),
    reservationUrl: text("reservation_url"),
    tableReservationUrl: text("table_reservation_url"),
    vipReservationUrl: text("vip_reservation_url"),
    bottleServiceUrl: text("bottle_service_url"),
    rsvpUrl: text("rsvp_url"),
    requiresTickets: boolean("requires_tickets").notNull().default(false),
    supportsFreeRsvp: boolean("supports_free_rsvp").notNull().default(false),
    ticketSalesStartAt: timestamp("ticket_sales_start_at"),
    ticketSalesEndAt: timestamp("ticket_sales_end_at"),
    ticketSalesVisibility: ticketSalesVisibilityEnum("ticket_sales_visibility").notNull().default("public"),
    reservedCapacity: integer("reserved_capacity").notNull().default(0),
    guestListAllocation: integer("guest_list_allocation").notNull().default(0),
    promoterAllocation: integer("promoter_allocation").notNull().default(0),
    staffCompAllocation: integer("staff_comp_allocation").notNull().default(0),
    walkupAllocation: integer("walkup_allocation").notNull().default(0),
    perOrderQuantityLimit: integer("per_order_quantity_limit").notNull().default(10),
    perUserQuantityLimit: integer("per_user_quantity_limit").notNull().default(10),
    entryWindowMinutes: integer("entry_window_minutes").notNull().default(180),
    lateEntryGraceMinutes: integer("late_entry_grace_minutes").notNull().default(30),
    minimumAge: integer("minimum_age"),
    ticketTransferPolicy: text("ticket_transfer_policy").notNull().default("allowed"),
    refundPolicy: text("refund_policy").notNull().default("standard"),
    reEntryPolicy: text("re_entry_policy").notNull().default("no_reentry"),
    waitlistEnabled: boolean("waitlist_enabled").notNull().default(false),
    inventoryWarningThreshold: integer("inventory_warning_threshold").notNull().default(25),
    taxBehavior: text("tax_behavior").notNull().default("inclusive"),
    feeDisplayBehavior: text("fee_display_behavior").notNull().default("transparent"),
    salesChannelRestrictionsJson: text("sales_channel_restrictions_json"),
    eventType: eventTypeEnum("event_type").notNull().default("event"),
    recurrenceRule: text("recurrence_rule"),
    recurrenceType: text("recurrence_type"),
    recurrenceInterval: integer("recurrence_interval"),
    recurrenceWeekdaysJson: text("recurrence_weekdays_json"),
    recurrenceDayOfMonth: integer("recurrence_day_of_month"),
    recurrenceEndsAt: timestamp("recurrence_ends_at"),
    recurrenceExceptionDatesJson: text("recurrence_exception_dates_json"),
    recurrenceHolidayOverridesJson: text("recurrence_holiday_overrides_json"),
    specialDetails: text("special_details"),
    ticketStatus: text("ticket_status").default("on_sale"),
    coverCents: integer("cover_cents").notNull().default(0),
    ageRequirement: integer("age_requirement"),
    genre: text("genre"),
    genresJson: text("genres_json"),
    dressCode: text("dress_code"),
    capacity: integer("capacity"),
    doorsOpenAt: timestamp("doors_open_at"),
    isFeatured: boolean("is_featured").notNull().default(false),
    featuredStatus: text("featured_status").notNull().default("none"),
    is21Plus: boolean("is_21_plus").notNull().default(false),
    visibility: text("visibility").notNull().default("public"),
    isRecurring: boolean("is_recurring").notNull().default(false),
    lifecycleStatus: eventLifecycleStatusEnum("lifecycle_status").notNull().default("draft"),
    scheduledFor: timestamp("scheduled_for"),
    publishedAt: timestamp("published_at"),
    completedAt: timestamp("completed_at"),
    cancelledAt: timestamp("cancelled_at"),
    archivedAt: timestamp("archived_at"),
    isPublished: boolean("is_published").notNull().default(false),
    publicationStatus: text("publication_status").notNull().default("draft"),
    approvalStatus: moderationStatusEnum("approval_status").notNull().default("approved"),
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
    lifecycleStatusIdx: index("events_lifecycle_status_idx").on(table.lifecycleStatus),
  })
);

export const eventLineup = pgTable(
  "event_lineup",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    djProfileId: integer("dj_profile_id").references(() => djProfiles.id, { onDelete: "set null" }),
    guestDjName: text("guest_dj_name"),
    performanceStartsAt: timestamp("performance_starts_at"),
    performanceEndsAt: timestamp("performance_ends_at"),
    isFeaturedDj: boolean("is_featured_dj").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    eventIdIdx: index("event_lineup_event_id_idx").on(table.eventId),
    djProfileIdIdx: index("event_lineup_dj_profile_id_idx").on(table.djProfileId),
  })
);

export const eventRecurrenceInstances = pgTable(
  "event_recurrence_instances",
  {
    id: serial("id").primaryKey(),
    sourceEventId: integer("source_event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    instanceEventId: integer("instance_event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    occurrenceDate: timestamp("occurrence_date").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    sourceEventIdx: index("event_recurrence_instances_source_event_id_idx").on(table.sourceEventId),
    instanceEventIdx: index("event_recurrence_instances_instance_event_id_idx").on(table.instanceEventId),
    sourceOccurrenceUnique: unique("event_recurrence_instances_source_occurrence_unique").on(
      table.sourceEventId,
      table.occurrenceDate
    ),
  })
);

export const eventModerationFlags = pgTable(
  "event_moderation_flags",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    flaggedByClerkUserId: text("flagged_by_clerk_user_id").notNull(),
    reason: text("reason").notNull(),
    notes: text("notes"),
    status: text("status").notNull().default("open"),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    eventIdIdx: index("event_moderation_flags_event_id_idx").on(table.eventId),
    statusIdx: index("event_moderation_flags_status_idx").on(table.status),
  })
);

export const eventRevisionRequests = pgTable(
  "event_revision_requests",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    requestedByClerkUserId: text("requested_by_clerk_user_id").notNull(),
    notes: text("notes").notNull(),
    status: text("status").notNull().default("open"),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    eventIdIdx: index("event_revision_requests_event_id_idx").on(table.eventId),
    statusIdx: index("event_revision_requests_status_idx").on(table.status),
  })
);

export const eventAnalyticsDaily = pgTable(
  "event_analytics_daily",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    metricDate: timestamp("metric_date").notNull(),
    trafficSource: text("traffic_source").notNull().default("direct"),
    views: integer("views").notNull().default(0),
    favorites: integer("favorites").notNull().default(0),
    shares: integer("shares").notNull().default(0),
    guestListRequests: integer("guest_list_requests").notNull().default(0),
    reservationRequests: integer("reservation_requests").notNull().default(0),
    ticketClicks: integer("ticket_clicks").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    eventDateIdx: index("event_analytics_daily_event_date_idx").on(table.eventId, table.metricDate),
    sourceIdx: index("event_analytics_daily_source_idx").on(table.trafficSource),
    eventDateUnique: unique("event_analytics_daily_event_source_date_unique").on(
      table.eventId,
      table.trafficSource,
      table.metricDate
    ),
  })
);

export const eventNotificationOutbox = pgTable(
  "event_notification_outbox",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    notificationType: text("notification_type").notNull(),
    payloadJson: text("payload_json").notNull(),
    status: text("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    scheduledAt: timestamp("scheduled_at").defaultNow().notNull(),
    sentAt: timestamp("sent_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    eventIdIdx: index("event_notification_outbox_event_id_idx").on(table.eventId),
    statusIdx: index("event_notification_outbox_status_idx").on(table.status),
  })
);

export const ticketProducts = pgTable(
  "ticket_products",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    productType: ticketProductTypeEnum("product_type").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    priceCents: integer("price_cents").notNull().default(0),
    currency: text("currency").notNull().default("USD"),
    quantityTotal: integer("quantity_total").notNull().default(0),
    quantityReserved: integer("quantity_reserved").notNull().default(0),
    quantitySold: integer("quantity_sold").notNull().default(0),
    quantityRefunded: integer("quantity_refunded").notNull().default(0),
    salesStartAt: timestamp("sales_start_at"),
    salesEndAt: timestamp("sales_end_at"),
    minimumQuantity: integer("minimum_quantity").notNull().default(1),
    maximumQuantity: integer("maximum_quantity").notNull().default(10),
    purchaseLimit: integer("purchase_limit").notNull().default(10),
    visibility: ticketSalesVisibilityEnum("visibility").notNull().default("public"),
    sortOrder: integer("sort_order").notNull().default(0),
    accessZone: text("access_zone"),
    entryWindowStartsAt: timestamp("entry_window_starts_at"),
    entryWindowEndsAt: timestamp("entry_window_ends_at"),
    benefitsJson: text("benefits_json"),
    refundability: text("refundability").notNull().default("standard"),
    transferability: text("transferability").notNull().default("allowed"),
    isActive: boolean("is_active").notNull().default(true),
    isHidden: boolean("is_hidden").notNull().default(false),
    soldOutAt: timestamp("sold_out_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    archivedAt: timestamp("archived_at"),
  },
  (table) => ({
    eventIdx: index("ticket_products_event_id_idx").on(table.eventId),
    venueIdx: index("ticket_products_venue_id_idx").on(table.venueId),
    typeIdx: index("ticket_products_product_type_idx").on(table.productType),
    visibilityIdx: index("ticket_products_visibility_idx").on(table.visibility),
    sortIdx: index("ticket_products_sort_order_idx").on(table.sortOrder),
    eventNameUnique: unique("ticket_products_event_name_unique").on(table.eventId, table.name),
  })
);

export const ticketOrders = pgTable(
  "ticket_orders",
  {
    id: serial("id").primaryKey(),
    orderNumber: text("order_number").notNull().unique(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    clerkUserId: text("clerk_user_id").notNull(),
    guestEmail: text("guest_email"),
    status: ticketOrderStatusEnum("status").notNull().default("reserved"),
    currency: text("currency").notNull().default("USD"),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    feeCents: integer("fee_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    promotionCode: text("promotion_code"),
    paymentProvider: text("payment_provider").notNull().default("none"),
    paymentStatus: text("payment_status").notNull().default("pending"),
    paymentIntentId: text("payment_intent_id"),
    checkoutSessionId: text("checkout_session_id"),
    expiresAt: timestamp("expires_at"),
    completedAt: timestamp("completed_at"),
    cancelledAt: timestamp("cancelled_at"),
    refundedAt: timestamp("refunded_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    eventIdx: index("ticket_orders_event_id_idx").on(table.eventId),
    clerkIdx: index("ticket_orders_clerk_user_id_idx").on(table.clerkUserId),
    statusIdx: index("ticket_orders_status_idx").on(table.status),
    expiresIdx: index("ticket_orders_expires_at_idx").on(table.expiresAt),
    eventOrderUnique: unique("ticket_orders_event_order_unique").on(table.eventId, table.orderNumber),
  })
);

export const ticketInventoryHolds = pgTable(
  "ticket_inventory_holds",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull().references(() => ticketProducts.id, { onDelete: "cascade" }),
    orderId: integer("order_id").references(() => ticketOrders.id, { onDelete: "set null" }),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    clerkUserId: text("clerk_user_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    quantity: integer("quantity").notNull().default(1),
    status: text("status").notNull().default("active"),
    expiresAt: timestamp("expires_at").notNull(),
    releasedAt: timestamp("released_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    eventIdx: index("ticket_inventory_holds_event_id_idx").on(table.eventId),
    productIdx: index("ticket_inventory_holds_product_id_idx").on(table.productId),
    clerkIdx: index("ticket_inventory_holds_clerk_user_id_idx").on(table.clerkUserId),
    expiresIdx: index("ticket_inventory_holds_expires_at_idx").on(table.expiresAt),
  })
);

export const ticketOrderItems = pgTable(
  "ticket_order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id").notNull().references(() => ticketOrders.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull().references(() => ticketProducts.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(1),
    unitPriceCents: integer("unit_price_cents").notNull().default(0),
    feeCents: integer("fee_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    accessZone: text("access_zone"),
    holderNameRequired: boolean("holder_name_required").notNull().default(false),
    holderEmailRequired: boolean("holder_email_required").notNull().default(false),
    entryWindowStartsAt: timestamp("entry_window_starts_at"),
    entryWindowEndsAt: timestamp("entry_window_ends_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orderIdx: index("ticket_order_items_order_id_idx").on(table.orderId),
    productIdx: index("ticket_order_items_product_id_idx").on(table.productId),
  })
);

export const tickets = pgTable(
  "tickets",
  {
    id: serial("id").primaryKey(),
    ticketCode: text("ticket_code").notNull().unique(),
    tokenId: text("token_id").notNull().unique(),
    tokenVersion: integer("token_version").notNull().default(1),
    orderId: integer("order_id").notNull().references(() => ticketOrders.id, { onDelete: "cascade" }),
    orderItemId: integer("order_item_id").notNull().references(() => ticketOrderItems.id, { onDelete: "cascade" }),
    eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull().references(() => ticketProducts.id, { onDelete: "restrict" }),
    holderUserId: integer("holder_user_id").references(() => users.id, { onDelete: "set null" }),
    holderClerkUserId: text("holder_clerk_user_id"),
    holderName: text("holder_name"),
    holderEmail: text("holder_email"),
    status: ticketStatusEnum("status").notNull().default("reserved"),
    transferStatus: ticketTransferStatusEnum("transfer_status").notNull().default("pending"),
    accessZone: text("access_zone"),
    entryWindowStartsAt: timestamp("entry_window_starts_at"),
    entryWindowEndsAt: timestamp("entry_window_ends_at"),
    issuedAt: timestamp("issued_at"),
    activatedAt: timestamp("activated_at"),
    checkedInAt: timestamp("checked_in_at"),
    checkedInByClerkUserId: text("checked_in_by_clerk_user_id"),
    partialCheckinCount: integer("partial_checkin_count").notNull().default(0),
    transferPendingAt: timestamp("transfer_pending_at"),
    transferAcceptedAt: timestamp("transfer_accepted_at"),
    voidedAt: timestamp("voided_at"),
    cancelledAt: timestamp("cancelled_at"),
    refundedAt: timestamp("refunded_at"),
    replacedAt: timestamp("replaced_at"),
    replacedByTicketId: integer("replaced_by_ticket_id"),
    originalTicketId: integer("original_ticket_id"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    archivedAt: timestamp("archived_at"),
  },
  (table) => ({
    codeIdx: index("tickets_ticket_code_idx").on(table.ticketCode),
    tokenIdx: index("tickets_token_id_idx").on(table.tokenId),
    eventIdx: index("tickets_event_id_idx").on(table.eventId),
    orderIdx: index("tickets_order_id_idx").on(table.orderId),
    holderIdx: index("tickets_holder_user_id_idx").on(table.holderUserId),
    statusIdx: index("tickets_status_idx").on(table.status),
    transferStatusIdx: index("tickets_transfer_status_idx").on(table.transferStatus),
    codeEventUnique: unique("tickets_code_event_unique").on(table.ticketCode, table.eventId),
  })
);

export const ticketTransfers = pgTable(
  "ticket_transfers",
  {
    id: serial("id").primaryKey(),
    ticketId: integer("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
    senderUserId: integer("sender_user_id").references(() => users.id, { onDelete: "set null" }),
    recipientUserId: integer("recipient_user_id").references(() => users.id, { onDelete: "set null" }),
    recipientEmail: text("recipient_email"),
    status: ticketTransferStatusEnum("status").notNull().default("pending"),
    transferCode: text("transfer_code").notNull().unique(),
    expiresAt: timestamp("expires_at"),
    acceptedAt: timestamp("accepted_at"),
    cancelledAt: timestamp("cancelled_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    ticketIdx: index("ticket_transfers_ticket_id_idx").on(table.ticketId),
    statusIdx: index("ticket_transfers_status_idx").on(table.status),
    recipientIdx: index("ticket_transfers_recipient_email_idx").on(table.recipientEmail),
  })
);

export const ticketScanSessions = pgTable(
  "ticket_scan_sessions",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    doorStaffUserId: integer("door_staff_user_id").references(() => users.id, { onDelete: "set null" }),
    clerkUserId: text("clerk_user_id").notNull(),
    deviceLabel: text("device_label"),
    sessionToken: text("session_token").notNull().unique(),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    endedAt: timestamp("ended_at"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("ticket_scan_sessions_venue_id_idx").on(table.venueId),
    eventIdx: index("ticket_scan_sessions_event_id_idx").on(table.eventId),
    clerkIdx: index("ticket_scan_sessions_clerk_user_id_idx").on(table.clerkUserId),
  })
);

export const ticketScans = pgTable(
  "ticket_scans",
  {
    id: serial("id").primaryKey(),
    ticketId: integer("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
    eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    scanSessionId: integer("scan_session_id").notNull().references(() => ticketScanSessions.id, { onDelete: "cascade" }),
    doorStaffUserId: integer("door_staff_user_id").references(() => users.id, { onDelete: "set null" }),
    clerkUserId: text("clerk_user_id").notNull(),
    scanToken: text("scan_token").notNull().unique(),
    decision: ticketScanDecisionEnum("decision").notNull(),
    reason: text("reason"),
    zone: text("zone"),
    checkedInAt: timestamp("checked_in_at"),
    partialCheckinCount: integer("partial_checkin_count").notNull().default(0),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    scannedAt: timestamp("scanned_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    ticketIdx: index("ticket_scans_ticket_id_idx").on(table.ticketId),
    eventIdx: index("ticket_scans_event_id_idx").on(table.eventId),
    venueIdx: index("ticket_scans_venue_id_idx").on(table.venueId),
    sessionIdx: index("ticket_scans_scan_session_id_idx").on(table.scanSessionId),
    decisionIdx: index("ticket_scans_decision_idx").on(table.decision),
  })
);

export const guestLists = pgTable(
  "guest_lists",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    listType: text("list_type").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    isPublic: boolean("is_public").notNull().default(false),
    approvalRequired: boolean("approval_required").notNull().default(true),
    waitlistEnabled: boolean("waitlist_enabled").notNull().default(true),
    reentryPolicy: text("reentry_policy").notNull().default("no_reentry"),
    cutoffAt: timestamp("cutoff_at"),
    arrivalWindowStartsAt: timestamp("arrival_window_starts_at"),
    arrivalWindowEndsAt: timestamp("arrival_window_ends_at"),
    plusOneLimit: integer("plus_one_limit").notNull().default(0),
    ageRequirement: integer("age_requirement"),
    notes: text("notes"),
    internalNotes: text("internal_notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    archivedAt: timestamp("archived_at"),
  },
  (table) => ({
    eventIdx: index("guest_lists_event_id_idx").on(table.eventId),
    venueIdx: index("guest_lists_venue_id_idx").on(table.venueId),
    typeIdx: index("guest_lists_list_type_idx").on(table.listType),
  })
);

export const guestListEntries = pgTable(
  "guest_list_entries",
  {
    id: serial("id").primaryKey(),
    guestListId: integer("guest_list_id").notNull().references(() => guestLists.id, { onDelete: "cascade" }),
    eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    clerkUserId: text("clerk_user_id"),
    displayName: text("display_name").notNull(),
    email: text("email"),
    status: guestListEntryStatusEnum("status").notNull().default("requested"),
    plusOnesRequested: integer("plus_ones_requested").notNull().default(0),
    plusOnesApproved: integer("plus_ones_approved").notNull().default(0),
    checkedInCount: integer("checked_in_count").notNull().default(0),
    checkedInAt: timestamp("checked_in_at"),
    checkedInByClerkUserId: text("checked_in_by_clerk_user_id"),
    arrivalAt: timestamp("arrival_at"),
    invitedByClerkUserId: text("invited_by_clerk_user_id"),
    notes: text("notes"),
    internalNotes: text("internal_notes"),
    source: text("source").notNull().default("consumer"),
    isPublic: boolean("is_public").notNull().default(false),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    archivedAt: timestamp("archived_at"),
  },
  (table) => ({
    listIdx: index("guest_list_entries_guest_list_id_idx").on(table.guestListId),
    eventIdx: index("guest_list_entries_event_id_idx").on(table.eventId),
    venueIdx: index("guest_list_entries_venue_id_idx").on(table.venueId),
    clerkIdx: index("guest_list_entries_clerk_user_id_idx").on(table.clerkUserId),
    statusIdx: index("guest_list_entries_status_idx").on(table.status),
  })
);

export const ticketWaitlists = pgTable(
  "ticket_waitlists",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => ticketProducts.id, { onDelete: "set null" }),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    clerkUserId: text("clerk_user_id"),
    email: text("email"),
    requestedQuantity: integer("requested_quantity").notNull().default(1),
    status: text("status").notNull().default("waiting"),
    position: integer("position"),
    offerExpiresAt: timestamp("offer_expires_at"),
    offeredAt: timestamp("offered_at"),
    acceptedAt: timestamp("accepted_at"),
    declinedAt: timestamp("declined_at"),
    source: text("source").notNull().default("consumer"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    eventIdx: index("ticket_waitlists_event_id_idx").on(table.eventId),
    venueIdx: index("ticket_waitlists_venue_id_idx").on(table.venueId),
    productIdx: index("ticket_waitlists_product_id_idx").on(table.productId),
    clerkIdx: index("ticket_waitlists_clerk_user_id_idx").on(table.clerkUserId),
    statusIdx: index("ticket_waitlists_status_idx").on(table.status),
  })
);

export const doorStaffAssignments = pgTable(
  "door_staff_assignments",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    clerkUserId: text("clerk_user_id").notNull(),
    permissionJson: text("permission_json"),
    zoneFilterJson: text("zone_filter_json"),
    deviceLabel: text("device_label"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    endedAt: timestamp("ended_at"),
    status: promoterAssignmentStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    eventIdx: index("door_staff_assignments_event_id_idx").on(table.eventId),
    venueIdx: index("door_staff_assignments_venue_id_idx").on(table.venueId),
    clerkIdx: index("door_staff_assignments_clerk_user_id_idx").on(table.clerkUserId),
    statusIdx: index("door_staff_assignments_status_idx").on(table.status),
  })
);

export const promoterProfiles = pgTable(
  "promoter_profiles",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
    clerkUserId: text("clerk_user_id").notNull().unique(),
    displayName: text("display_name").notNull(),
    companyName: text("company_name"),
    email: text("email"),
    phone: text("phone"),
    payoutEmail: text("payout_email"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    clerkIdx: index("promoter_profiles_clerk_user_id_idx").on(table.clerkUserId),
  })
);

export const promoterEventAssignments = pgTable(
  "promoter_event_assignments",
  {
    id: serial("id").primaryKey(),
    promoterProfileId: integer("promoter_profile_id").notNull().references(() => promoterProfiles.id, { onDelete: "cascade" }),
    eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    commissionRateBps: integer("commission_rate_bps").notNull().default(0),
    ticketAllocation: integer("ticket_allocation").notNull().default(0),
    guestListAllocation: integer("guest_list_allocation").notNull().default(0),
    status: promoterAssignmentStatusEnum("status").notNull().default("active"),
    startsAt: timestamp("starts_at"),
    endsAt: timestamp("ends_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    promoterIdx: index("promoter_event_assignments_promoter_profile_id_idx").on(table.promoterProfileId),
    eventIdx: index("promoter_event_assignments_event_id_idx").on(table.eventId),
    venueIdx: index("promoter_event_assignments_venue_id_idx").on(table.venueId),
  })
);

export const ticketRefunds = pgTable(
  "ticket_refunds",
  {
    id: serial("id").primaryKey(),
    ticketId: integer("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
    orderId: integer("order_id").notNull().references(() => ticketOrders.id, { onDelete: "cascade" }),
    eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull().default(0),
    reason: text("reason"),
    providerRefundId: text("provider_refund_id"),
    status: ticketRefundStatusEnum("status").notNull().default("requested"),
    requestedByClerkUserId: text("requested_by_clerk_user_id").notNull(),
    processedByClerkUserId: text("processed_by_clerk_user_id"),
    requestedAt: timestamp("requested_at").defaultNow().notNull(),
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    ticketIdx: index("ticket_refunds_ticket_id_idx").on(table.ticketId),
    orderIdx: index("ticket_refunds_order_id_idx").on(table.orderId),
    eventIdx: index("ticket_refunds_event_id_idx").on(table.eventId),
    statusIdx: index("ticket_refunds_status_idx").on(table.status),
  })
);

export const ticketAuditLog = pgTable(
  "ticket_audit_log",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    ticketId: integer("ticket_id"),
    orderId: integer("order_id").references(() => ticketOrders.id, { onDelete: "set null" }),
    actorClerkUserId: text("actor_clerk_user_id").notNull(),
    actorRole: text("actor_role"),
    action: text("action").notNull(),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    metadataJson: text("metadata_json"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    eventIdx: index("ticket_audit_log_event_id_idx").on(table.eventId),
    ticketIdx: index("ticket_audit_log_ticket_id_idx").on(table.ticketId),
    orderIdx: index("ticket_audit_log_order_id_idx").on(table.orderId),
    actorIdx: index("ticket_audit_log_actor_clerk_user_id_idx").on(table.actorClerkUserId),
    actionIdx: index("ticket_audit_log_action_idx").on(table.action),
  })
);

export const ticketNotifications = pgTable(
  "ticket_notifications",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    ticketId: integer("ticket_id").references(() => tickets.id, { onDelete: "set null" }),
    orderId: integer("order_id").references(() => ticketOrders.id, { onDelete: "set null" }),
    recipientClerkUserId: text("recipient_clerk_user_id"),
    notificationType: text("notification_type").notNull(),
    status: bookingNotificationStatusEnum("status").notNull().default("queued"),
    payloadJson: text("payload_json").notNull(),
    scheduledAt: timestamp("scheduled_at").defaultNow().notNull(),
    sentAt: timestamp("sent_at"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    eventIdx: index("ticket_notifications_event_id_idx").on(table.eventId),
    ticketIdx: index("ticket_notifications_ticket_id_idx").on(table.ticketId),
    orderIdx: index("ticket_notifications_order_id_idx").on(table.orderId),
    statusIdx: index("ticket_notifications_status_idx").on(table.status),
  })
);

export const socialProfiles = pgTable(
  "social_profiles",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
    clerkUserId: text("clerk_user_id").notNull().unique(),
    displayName: text("display_name").notNull(),
    handle: text("handle").notNull().unique(),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    interestsJson: text("interests_json").notNull().default("[]"),
    favoriteGenresJson: text("favorite_genres_json").notNull().default("[]"),
    favoriteVenuesJson: text("favorite_venues_json").notNull().default("[]"),
    favoriteDjsJson: text("favorite_djs_json").notNull().default("[]"),
    favoriteNeighborhoodsJson: text("favorite_neighborhoods_json").notNull().default("[]"),
    nightlifePersonality: text("nightlife_personality"),
    visibility: socialVisibilityEnum("visibility").notNull().default("friends"),
    socialBadgesJson: text("social_badges_json").notNull().default("[]"),
    activityStatsJson: text("activity_stats_json").notNull().default("{}"),
    sharedFriendsCount: integer("shared_friends_count").notNull().default(0),
    friendCode: text("friend_code").notNull().unique(),
    friendQrToken: text("friend_qr_token").notNull().unique(),
    isDiscoverable: boolean("is_discoverable").notNull().default(true),
    isNightOutVisible: boolean("is_night_out_visible").notNull().default(true),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    clerkIdx: index("social_profiles_clerk_user_id_idx").on(table.clerkUserId),
    handleIdx: index("social_profiles_handle_idx").on(table.handle),
    visibilityIdx: index("social_profiles_visibility_idx").on(table.visibility),
  })
);

export const socialPreferences = pgTable(
  "social_preferences",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
    allowFriendRequests: boolean("allow_friend_requests").notNull().default(true),
    allowGroupInvites: boolean("allow_group_invites").notNull().default(true),
    allowMeetRequests: boolean("allow_meet_requests").notNull().default(true),
    showActivityFeed: boolean("show_activity_feed").notNull().default(true),
    showPresence: boolean("show_presence").notNull().default(true),
    shareApproximateLocation: boolean("share_approximate_location").notNull().default(true),
    shareExactLocation: boolean("share_exact_location").notNull().default(false),
    autoExpireNightOut: boolean("auto_expire_night_out").notNull().default(true),
    locationTimeLimitMinutes: integer("location_time_limit_minutes").notNull().default(120),
    favoriteNightlifeDaysJson: text("favorite_nightlife_days_json").notNull().default("[]"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("social_preferences_user_id_idx").on(table.userId),
  })
);

export const privacySettings = pgTable(
  "privacy_settings",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
    profileVisibility: socialVisibilityEnum("profile_visibility").notNull().default("friends"),
    presenceVisibility: socialVisibilityEnum("presence_visibility").notNull().default("friends"),
    activityVisibility: socialVisibilityEnum("activity_visibility").notNull().default("friends"),
    locationVisibility: socialVisibilityEnum("location_visibility").notNull().default("close_friends"),
    allowMutualFriends: boolean("allow_mutual_friends").notNull().default(true),
    allowSearchIndexing: boolean("allow_search_indexing").notNull().default(true),
    allowFriendRequests: boolean("allow_friend_requests").notNull().default(true),
    showSharedFriends: boolean("show_shared_friends").notNull().default(true),
    showSocialBadges: boolean("show_social_badges").notNull().default(true),
    exactLocationShareAllowed: boolean("exact_location_share_allowed").notNull().default(false),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("privacy_settings_user_id_idx").on(table.userId),
    profileVisibilityIdx: index("privacy_settings_profile_visibility_idx").on(table.profileVisibility),
  })
);

export const friends = pgTable(
  "friends",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    friendUserId: integer("friend_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    status: friendRelationshipStatusEnum("status").notNull().default("active"),
    sourceRequestId: integer("source_request_id"),
    connectedAt: timestamp("connected_at").defaultNow().notNull(),
    lastInteractionAt: timestamp("last_interaction_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("friends_user_id_idx").on(table.userId),
    friendIdx: index("friends_friend_user_id_idx").on(table.friendUserId),
    statusIdx: index("friends_status_idx").on(table.status),
    pairUnique: unique("friends_user_friend_unique").on(table.userId, table.friendUserId),
  })
);

export const friendRequests = pgTable(
  "friend_requests",
  {
    id: serial("id").primaryKey(),
    requesterUserId: integer("requester_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    requesterClerkUserId: text("requester_clerk_user_id").notNull(),
    recipientUserId: integer("recipient_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    recipientClerkUserId: text("recipient_clerk_user_id").notNull(),
    message: text("message"),
    inviteCode: text("invite_code"),
    source: text("source").notNull().default("friend_code"),
    status: friendRequestStatusEnum("status").notNull().default("pending"),
    respondedAt: timestamp("responded_at"),
    declinedReason: text("declined_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    requesterIdx: index("friend_requests_requester_user_id_idx").on(table.requesterUserId),
    recipientIdx: index("friend_requests_recipient_user_id_idx").on(table.recipientUserId),
    statusIdx: index("friend_requests_status_idx").on(table.status),
    pairUnique: unique("friend_requests_user_pair_unique").on(table.requesterUserId, table.recipientUserId),
  })
);

export const friendBlocks = pgTable(
  "friend_blocks",
  {
    id: serial("id").primaryKey(),
    blockerUserId: integer("blocker_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    blockedUserId: integer("blocked_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    blockerIdx: index("friend_blocks_blocker_user_id_idx").on(table.blockerUserId),
    blockedIdx: index("friend_blocks_blocked_user_id_idx").on(table.blockedUserId),
    uniquePair: unique("friend_blocks_user_pair_unique").on(table.blockerUserId, table.blockedUserId),
  })
);

export const friendFavorites = pgTable(
  "friend_favorites",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    friendUserId: integer("friend_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    isCloseFriend: boolean("is_close_friend").notNull().default(false),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("friend_favorites_user_id_idx").on(table.userId),
    friendIdx: index("friend_favorites_friend_user_id_idx").on(table.friendUserId),
    pairUnique: unique("friend_favorites_user_pair_unique").on(table.userId, table.friendUserId),
  })
);

export const friendMutes = pgTable(
  "friend_mutes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    friendUserId: integer("friend_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    mutedUntil: timestamp("muted_until"),
    reason: text("reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("friend_mutes_user_id_idx").on(table.userId),
    friendIdx: index("friend_mutes_friend_user_id_idx").on(table.friendUserId),
    pairUnique: unique("friend_mutes_user_pair_unique").on(table.userId, table.friendUserId),
  })
);

export const socialGroups = pgTable(
  "social_groups",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    hostUserId: integer("host_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    hostClerkUserId: text("host_clerk_user_id").notNull(),
    capacity: integer("capacity").notNull().default(8),
    visibility: groupVisibilityEnum("visibility").notNull().default("private"),
    isTemporary: boolean("is_temporary").notNull().default(true),
    isRecurring: boolean("is_recurring").notNull().default(false),
    inviteCode: text("invite_code").notNull().unique(),
    venueId: integer("venue_id").references(() => venues.id, { onDelete: "set null" }),
    eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
    timezone: text("timezone"),
    startsAt: timestamp("starts_at"),
    endsAt: timestamp("ends_at"),
    expiresAt: timestamp("expires_at"),
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    hostIdx: index("social_groups_host_user_id_idx").on(table.hostUserId),
    venueIdx: index("social_groups_venue_id_idx").on(table.venueId),
    eventIdx: index("social_groups_event_id_idx").on(table.eventId),
    visibilityIdx: index("social_groups_visibility_idx").on(table.visibility),
  })
);

export const groupMembers = pgTable(
  "group_members",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id").notNull().references(() => socialGroups.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    clerkUserId: text("clerk_user_id").notNull(),
    role: groupMemberRoleEnum("role").notNull().default("member"),
    status: groupMemberStatusEnum("status").notNull().default("invited"),
    invitedByUserId: integer("invited_by_user_id").references(() => users.id, { onDelete: "set null" }),
    joinedAt: timestamp("joined_at"),
    leftAt: timestamp("left_at"),
    isMuted: boolean("is_muted").notNull().default(false),
    permissionOverridesJson: text("permission_overrides_json").notNull().default("{}"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    groupIdx: index("group_members_group_id_idx").on(table.groupId),
    userIdx: index("group_members_user_id_idx").on(table.userId),
    statusIdx: index("group_members_status_idx").on(table.status),
    uniquePair: unique("group_members_group_user_unique").on(table.groupId, table.userId),
  })
);

export const groupMessages = pgTable(
  "group_messages",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id").notNull().references(() => socialGroups.id, { onDelete: "cascade" }),
    senderUserId: integer("sender_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    senderClerkUserId: text("sender_clerk_user_id").notNull(),
    messageType: groupMessageTypeEnum("message_type").notNull().default("text"),
    body: text("body").notNull(),
    mediaUrl: text("media_url"),
    replyToMessageId: integer("reply_to_message_id"),
    threadRootMessageId: integer("thread_root_message_id"),
    mentionsJson: text("mentions_json").notNull().default("[]"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    reactionsCount: integer("reactions_count").notNull().default(0),
    deliveredCount: integer("delivered_count").notNull().default(0),
    readCount: integer("read_count").notNull().default(0),
    isSystem: boolean("is_system").notNull().default(false),
    editedAt: timestamp("edited_at"),
    deletedAt: timestamp("deleted_at"),
    deletedByUserId: integer("deleted_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    groupIdx: index("group_messages_group_id_idx").on(table.groupId),
    senderIdx: index("group_messages_sender_user_id_idx").on(table.senderUserId),
    createdIdx: index("group_messages_created_at_idx").on(table.createdAt),
  })
);

export const groupMessageReactions = pgTable(
  "group_message_reactions",
  {
    id: serial("id").primaryKey(),
    messageId: integer("message_id").notNull().references(() => groupMessages.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    messageIdx: index("group_message_reactions_message_id_idx").on(table.messageId),
    userIdx: index("group_message_reactions_user_id_idx").on(table.userId),
    uniqueReaction: unique("group_message_reactions_unique").on(table.messageId, table.userId, table.emoji),
  })
);

export const directConversations = pgTable(
  "direct_conversations",
  {
    id: serial("id").primaryKey(),
    userOneId: integer("user_one_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    userTwoId: integer("user_two_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdByUserId: integer("created_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    lastMessageId: integer("last_message_id"),
    lastMessageAt: timestamp("last_message_at"),
    archivedByUserOne: boolean("archived_by_user_one").notNull().default(false),
    archivedByUserTwo: boolean("archived_by_user_two").notNull().default(false),
    deletedByUserOneAt: timestamp("deleted_by_user_one_at"),
    deletedByUserTwoAt: timestamp("deleted_by_user_two_at"),
    mutedByUserOneUntil: timestamp("muted_by_user_one_until"),
    mutedByUserTwoUntil: timestamp("muted_by_user_two_until"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userOneIdx: index("direct_conversations_user_one_id_idx").on(table.userOneId),
    userTwoIdx: index("direct_conversations_user_two_id_idx").on(table.userTwoId),
    lastMessageIdx: index("direct_conversations_last_message_at_idx").on(table.lastMessageAt),
    uniquePair: unique("direct_conversations_user_pair_unique").on(table.userOneId, table.userTwoId),
  })
);

export const directMessages = pgTable(
  "direct_messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id").notNull().references(() => directConversations.id, { onDelete: "cascade" }),
    senderUserId: integer("sender_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    senderClerkUserId: text("sender_clerk_user_id").notNull(),
    messageType: groupMessageTypeEnum("message_type").notNull().default("text"),
    body: text("body").notNull(),
    mediaUrl: text("media_url"),
    replyToMessageId: integer("reply_to_message_id"),
    mentionsJson: text("mentions_json").notNull().default("[]"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    reactionsCount: integer("reactions_count").notNull().default(0),
    editedAt: timestamp("edited_at"),
    deletedAt: timestamp("deleted_at"),
    deletedByUserId: integer("deleted_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    conversationIdx: index("direct_messages_conversation_id_idx").on(table.conversationId),
    senderIdx: index("direct_messages_sender_user_id_idx").on(table.senderUserId),
    createdIdx: index("direct_messages_created_at_idx").on(table.createdAt),
  })
);

export const directMessageReactions = pgTable(
  "direct_message_reactions",
  {
    id: serial("id").primaryKey(),
    messageId: integer("message_id").notNull().references(() => directMessages.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    messageIdx: index("direct_message_reactions_message_id_idx").on(table.messageId),
    userIdx: index("direct_message_reactions_user_id_idx").on(table.userId),
    uniqueReaction: unique("direct_message_reactions_unique").on(table.messageId, table.userId, table.emoji),
  })
);

export const socialMessageReceipts = pgTable(
  "social_message_receipts",
  {
    id: serial("id").primaryKey(),
    groupMessageId: integer("group_message_id").references(() => groupMessages.id, { onDelete: "cascade" }),
    directMessageId: integer("direct_message_id").references(() => directMessages.id, { onDelete: "cascade" }),
    recipientUserId: integer("recipient_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    status: socialMessageReceiptStatusEnum("status").notNull().default("sent"),
    deliveredAt: timestamp("delivered_at"),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    groupMessageIdx: index("social_message_receipts_group_message_id_idx").on(table.groupMessageId),
    directMessageIdx: index("social_message_receipts_direct_message_id_idx").on(table.directMessageId),
    recipientIdx: index("social_message_receipts_recipient_user_id_idx").on(table.recipientUserId),
  })
);

export const socialMessageMentions = pgTable(
  "social_message_mentions",
  {
    id: serial("id").primaryKey(),
    groupMessageId: integer("group_message_id").references(() => groupMessages.id, { onDelete: "cascade" }),
    directMessageId: integer("direct_message_id").references(() => directMessages.id, { onDelete: "cascade" }),
    mentionedUserId: integer("mentioned_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    groupMessageIdx: index("social_message_mentions_group_message_id_idx").on(table.groupMessageId),
    directMessageIdx: index("social_message_mentions_direct_message_id_idx").on(table.directMessageId),
    userIdx: index("social_message_mentions_user_id_idx").on(table.mentionedUserId),
  })
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: serial("id").primaryKey(),
    ownerUserId: integer("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    uploaderUserId: integer("uploader_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    groupId: integer("group_id").references(() => socialGroups.id, { onDelete: "set null" }),
    directConversationId: integer("direct_conversation_id").references(() => directConversations.id, { onDelete: "set null" }),
    kind: socialMediaAssetKindEnum("kind").notNull(),
    moderationStatus: socialMediaModerationStatusEnum("moderation_status").notNull().default("pending"),
    blobUrl: text("blob_url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    width: integer("width"),
    height: integer("height"),
    durationSeconds: integer("duration_seconds"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    ownerIdx: index("media_assets_owner_user_id_idx").on(table.ownerUserId),
    uploaderIdx: index("media_assets_uploader_user_id_idx").on(table.uploaderUserId),
    groupIdx: index("media_assets_group_id_idx").on(table.groupId),
    conversationIdx: index("media_assets_direct_conversation_id_idx").on(table.directConversationId),
    kindIdx: index("media_assets_kind_idx").on(table.kind),
  })
);

export const socialMessageMedia = pgTable(
  "social_message_media",
  {
    id: serial("id").primaryKey(),
    groupMessageId: integer("group_message_id").references(() => groupMessages.id, { onDelete: "cascade" }),
    directMessageId: integer("direct_message_id").references(() => directMessages.id, { onDelete: "cascade" }),
    mediaAssetId: integer("media_asset_id").notNull().references(() => mediaAssets.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    groupMessageIdx: index("social_message_media_group_message_id_idx").on(table.groupMessageId),
    directMessageIdx: index("social_message_media_direct_message_id_idx").on(table.directMessageId),
    mediaIdx: index("social_message_media_media_asset_id_idx").on(table.mediaAssetId),
  })
);

export const groupInvites = pgTable(
  "group_invites",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id").notNull().references(() => socialGroups.id, { onDelete: "cascade" }),
    inviterUserId: integer("inviter_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    inviteeUserId: integer("invitee_user_id").references(() => users.id, { onDelete: "set null" }),
    inviteCode: text("invite_code").notNull().unique(),
    status: socialGroupInviteStatusEnum("status").notNull().default("active"),
    expiresAt: timestamp("expires_at"),
    acceptedAt: timestamp("accepted_at"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    groupIdx: index("group_invites_group_id_idx").on(table.groupId),
    inviterIdx: index("group_invites_inviter_user_id_idx").on(table.inviterUserId),
    inviteeIdx: index("group_invites_invitee_user_id_idx").on(table.inviteeUserId),
    statusIdx: index("group_invites_status_idx").on(table.status),
  })
);

export const groupJoinRequests = pgTable(
  "group_join_requests",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id").notNull().references(() => socialGroups.id, { onDelete: "cascade" }),
    requesterUserId: integer("requester_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    reviewerUserId: integer("reviewer_user_id").references(() => users.id, { onDelete: "set null" }),
    status: socialGroupJoinRequestStatusEnum("status").notNull().default("pending"),
    requestMessage: text("request_message"),
    responseMessage: text("response_message"),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    groupIdx: index("group_join_requests_group_id_idx").on(table.groupId),
    requesterIdx: index("group_join_requests_requester_user_id_idx").on(table.requesterUserId),
    statusIdx: index("group_join_requests_status_idx").on(table.status),
    uniquePair: unique("group_join_requests_group_user_unique").on(table.groupId, table.requesterUserId),
  })
);

export const groupPolls = pgTable(
  "group_polls",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id").notNull().references(() => socialGroups.id, { onDelete: "cascade" }),
    creatorUserId: integer("creator_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    optionsJson: text("options_json").notNull().default("[]"),
    status: groupPollStatusEnum("status").notNull().default("open"),
    allowMultipleVotes: boolean("allow_multiple_votes").notNull().default(false),
    closesAt: timestamp("closes_at"),
    closedAt: timestamp("closed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    groupIdx: index("group_polls_group_id_idx").on(table.groupId),
    statusIdx: index("group_polls_status_idx").on(table.status),
  })
);

export const groupVotes = pgTable(
  "group_votes",
  {
    id: serial("id").primaryKey(),
    pollId: integer("poll_id").notNull().references(() => groupPolls.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    optionLabel: text("option_label").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    pollIdx: index("group_votes_poll_id_idx").on(table.pollId),
    userIdx: index("group_votes_user_id_idx").on(table.userId),
    uniqueVote: unique("group_votes_unique").on(table.pollId, table.userId, table.optionLabel),
  })
);

export const nightOutSessions = pgTable(
  "night_out_sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    groupId: integer("group_id").references(() => socialGroups.id, { onDelete: "set null" }),
    venueId: integer("venue_id").references(() => venues.id, { onDelete: "set null" }),
    status: nightOutStatusEnum("status").notNull().default("active"),
    locationMode: nightOutLocationModeEnum("location_mode").notNull().default("approximate"),
    venueOnlyShare: boolean("venue_only_share").notNull().default(false),
    timeLimitedShare: boolean("time_limited_share").notNull().default(true),
    approximateLocationLabel: text("approximate_location_label"),
    exactLocationJson: text("exact_location_json"),
    currentStopLabel: text("current_stop_label"),
    nextStopLabel: text("next_stop_label"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    endsAt: timestamp("ends_at"),
    expiresAt: timestamp("expires_at"),
    lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("night_out_sessions_user_id_idx").on(table.userId),
    groupIdx: index("night_out_sessions_group_id_idx").on(table.groupId),
    statusIdx: index("night_out_sessions_status_idx").on(table.status),
  })
);

export const presence = pgTable(
  "presence",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
    nightOutSessionId: integer("night_out_session_id").references(() => nightOutSessions.id, { onDelete: "set null" }),
    status: presenceStatusEnum("status").notNull().default("offline"),
    visibility: socialVisibilityEnum("visibility").notNull().default("friends"),
    venueId: integer("venue_id").references(() => venues.id, { onDelete: "set null" }),
    approximateLocationLabel: text("approximate_location_label"),
    exactLocationJson: text("exact_location_json"),
    customStatus: text("custom_status"),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("presence_user_id_idx").on(table.userId),
    statusIdx: index("presence_status_idx").on(table.status),
    visibilityIdx: index("presence_visibility_idx").on(table.visibility),
  })
);

export const presenceHistory = pgTable(
  "presence_history",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    presenceId: integer("presence_id").references(() => presence.id, { onDelete: "set null" }),
    status: presenceStatusEnum("status").notNull(),
    visibility: socialVisibilityEnum("visibility").notNull().default("friends"),
    venueId: integer("venue_id").references(() => venues.id, { onDelete: "set null" }),
    approximateLocationLabel: text("approximate_location_label"),
    customStatus: text("custom_status"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("presence_history_user_id_idx").on(table.userId),
    statusIdx: index("presence_history_status_idx").on(table.status),
    createdIdx: index("presence_history_created_at_idx").on(table.createdAt),
  })
);

export const nightOutPlans = pgTable(
  "night_out_plans",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id").references(() => socialGroups.id, { onDelete: "set null" }),
    creatorUserId: integer("creator_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    budgetLabel: text("budget_label"),
    transportationPlan: text("transportation_plan"),
    ticketCoordinationJson: text("ticket_coordination_json").notNull().default("{}"),
    guestListCoordinationJson: text("guest_list_coordination_json").notNull().default("{}"),
    bottleReservationCoordinationJson: text("bottle_reservation_coordination_json").notNull().default("{}"),
    aiSummary: text("ai_summary"),
    startsAt: timestamp("starts_at"),
    endsAt: timestamp("ends_at"),
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    groupIdx: index("night_out_plans_group_id_idx").on(table.groupId),
    creatorIdx: index("night_out_plans_creator_user_id_idx").on(table.creatorUserId),
    createdIdx: index("night_out_plans_created_at_idx").on(table.createdAt),
  })
);

export const nightOutPlanStops = pgTable(
  "night_out_plan_stops",
  {
    id: serial("id").primaryKey(),
    planId: integer("plan_id").notNull().references(() => nightOutPlans.id, { onDelete: "cascade" }),
    venueId: integer("venue_id").references(() => venues.id, { onDelete: "set null" }),
    eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
    sortOrder: integer("sort_order").notNull().default(0),
    title: text("title").notNull(),
    etaMinutes: integer("eta_minutes"),
    arrivalWindow: text("arrival_window"),
    budgetLabel: text("budget_label"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    planIdx: index("night_out_plan_stops_plan_id_idx").on(table.planId),
    sortIdx: index("night_out_plan_stops_sort_order_idx").on(table.sortOrder),
  })
);

export const nightOutPlanMembers = pgTable(
  "night_out_plan_members",
  {
    id: serial("id").primaryKey(),
    planId: integer("plan_id").notNull().references(() => nightOutPlans.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: groupMemberRoleEnum("role").notNull().default("member"),
    rsvpStatus: text("rsvp_status").notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    planIdx: index("night_out_plan_members_plan_id_idx").on(table.planId),
    userIdx: index("night_out_plan_members_user_id_idx").on(table.userId),
    uniquePair: unique("night_out_plan_members_plan_user_unique").on(table.planId, table.userId),
  })
);

export const meetRequests = pgTable(
  "meet_requests",
  {
    id: serial("id").primaryKey(),
    requesterUserId: integer("requester_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    requesterClerkUserId: text("requester_clerk_user_id").notNull(),
    recipientUserId: integer("recipient_user_id").references(() => users.id, { onDelete: "cascade" }),
    recipientClerkUserId: text("recipient_clerk_user_id"),
    groupId: integer("group_id").references(() => socialGroups.id, { onDelete: "set null" }),
    nightOutSessionId: integer("night_out_session_id").references(() => nightOutSessions.id, { onDelete: "set null" }),
    venueId: integer("venue_id").references(() => venues.id, { onDelete: "set null" }),
    requestType: meetRequestTypeEnum("request_type").notNull(),
    status: meetRequestStatusEnum("status").notNull().default("pending"),
    message: text("message"),
    etaMinutes: integer("eta_minutes"),
    venueLabel: text("venue_label"),
    locationJson: text("location_json"),
    expiresAt: timestamp("expires_at"),
    respondedAt: timestamp("responded_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    requesterIdx: index("meet_requests_requester_user_id_idx").on(table.requesterUserId),
    recipientIdx: index("meet_requests_recipient_user_id_idx").on(table.recipientUserId),
    groupIdx: index("meet_requests_group_id_idx").on(table.groupId),
    statusIdx: index("meet_requests_status_idx").on(table.status),
  })
);

export const socialNotifications = pgTable(
  "social_notifications",
  {
    id: serial("id").primaryKey(),
    recipientUserId: integer("recipient_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    recipientClerkUserId: text("recipient_clerk_user_id").notNull(),
    notificationType: text("notification_type").notNull(),
    status: socialNotificationStatusEnum("status").notNull().default("queued"),
    payloadJson: text("payload_json").notNull(),
    scheduledAt: timestamp("scheduled_at").defaultNow().notNull(),
    sentAt: timestamp("sent_at"),
    readAt: timestamp("read_at"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    recipientIdx: index("social_notifications_recipient_user_id_idx").on(table.recipientUserId),
    statusIdx: index("social_notifications_status_idx").on(table.status),
    typeIdx: index("social_notifications_notification_type_idx").on(table.notificationType),
  })
);

export const activityFeed = pgTable(
  "activity_feed",
  {
    id: serial("id").primaryKey(),
    actorUserId: integer("actor_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    actorClerkUserId: text("actor_clerk_user_id").notNull(),
    activityType: text("activity_type").notNull(),
    visibility: socialVisibilityEnum("visibility").notNull().default("friends"),
    payloadJson: text("payload_json").notNull(),
    venueId: integer("venue_id").references(() => venues.id, { onDelete: "set null" }),
    eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
    groupId: integer("group_id").references(() => socialGroups.id, { onDelete: "set null" }),
    ticketId: integer("ticket_id"),
    bookingId: integer("booking_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    actorIdx: index("activity_feed_actor_user_id_idx").on(table.actorUserId),
    typeIdx: index("activity_feed_activity_type_idx").on(table.activityType),
    createdIdx: index("activity_feed_created_at_idx").on(table.createdAt),
    visibilityIdx: index("activity_feed_visibility_idx").on(table.visibility),
  })
);

export const socialReports = pgTable(
  "social_reports",
  {
    id: serial("id").primaryKey(),
    reporterUserId: integer("reporter_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    reporterClerkUserId: text("reporter_clerk_user_id").notNull(),
    reportedUserId: integer("reported_user_id").references(() => users.id, { onDelete: "set null" }),
    reportedGroupId: integer("reported_group_id").references(() => socialGroups.id, { onDelete: "set null" }),
    reportedMessageId: integer("reported_message_id").references(() => groupMessages.id, { onDelete: "set null" }),
    reportType: text("report_type").notNull(),
    reason: text("reason").notNull(),
    status: socialReportStatusEnum("status").notNull().default("open"),
    notes: text("notes"),
    reviewedByClerkUserId: text("reviewed_by_clerk_user_id"),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    reporterIdx: index("social_reports_reporter_user_id_idx").on(table.reporterUserId),
    reportedUserIdx: index("social_reports_reported_user_id_idx").on(table.reportedUserId),
    statusIdx: index("social_reports_status_idx").on(table.status),
  })
);

export const storyPosts = pgTable(
  "story_posts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    mediaAssetId: integer("media_asset_id").notNull().references(() => mediaAssets.id, { onDelete: "cascade" }),
    status: socialStoryPostStatusEnum("status").notNull().default("active"),
    caption: text("caption"),
    visibility: socialVisibilityEnum("visibility").notNull().default("friends"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("story_posts_user_id_idx").on(table.userId),
    statusIdx: index("story_posts_status_idx").on(table.status),
    expiresIdx: index("story_posts_expires_at_idx").on(table.expiresAt),
  })
);

export const storyViews = pgTable(
  "story_views",
  {
    id: serial("id").primaryKey(),
    storyPostId: integer("story_post_id").notNull().references(() => storyPosts.id, { onDelete: "cascade" }),
    viewerUserId: integer("viewer_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at").defaultNow().notNull(),
  },
  (table) => ({
    storyIdx: index("story_views_story_post_id_idx").on(table.storyPostId),
    viewerIdx: index("story_views_viewer_user_id_idx").on(table.viewerUserId),
    uniqueView: unique("story_views_story_viewer_unique").on(table.storyPostId, table.viewerUserId),
  })
);

export const venueClaimRequests = pgTable(
  "venue_claim_requests",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").references(() => venues.id, { onDelete: "set null" }),
    claimantClerkUserId: text("claimant_clerk_user_id").notNull(),
    claimantRole: text("claimant_role").notNull().default("owner"),
    businessEmail: text("business_email").notNull(),
    businessPhone: text("business_phone").notNull(),
    websiteUrl: text("website_url"),
    notes: text("notes"),
    venueName: text("venue_name").notNull(),
    venueAddress: text("venue_address").notNull(),
    venueCategory: text("venue_category"),
    googlePlaceId: text("google_place_id"),
    status: claimStatusEnum("status").notNull().default("pending"),
    adminNotes: text("admin_notes"),
    reviewedByClerkUserId: text("reviewed_by_clerk_user_id"),
    reviewedAt: timestamp("reviewed_at"),
    claimedAt: timestamp("claimed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdIdx: index("venue_claim_requests_venue_id_idx").on(table.venueId),
    claimantIdx: index("venue_claim_requests_claimant_idx").on(table.claimantClerkUserId),
    statusIdx: index("venue_claim_requests_status_idx").on(table.status),
    googlePlaceIdIdx: index("venue_claim_requests_google_place_id_idx").on(table.googlePlaceId),
  })
);

export const venueProfileChangeRequests = pgTable(
  "venue_profile_change_requests",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "cascade" }),
    submittedByClerkUserId: text("submitted_by_clerk_user_id").notNull(),
    previousValuesJson: text("previous_values_json").notNull(),
    proposedValuesJson: text("proposed_values_json").notNull(),
    status: moderationStatusEnum("status").notNull().default("pending"),
    reviewNotes: text("review_notes"),
    reviewedByClerkUserId: text("reviewed_by_clerk_user_id"),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdIdx: index("venue_profile_change_requests_venue_id_idx").on(table.venueId),
    statusIdx: index("venue_profile_change_requests_status_idx").on(table.status),
    submittedByIdx: index("venue_profile_change_requests_submitted_by_idx").on(table.submittedByClerkUserId),
  })
);

export const venuePublishHistory = pgTable(
  "venue_publish_history",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "cascade" }),
    actorClerkUserId: text("actor_clerk_user_id").notNull(),
    action: text("action").notNull(),
    previousStatus: text("previous_status"),
    nextStatus: text("next_status"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdIdx: index("venue_publish_history_venue_id_idx").on(table.venueId),
    actionIdx: index("venue_publish_history_action_idx").on(table.action),
  })
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    actorClerkUserId: text("actor_clerk_user_id").notNull(),
    actorRole: text("actor_role"),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    previousValuesJson: text("previous_values_json"),
    nextValuesJson: text("next_values_json"),
    metadataJson: text("metadata_json"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    entityIdx: index("audit_logs_entity_idx").on(table.entityType, table.entityId),
    actorIdx: index("audit_logs_actor_idx").on(table.actorClerkUserId),
    actionIdx: index("audit_logs_action_idx").on(table.action),
  })
);

export const bookings = pgTable(
  "bookings",
  {
    id: serial("id").primaryKey(),
    bookingNumber: text("booking_number").notNull().unique(),
    bookingType: text("booking_type").notNull(),
    lifecycleStatus: bookingLifecycleStatusEnum("lifecycle_status").notNull().default("draft"),
    requesterClerkUserId: text("requester_clerk_user_id").notNull(),
    consumerClerkUserId: text("consumer_clerk_user_id").notNull(),
    djProfileId: integer("dj_profile_id").references(() => djProfiles.id, { onDelete: "set null" }),
    venueId: integer("venue_id").references(() => venues.id, { onDelete: "set null" }),
    city: text("city"),
    timezone: text("timezone").notNull().default("America/New_York"),
    requestedForAt: timestamp("requested_for_at"),
    requestedStartAt: timestamp("requested_start_at"),
    requestedEndAt: timestamp("requested_end_at"),
    durationMinutes: integer("duration_minutes"),
    guestCount: integer("guest_count").notNull().default(0),
    budgetCents: integer("budget_cents").notNull().default(0),
    currency: text("currency").notNull().default("USD"),
    notes: text("notes"),
    inspirationText: text("inspiration_text"),
    specialRequests: text("special_requests"),
    source: text("source").notNull().default("consumer_portal"),
    depositRequiredCents: integer("deposit_required_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    platformFeeCents: integer("platform_fee_cents").notNull().default(0),
    payoutCents: integer("payout_cents").notNull().default(0),
    counterOfferAmountCents: integer("counter_offer_amount_cents"),
    counterOfferStartAt: timestamp("counter_offer_start_at"),
    counterOfferEndAt: timestamp("counter_offer_end_at"),
    counterOfferDurationMinutes: integer("counter_offer_duration_minutes"),
    counterOfferPackage: text("counter_offer_package"),
    counterOfferDepositCents: integer("counter_offer_deposit_cents"),
    counterOfferRequirementsJson: text("counter_offer_requirements_json"),
    counterOfferExpiresAt: timestamp("counter_offer_expires_at"),
    draftAt: timestamp("draft_at"),
    requestedAt: timestamp("requested_at"),
    pendingReviewAt: timestamp("pending_review_at"),
    counterOfferedAt: timestamp("counter_offered_at"),
    acceptedAt: timestamp("accepted_at"),
    depositRequiredAt: timestamp("deposit_required_at"),
    depositPaidAt: timestamp("deposit_paid_at"),
    confirmedAt: timestamp("confirmed_at"),
    checkedInAt: timestamp("checked_in_at"),
    completedAt: timestamp("completed_at"),
    cancelledAt: timestamp("cancelled_at"),
    expiredAt: timestamp("expired_at"),
    refundPendingAt: timestamp("refund_pending_at"),
    refundedAt: timestamp("refunded_at"),
    disputedAt: timestamp("disputed_at"),
    closedAt: timestamp("closed_at"),
    cancellationReason: text("cancellation_reason"),
    refundReason: text("refund_reason"),
    disputeReason: text("dispute_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingNumberIdx: index("bookings_booking_number_idx").on(table.bookingNumber),
    lifecycleStatusIdx: index("bookings_lifecycle_status_idx").on(table.lifecycleStatus),
    requesterIdx: index("bookings_requester_clerk_user_id_idx").on(table.requesterClerkUserId),
    consumerIdx: index("bookings_consumer_clerk_user_id_idx").on(table.consumerClerkUserId),
    djProfileIdx: index("bookings_dj_profile_id_idx").on(table.djProfileId),
    venueIdx: index("bookings_venue_id_idx").on(table.venueId),
    requestedForIdx: index("bookings_requested_for_at_idx").on(table.requestedForAt),
    createdAtIdx: index("bookings_created_at_idx").on(table.createdAt),
  })
);

export const bookingStatusHistory = pgTable(
  "booking_status_history",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    fromStatus: bookingLifecycleStatusEnum("from_status"),
    toStatus: bookingLifecycleStatusEnum("to_status").notNull(),
    actorClerkUserId: text("actor_clerk_user_id").notNull(),
    actorRole: text("actor_role"),
    note: text("note"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingIdx: index("booking_status_history_booking_id_idx").on(table.bookingId),
    toStatusIdx: index("booking_status_history_to_status_idx").on(table.toStatus),
    createdAtIdx: index("booking_status_history_created_at_idx").on(table.createdAt),
  })
);

export const bookingMessages = pgTable(
  "booking_messages",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    senderRole: bookingParticipantRoleEnum("sender_role").notNull(),
    senderClerkUserId: text("sender_clerk_user_id").notNull(),
    messageType: text("message_type").notNull().default("message"),
    body: text("body").notNull(),
    isSystem: boolean("is_system").notNull().default(false),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingIdx: index("booking_messages_booking_id_idx").on(table.bookingId),
    senderIdx: index("booking_messages_sender_clerk_user_id_idx").on(table.senderClerkUserId),
    createdAtIdx: index("booking_messages_created_at_idx").on(table.createdAt),
  })
);

export const bookingAttachments = pgTable(
  "booking_attachments",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    messageId: integer("message_id").references(() => bookingMessages.id, { onDelete: "set null" }),
    attachmentKind: bookingAttachmentKindEnum("attachment_kind").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type"),
    fileUrl: text("file_url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    uploadedByClerkUserId: text("uploaded_by_clerk_user_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingIdx: index("booking_attachments_booking_id_idx").on(table.bookingId),
    messageIdx: index("booking_attachments_message_id_idx").on(table.messageId),
  })
);

export const bookingParticipants = pgTable(
  "booking_participants",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    participantRole: bookingParticipantRoleEnum("participant_role").notNull(),
    clerkUserId: text("clerk_user_id").notNull(),
    djProfileId: integer("dj_profile_id").references(() => djProfiles.id, { onDelete: "set null" }),
    venueId: integer("venue_id").references(() => venues.id, { onDelete: "set null" }),
    displayName: text("display_name").notNull(),
    email: text("email"),
    isPrimary: boolean("is_primary").notNull().default(false),
    responseStatus: text("response_status").notNull().default("invited"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingIdx: index("booking_participants_booking_id_idx").on(table.bookingId),
    clerkIdx: index("booking_participants_clerk_user_id_idx").on(table.clerkUserId),
    roleIdx: index("booking_participants_participant_role_idx").on(table.participantRole),
    bookingRoleUnique: unique("booking_participants_booking_role_clerk_unique").on(
      table.bookingId,
      table.participantRole,
      table.clerkUserId
    ),
  })
);

export const bookingRequirements = pgTable(
  "booking_requirements",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    requirementType: text("requirement_type").notNull(),
    title: text("title").notNull(),
    details: text("details"),
    isRequired: boolean("is_required").notNull().default(true),
    isMet: boolean("is_met").notNull().default(false),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingIdx: index("booking_requirements_booking_id_idx").on(table.bookingId),
    statusIdx: index("booking_requirements_status_idx").on(table.status),
  })
);

export const bookingPricing = pgTable(
  "booking_pricing",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    pricingKind: bookingPricingKindEnum("pricing_kind").notNull().default("quote"),
    quoteVersion: integer("quote_version").notNull().default(1),
    baseAmountCents: integer("base_amount_cents").notNull().default(0),
    depositAmountCents: integer("deposit_amount_cents").notNull().default(0),
    serviceFeeCents: integer("service_fee_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    platformFeeCents: integer("platform_fee_cents").notNull().default(0),
    travelFeeCents: integer("travel_fee_cents").notNull().default(0),
    surgeFeeCents: integer("surge_fee_cents").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    totalAmountCents: integer("total_amount_cents").notNull().default(0),
    currency: text("currency").notNull().default("USD"),
    quoteExpiresAt: timestamp("quote_expires_at"),
    quoteNotes: text("quote_notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingIdx: index("booking_pricing_booking_id_idx").on(table.bookingId),
    kindIdx: index("booking_pricing_pricing_kind_idx").on(table.pricingKind),
    uniqueVersion: unique("booking_pricing_booking_quote_version_unique").on(
      table.bookingId,
      table.quoteVersion
    ),
  })
);

export const bookingDiscounts = pgTable(
  "booking_discounts",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    discountCode: text("discount_code").notNull(),
    discountKind: bookingDiscountKindEnum("discount_kind").notNull().default("coupon"),
    percentOff: real("percent_off"),
    amountOffCents: integer("amount_off_cents"),
    description: text("description"),
    startsAt: timestamp("starts_at"),
    endsAt: timestamp("ends_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingIdx: index("booking_discounts_booking_id_idx").on(table.bookingId),
    codeIdx: index("booking_discounts_discount_code_idx").on(table.discountCode),
  })
);

export const bookingCouponUsage = pgTable(
  "booking_coupon_usage",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    discountId: integer("discount_id").references(() => bookingDiscounts.id, { onDelete: "set null" }),
    couponCode: text("coupon_code").notNull(),
    discountKind: bookingDiscountKindEnum("discount_kind").notNull().default("coupon"),
    discountCents: integer("discount_cents").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingIdx: index("booking_coupon_usage_booking_id_idx").on(table.bookingId),
    couponIdx: index("booking_coupon_usage_coupon_code_idx").on(table.couponCode),
  })
);

export const bookingContracts = pgTable(
  "booking_contracts",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" })
      .unique(),
    versionNumber: integer("version_number").notNull().default(1),
    status: bookingContractStatusEnum("status").notNull().default("draft"),
    title: text("title").notNull().default("Booking Contract"),
    termsJson: text("terms_json").notNull(),
    acceptanceJson: text("acceptance_json"),
    signatureHash: text("signature_hash"),
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
    sentAt: timestamp("sent_at"),
    acceptedAt: timestamp("accepted_at"),
    signedAt: timestamp("signed_at"),
    cancelledAt: timestamp("cancelled_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingIdx: index("booking_contracts_booking_id_idx").on(table.bookingId),
    statusIdx: index("booking_contracts_status_idx").on(table.status),
  })
);

export const bookingContractVersions = pgTable(
  "booking_contract_versions",
  {
    id: serial("id").primaryKey(),
    bookingContractId: integer("booking_contract_id")
      .notNull()
      .references(() => bookingContracts.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    contentJson: text("content_json").notNull(),
    createdByClerkUserId: text("created_by_clerk_user_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    contractIdx: index("booking_contract_versions_booking_contract_id_idx").on(table.bookingContractId),
    uniqueVersion: unique("booking_contract_versions_contract_version_unique").on(
      table.bookingContractId,
      table.versionNumber
    ),
  })
);

export const bookingPayments = pgTable(
  "booking_payments",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("stripe"),
    providerPaymentIntentId: text("provider_payment_intent_id"),
    providerChargeId: text("provider_charge_id"),
    providerInvoiceId: text("provider_invoice_id"),
    providerReceiptUrl: text("provider_receipt_url"),
    status: bookingPaymentStatusEnum("status").notNull().default("pending"),
    amountCents: integer("amount_cents").notNull().default(0),
    currency: text("currency").notNull().default("USD"),
    platformFeeCents: integer("platform_fee_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    payoutCents: integer("payout_cents").notNull().default(0),
    paymentMethod: text("payment_method"),
    dueAt: timestamp("due_at"),
    paidAt: timestamp("paid_at"),
    refundedAt: timestamp("refunded_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingIdx: index("booking_payments_booking_id_idx").on(table.bookingId),
    statusIdx: index("booking_payments_status_idx").on(table.status),
    intentIdx: index("booking_payments_provider_payment_intent_id_idx").on(table.providerPaymentIntentId),
  })
);

export const bookingRefunds = pgTable(
  "booking_refunds",
  {
    id: serial("id").primaryKey(),
    bookingPaymentId: integer("booking_payment_id")
      .notNull()
      .references(() => bookingPayments.id, { onDelete: "cascade" }),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    providerRefundId: text("provider_refund_id"),
    status: text("status").notNull().default("pending"),
    amountCents: integer("amount_cents").notNull().default(0),
    reason: text("reason"),
    requestedByClerkUserId: text("requested_by_clerk_user_id").notNull(),
    processedByClerkUserId: text("processed_by_clerk_user_id"),
    requestedAt: timestamp("requested_at").defaultNow().notNull(),
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingIdx: index("booking_refunds_booking_id_idx").on(table.bookingId),
    paymentIdx: index("booking_refunds_booking_payment_id_idx").on(table.bookingPaymentId),
    statusIdx: index("booking_refunds_status_idx").on(table.status),
  })
);

export const bookingDisputes = pgTable(
  "booking_disputes",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    openedByClerkUserId: text("opened_by_clerk_user_id").notNull(),
    subject: text("subject").notNull(),
    reason: text("reason").notNull(),
    status: bookingDisputeStatusEnum("status").notNull().default("open"),
    adminNotes: text("admin_notes"),
    resolvedByClerkUserId: text("resolved_by_clerk_user_id"),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingIdx: index("booking_disputes_booking_id_idx").on(table.bookingId),
    statusIdx: index("booking_disputes_status_idx").on(table.status),
    openerIdx: index("booking_disputes_opened_by_clerk_user_id_idx").on(table.openedByClerkUserId),
  })
);

export const bookingCheckins = pgTable(
  "booking_checkins",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" })
      .unique(),
    status: bookingCheckinStatusEnum("status").notNull().default("pending"),
    checkedInAt: timestamp("checked_in_at"),
    checkedInByClerkUserId: text("checked_in_by_clerk_user_id"),
    method: text("method"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingIdx: index("booking_checkins_booking_id_idx").on(table.bookingId),
    statusIdx: index("booking_checkins_status_idx").on(table.status),
  })
);

export const bookingReviews = pgTable(
  "booking_reviews",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    reviewerClerkUserId: text("reviewer_clerk_user_id").notNull(),
    subjectType: bookingReviewSubjectEnum("subject_type").notNull(),
    venueId: integer("venue_id").references(() => venues.id, { onDelete: "set null" }),
    djProfileId: integer("dj_profile_id").references(() => djProfiles.id, { onDelete: "set null" }),
    targetClerkUserId: text("target_clerk_user_id"),
    rating: integer("rating").notNull(),
    title: text("title"),
    body: text("body"),
    privateAdminNotes: text("private_admin_notes"),
    isVisible: boolean("is_visible").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingIdx: index("booking_reviews_booking_id_idx").on(table.bookingId),
    reviewerIdx: index("booking_reviews_reviewer_clerk_user_id_idx").on(table.reviewerClerkUserId),
    subjectIdx: index("booking_reviews_subject_type_idx").on(table.subjectType),
    uniqueReview: unique("booking_reviews_unique_subject_review").on(
      table.bookingId,
      table.reviewerClerkUserId,
      table.subjectType
    ),
  })
);

export const bookingNotifications = pgTable(
  "booking_notifications",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    recipientClerkUserId: text("recipient_clerk_user_id"),
    notificationType: text("notification_type").notNull(),
    channel: text("channel").notNull().default("in_app"),
    status: bookingNotificationStatusEnum("status").notNull().default("queued"),
    payloadJson: text("payload_json").notNull(),
    scheduledAt: timestamp("scheduled_at").defaultNow().notNull(),
    sentAt: timestamp("sent_at"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingIdx: index("booking_notifications_booking_id_idx").on(table.bookingId),
    statusIdx: index("booking_notifications_status_idx").on(table.status),
    typeIdx: index("booking_notifications_notification_type_idx").on(table.notificationType),
  })
);

export const bookingAuditLog = pgTable(
  "booking_audit_log",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    actorClerkUserId: text("actor_clerk_user_id").notNull(),
    actorRole: text("actor_role"),
    action: text("action").notNull(),
    previousValuesJson: text("previous_values_json"),
    nextValuesJson: text("next_values_json"),
    metadataJson: text("metadata_json"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingIdx: index("booking_audit_log_booking_id_idx").on(table.bookingId),
    actorIdx: index("booking_audit_log_actor_clerk_user_id_idx").on(table.actorClerkUserId),
    actionIdx: index("booking_audit_log_action_idx").on(table.action),
  })
);

export const venueTables = pgTable(
  "venue_tables",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "cascade" }),
    floorObjectId: integer("floor_object_id").references(() => venueFloorPlanObjects.id, { onDelete: "set null" }),
    tableCode: text("table_code").notNull(),
    name: text("name").notNull(),
    sectionName: text("section_name"),
    minimumGuests: integer("minimum_guests").notNull().default(1),
    maximumGuests: integer("maximum_guests").notNull().default(12),
    minimumSpendCents: integer("minimum_spend_cents").notNull().default(0),
    depositPercent: integer("deposit_percent").notNull().default(20),
    metadataJson: text("metadata_json").notNull().default("{}"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_tables_venue_id_idx").on(table.venueId),
    floorObjectIdx: index("venue_tables_floor_object_id_idx").on(table.floorObjectId),
    activeIdx: index("venue_tables_is_active_idx").on(table.isActive),
    codeUnique: unique("venue_tables_venue_id_table_code_unique").on(table.venueId, table.tableCode),
  })
);

export const venueServers = pgTable(
  "venue_servers",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "cascade" }),
    staffProfileId: integer("staff_profile_id").references(() => venueStaffProfiles.id, { onDelete: "set null" }),
    displayName: text("display_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    isLead: boolean("is_lead").notNull().default(false),
    metadataJson: text("metadata_json").notNull().default("{}"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_servers_venue_id_idx").on(table.venueId),
    staffIdx: index("venue_servers_staff_profile_id_idx").on(table.staffProfileId),
    activeIdx: index("venue_servers_is_active_idx").on(table.isActive),
  })
);

export const venueAddons = pgTable(
  "venue_addons",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").notNull().default("service"),
    description: text("description"),
    unitPriceCents: integer("unit_price_cents").notNull().default(0),
    isPerGuest: boolean("is_per_guest").notNull().default(false),
    metadataJson: text("metadata_json").notNull().default("{}"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_addons_venue_id_idx").on(table.venueId),
    categoryIdx: index("venue_addons_category_idx").on(table.category),
    activeIdx: index("venue_addons_is_active_idx").on(table.isActive),
  })
);

export const tableBookings = pgTable(
  "table_bookings",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" })
      .unique(),
    venueId: integer("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "cascade" }),
    venueTableId: integer("venue_table_id").references(() => venueTables.id, { onDelete: "set null" }),
    serverId: integer("server_id").references(() => venueServers.id, { onDelete: "set null" }),
    bookingCategory: text("booking_category").notNull().default("vip_table"),
    reservationName: text("reservation_name"),
    partySize: integer("party_size").notNull().default(2),
    reservationStartAt: timestamp("reservation_start_at"),
    reservationEndAt: timestamp("reservation_end_at"),
    status: text("status").notNull().default("pending"),
    minimumSpendCents: integer("minimum_spend_cents").notNull().default(0),
    depositAmountCents: integer("deposit_amount_cents").notNull().default(0),
    notes: text("notes"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingIdx: index("table_bookings_booking_id_idx").on(table.bookingId),
    venueIdx: index("table_bookings_venue_id_idx").on(table.venueId),
    tableIdx: index("table_bookings_venue_table_id_idx").on(table.venueTableId),
    serverIdx: index("table_bookings_server_id_idx").on(table.serverId),
    statusIdx: index("table_bookings_status_idx").on(table.status),
  })
);

export const bookingItems = pgTable(
  "booking_items",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    itemType: text("item_type").notNull(),
    referenceId: integer("reference_id"),
    label: text("label").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPriceCents: integer("unit_price_cents").notNull().default(0),
    totalPriceCents: integer("total_price_cents").notNull().default(0),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingIdx: index("booking_items_booking_id_idx").on(table.bookingId),
    itemTypeIdx: index("booking_items_item_type_idx").on(table.itemType),
  })
);

export const bookingBottles = pgTable(
  "booking_bottles",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    bottlePackageId: integer("bottle_package_id").references(() => venueBottlePackages.id, { onDelete: "set null" }),
    label: text("label").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPriceCents: integer("unit_price_cents").notNull().default(0),
    mixersJson: text("mixers_json").notNull().default("[]"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingIdx: index("booking_bottles_booking_id_idx").on(table.bookingId),
    packageIdx: index("booking_bottles_bottle_package_id_idx").on(table.bottlePackageId),
  })
);

export const bookingAddons = pgTable(
  "booking_addons",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    venueAddonId: integer("venue_addon_id").references(() => venueAddons.id, { onDelete: "set null" }),
    label: text("label").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPriceCents: integer("unit_price_cents").notNull().default(0),
    totalPriceCents: integer("total_price_cents").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingIdx: index("booking_addons_booking_id_idx").on(table.bookingId),
    addonIdx: index("booking_addons_venue_addon_id_idx").on(table.venueAddonId),
  })
);

export const billSplits = pgTable(
  "bill_splits",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    payerClerkUserId: text("payer_clerk_user_id"),
    payerDisplayName: text("payer_display_name").notNull(),
    payerEmail: text("payer_email"),
    payerPhone: text("payer_phone"),
    splitPercent: real("split_percent"),
    amountCents: integer("amount_cents").notNull().default(0),
    status: text("status").notNull().default("pending"),
    inviteToken: text("invite_token"),
    invitedAt: timestamp("invited_at"),
    paidAt: timestamp("paid_at"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingIdx: index("bill_splits_booking_id_idx").on(table.bookingId),
    statusIdx: index("bill_splits_status_idx").on(table.status),
    tokenIdx: index("bill_splits_invite_token_idx").on(table.inviteToken),
  })
);

export const billSplitPayments = pgTable(
  "bill_split_payments",
  {
    id: serial("id").primaryKey(),
    billSplitId: integer("bill_split_id")
      .notNull()
      .references(() => billSplits.id, { onDelete: "cascade" }),
    bookingPaymentId: integer("booking_payment_id")
      .notNull()
      .references(() => bookingPayments.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    splitIdx: index("bill_split_payments_bill_split_id_idx").on(table.billSplitId),
    paymentIdx: index("bill_split_payments_booking_payment_id_idx").on(table.bookingPaymentId),
  })
);

export const bookingActivity = pgTable(
  "booking_activity",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    actorClerkUserId: text("actor_clerk_user_id"),
    actorRole: text("actor_role"),
    activityType: text("activity_type").notNull(),
    details: text("details"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingIdx: index("booking_activity_booking_id_idx").on(table.bookingId),
    typeIdx: index("booking_activity_activity_type_idx").on(table.activityType),
    createdIdx: index("booking_activity_created_at_idx").on(table.createdAt),
  })
);

export const reservationStatusLog = pgTable(
  "reservation_status_log",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    tableBookingId: integer("table_booking_id").references(() => tableBookings.id, { onDelete: "set null" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    actorClerkUserId: text("actor_clerk_user_id"),
    actorRole: text("actor_role"),
    note: text("note"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingIdx: index("reservation_status_log_booking_id_idx").on(table.bookingId),
    tableBookingIdx: index("reservation_status_log_table_booking_id_idx").on(table.tableBookingId),
    toStatusIdx: index("reservation_status_log_to_status_idx").on(table.toStatus),
    createdIdx: index("reservation_status_log_created_at_idx").on(table.createdAt),
  })
);

export const tableStatusLog = pgTable(
  "table_status_log",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "cascade" }),
    venueTableId: integer("venue_table_id")
      .notNull()
      .references(() => venueTables.id, { onDelete: "cascade" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    actorClerkUserId: text("actor_clerk_user_id"),
    actorRole: text("actor_role"),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("table_status_log_venue_id_idx").on(table.venueId),
    tableIdx: index("table_status_log_venue_table_id_idx").on(table.venueTableId),
    toStatusIdx: index("table_status_log_to_status_idx").on(table.toStatus),
    createdIdx: index("table_status_log_created_at_idx").on(table.createdAt),
  })
);

export const serverAssignments = pgTable(
  "server_assignments",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    tableBookingId: integer("table_booking_id").references(() => tableBookings.id, { onDelete: "set null" }),
    venueId: integer("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "cascade" }),
    serverId: integer("server_id")
      .notNull()
      .references(() => venueServers.id, { onDelete: "cascade" }),
    assignedByClerkUserId: text("assigned_by_clerk_user_id"),
    assignmentStatus: text("assignment_status").notNull().default("assigned"),
    notes: text("notes"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingIdx: index("server_assignments_booking_id_idx").on(table.bookingId),
    tableBookingIdx: index("server_assignments_table_booking_id_idx").on(table.tableBookingId),
    venueIdx: index("server_assignments_venue_id_idx").on(table.venueId),
    serverIdx: index("server_assignments_server_id_idx").on(table.serverId),
    statusIdx: index("server_assignments_assignment_status_idx").on(table.assignmentStatus),
  })
);

export const arrivalLog = pgTable(
  "arrival_log",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    tableBookingId: integer("table_booking_id").references(() => tableBookings.id, { onDelete: "set null" }),
    venueId: integer("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "cascade" }),
    expectedAt: timestamp("expected_at"),
    arrivedAt: timestamp("arrived_at"),
    seatedAt: timestamp("seated_at"),
    noShowAt: timestamp("no_show_at"),
    delayMinutes: integer("delay_minutes").notNull().default(0),
    partySizeAtArrival: integer("party_size_at_arrival"),
    recordedByClerkUserId: text("recorded_by_clerk_user_id"),
    note: text("note"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingIdx: index("arrival_log_booking_id_idx").on(table.bookingId),
    tableBookingIdx: index("arrival_log_table_booking_id_idx").on(table.tableBookingId),
    venueIdx: index("arrival_log_venue_id_idx").on(table.venueId),
    expectedIdx: index("arrival_log_expected_at_idx").on(table.expectedAt),
  })
);

export const checkInLog = pgTable(
  "check_in_log",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    venueId: integer("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "cascade" }),
    tableBookingId: integer("table_booking_id").references(() => tableBookings.id, { onDelete: "set null" }),
    checkInToken: text("check_in_token").notNull(),
    scanNonce: text("scan_nonce").notNull().unique(),
    scannedByClerkUserId: text("scanned_by_clerk_user_id"),
    scannedByRole: text("scanned_by_role"),
    scanMethod: text("scan_method").notNull().default("qr"),
    decision: text("decision").notNull().default("accepted"),
    reason: text("reason"),
    scannedAt: timestamp("scanned_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingIdx: index("check_in_log_booking_id_idx").on(table.bookingId),
    venueIdx: index("check_in_log_venue_id_idx").on(table.venueId),
    tableBookingIdx: index("check_in_log_table_booking_id_idx").on(table.tableBookingId),
    scannedAtIdx: index("check_in_log_scanned_at_idx").on(table.scannedAt),
  })
);

export const reservationNotifications = pgTable(
  "reservation_notifications",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    venueId: integer("venue_id").references(() => venues.id, { onDelete: "set null" }),
    recipientClerkUserId: text("recipient_clerk_user_id"),
    notificationType: text("notification_type").notNull(),
    channel: text("channel").notNull().default("in_app"),
    status: text("status").notNull().default("queued"),
    payloadJson: text("payload_json").notNull().default("{}"),
    scheduledAt: timestamp("scheduled_at").defaultNow().notNull(),
    sentAt: timestamp("sent_at"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingIdx: index("reservation_notifications_booking_id_idx").on(table.bookingId),
    venueIdx: index("reservation_notifications_venue_id_idx").on(table.venueId),
    typeIdx: index("reservation_notifications_type_idx").on(table.notificationType),
    statusIdx: index("reservation_notifications_status_idx").on(table.status),
  })
);

export const waitlistEntries = pgTable(
  "waitlist_entries",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "cascade" }),
    bookingId: integer("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    clerkUserId: text("clerk_user_id"),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    partySize: integer("party_size").notNull().default(2),
    preferredSection: text("preferred_section"),
    preferredTimeAt: timestamp("preferred_time_at"),
    status: text("status").notNull().default("waiting"),
    notifiedAt: timestamp("notified_at"),
    expiresAt: timestamp("expires_at"),
    acceptedAt: timestamp("accepted_at"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("waitlist_entries_venue_id_idx").on(table.venueId),
    bookingIdx: index("waitlist_entries_booking_id_idx").on(table.bookingId),
    statusIdx: index("waitlist_entries_status_idx").on(table.status),
    preferredTimeIdx: index("waitlist_entries_preferred_time_at_idx").on(table.preferredTimeAt),
  })
);

export const reservationHistory = pgTable(
  "reservation_history",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    venueId: integer("venue_id").references(() => venues.id, { onDelete: "set null" }),
    consumerClerkUserId: text("consumer_clerk_user_id"),
    summaryType: text("summary_type").notNull().default("completed_reservation"),
    summaryJson: text("summary_json").notNull().default("{}"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingIdx: index("reservation_history_booking_id_idx").on(table.bookingId),
    venueIdx: index("reservation_history_venue_id_idx").on(table.venueId),
    consumerIdx: index("reservation_history_consumer_clerk_user_id_idx").on(table.consumerClerkUserId),
  })
);

export const djAvailability = pgTable(
  "dj_availability",
  {
    id: serial("id").primaryKey(),
    djProfileId: integer("dj_profile_id")
      .notNull()
      .references(() => djProfiles.id, { onDelete: "cascade" }),
    availabilityDate: date("availability_date"),
    startTime: text("start_time"),
    endTime: text("end_time"),
    timezone: text("timezone").notNull().default("America/New_York"),
    isBlocked: boolean("is_blocked").notNull().default(false),
    recurrenceRule: text("recurrence_rule"),
    blockedDatesJson: text("blocked_dates_json"),
    travelRadiusMiles: real("travel_radius_miles"),
    travelFeeCents: integer("travel_fee_cents").notNull().default(0),
    minimumBookingAmountCents: integer("minimum_booking_amount_cents").notNull().default(0),
    genresJson: text("genres_json"),
    equipmentRequirementsJson: text("equipment_requirements_json"),
    hourlyPricingCents: integer("hourly_pricing_cents").notNull().default(0),
    nightlyPricingCents: integer("nightly_pricing_cents").notNull().default(0),
    holidayPricingMultiplier: real("holiday_pricing_multiplier").notNull().default(1),
    rushBookingPricingMultiplier: real("rush_booking_pricing_multiplier").notNull().default(1),
    cancellationPolicyJson: text("cancellation_policy_json"),
    autoDeclineRulesJson: text("auto_decline_rules_json"),
    vacationMode: boolean("vacation_mode").notNull().default(false),
    vacationStartAt: timestamp("vacation_start_at"),
    vacationEndAt: timestamp("vacation_end_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    djIdx: index("dj_availability_dj_profile_id_idx").on(table.djProfileId),
    availabilityIdx: index("dj_availability_availability_date_idx").on(table.availabilityDate),
  })
);

export const venueAvailability = pgTable(
  "venue_availability",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "cascade" }),
    availabilityDate: date("availability_date"),
    startTime: text("start_time"),
    endTime: text("end_time"),
    timezone: text("timezone").notNull().default("America/New_York"),
    privateEventAvailable: boolean("private_event_available").notNull().default(true),
    tableInventoryJson: text("table_inventory_json"),
    bottleInventoryJson: text("bottle_inventory_json"),
    vipCapacity: integer("vip_capacity").notNull().default(0),
    reservationWindowMinutes: integer("reservation_window_minutes").notNull().default(0),
    holidayOverridesJson: text("holiday_overrides_json"),
    specialEventBlackoutDatesJson: text("special_event_blackout_dates_json"),
    approvalRequired: boolean("approval_required").notNull().default(true),
    venueSpecificRulesJson: text("venue_specific_rules_json"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_availability_venue_id_idx").on(table.venueId),
    availabilityIdx: index("venue_availability_availability_date_idx").on(table.availabilityDate),
  })
);

export const conciergeThreadStatusEnum = pgEnum("concierge_thread_status", ["active", "archived"]);
export const conciergeMessageRoleEnum = pgEnum("concierge_message_role", ["user", "assistant"]);

export const conciergeThreads = pgTable(
  "concierge_threads",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id"),
    sessionKey: text("session_key").notNull(),
    title: text("title").notNull().default("Nightly Concierge"),
    status: conciergeThreadStatusEnum("status").notNull().default("active"),
    lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    sessionKeyUnique: unique("concierge_threads_session_key_unique").on(table.sessionKey),
    clerkUserIdIdx: index("concierge_threads_clerk_user_id_idx").on(table.clerkUserId),
    lastMessageAtIdx: index("concierge_threads_last_message_at_idx").on(table.lastMessageAt),
  })
);

export const conciergeMessages = pgTable(
  "concierge_messages",
  {
    id: serial("id").primaryKey(),
    threadId: integer("thread_id")
      .notNull()
      .references(() => conciergeThreads.id, { onDelete: "cascade" }),
    role: conciergeMessageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    intent: text("intent"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    threadIdIdx: index("concierge_messages_thread_id_idx").on(table.threadId),
    createdAtIdx: index("concierge_messages_created_at_idx").on(table.createdAt),
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

export const venueStaffStatusEnum = pgEnum("venue_staff_status", ["invited", "active", "suspended", "terminated"]);
export const venueStaffDepartmentEnum = pgEnum("venue_staff_department", ["management", "door", "security", "bar", "vip", "operations", "marketing", "inventory", "finance"]);
export const venueShiftStatusEnum = pgEnum("venue_shift_status", ["scheduled", "open", "swap_requested", "completed", "missed", "cancelled"]);
export const venueShiftRequestTypeEnum = pgEnum("venue_shift_request_type", ["swap", "cover", "drop", "time_off", "open_claim"]);
export const venueShiftRequestStatusEnum = pgEnum("venue_shift_request_status", ["pending", "approved", "declined", "cancelled"]);
export const venueTaskStatusEnum = pgEnum("venue_task_status", ["pending", "in_progress", "completed", "blocked"]);
export const venueVipReservationStatusEnum = pgEnum("venue_vip_reservation_status", ["pending", "confirmed", "arrived", "seated", "closed", "cancelled", "no_show"]);
export const venueInventoryMovementTypeEnum = pgEnum("venue_inventory_movement_type", ["receive", "consume", "adjust", "count", "waste", "damage", "transfer"]);
export const venuePurchaseOrderStatusEnum = pgEnum("venue_purchase_order_status", ["draft", "submitted", "approved", "received", "cancelled"]);
export const venueMarketingChannelEnum = pgEnum("venue_marketing_channel", ["push", "email", "sms", "in_app"]);
export const venueMarketingCampaignStatusEnum = pgEnum("venue_marketing_campaign_status", ["draft", "scheduled", "sent", "paused", "cancelled"]);
export const venueLoyaltyTierEnum = pgEnum("venue_loyalty_tier", ["bronze", "silver", "gold", "platinum"]);
export const venueAiInsightTypeEnum = pgEnum("venue_ai_insight_type", ["attendance_forecast", "revenue_forecast", "inventory_forecast", "staffing_recommendation", "marketing_recommendation", "campaign_generation", "customer_insight", "event_scoring", "operational_summary", "nightly_recap"]);
export const venueAiInsightStatusEnum = pgEnum("venue_ai_insight_status", ["pending", "ready", "failed"]);
export const venueIncidentSeverityEnum = pgEnum("venue_incident_severity", ["low", "medium", "high", "critical"]);

export const venueStaffProfiles = pgTable(
  "venue_staff_profiles",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    clerkUserId: text("clerk_user_id"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    department: venueStaffDepartmentEnum("department").notNull().default("operations"),
    jobTitle: text("job_title").notNull(),
    permissionsJson: text("permissions_json").notNull().default("[]"),
    emergencyContactJson: text("emergency_contact_json").notNull().default("{}"),
    hourlyRateCents: integer("hourly_rate_cents").notNull().default(0),
    status: venueStaffStatusEnum("status").notNull().default("invited"),
    hiredAt: timestamp("hired_at"),
    suspendedAt: timestamp("suspended_at"),
    terminatedAt: timestamp("terminated_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_staff_profiles_venue_id_idx").on(table.venueId),
    userIdx: index("venue_staff_profiles_user_id_idx").on(table.userId),
    clerkIdx: index("venue_staff_profiles_clerk_user_id_idx").on(table.clerkUserId),
    statusIdx: index("venue_staff_profiles_status_idx").on(table.status),
    departmentIdx: index("venue_staff_profiles_department_idx").on(table.department),
  })
);

export const venueStaffInvitations = pgTable(
  "venue_staff_invitations",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    invitedByClerkUserId: text("invited_by_clerk_user_id").notNull(),
    email: text("email").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    department: venueStaffDepartmentEnum("department").notNull().default("operations"),
    jobTitle: text("job_title").notNull(),
    permissionsJson: text("permissions_json").notNull().default("[]"),
    inviteToken: text("invite_token").notNull().unique(),
    status: venueStaffStatusEnum("status").notNull().default("invited"),
    expiresAt: timestamp("expires_at"),
    acceptedAt: timestamp("accepted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_staff_invitations_venue_id_idx").on(table.venueId),
    emailIdx: index("venue_staff_invitations_email_idx").on(table.email),
    statusIdx: index("venue_staff_invitations_status_idx").on(table.status),
  })
);

export const venueStaffCertifications = pgTable(
  "venue_staff_certifications",
  {
    id: serial("id").primaryKey(),
    staffProfileId: integer("staff_profile_id").notNull().references(() => venueStaffProfiles.id, { onDelete: "cascade" }),
    certificationName: text("certification_name").notNull(),
    issuer: text("issuer"),
    issuedAt: timestamp("issued_at"),
    expiresAt: timestamp("expires_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    staffIdx: index("venue_staff_certifications_staff_profile_id_idx").on(table.staffProfileId),
    expiresIdx: index("venue_staff_certifications_expires_at_idx").on(table.expiresAt),
  })
);

export const venueStaffAvailability = pgTable(
  "venue_staff_availability",
  {
    id: serial("id").primaryKey(),
    staffProfileId: integer("staff_profile_id").notNull().references(() => venueStaffProfiles.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(),
    startTime: text("start_time"),
    endTime: text("end_time"),
    isPreferred: boolean("is_preferred").notNull().default(true),
    unavailableDatesJson: text("unavailable_dates_json").notNull().default("[]"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    staffIdx: index("venue_staff_availability_staff_profile_id_idx").on(table.staffProfileId),
    dayIdx: index("venue_staff_availability_day_of_week_idx").on(table.dayOfWeek),
  })
);

export const venueShifts = pgTable(
  "venue_shifts",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
    staffProfileId: integer("staff_profile_id").references(() => venueStaffProfiles.id, { onDelete: "set null" }),
    department: venueStaffDepartmentEnum("department").notNull().default("operations"),
    shiftTitle: text("shift_title").notNull(),
    roleLabel: text("role_label").notNull(),
    status: venueShiftStatusEnum("status").notNull().default("scheduled"),
    startsAt: timestamp("starts_at").notNull(),
    endsAt: timestamp("ends_at").notNull(),
    recurrenceRule: text("recurrence_rule"),
    isOpenShift: boolean("is_open_shift").notNull().default(false),
    managerApprovalRequired: boolean("manager_approval_required").notNull().default(false),
    overtimeWarningMinutes: integer("overtime_warning_minutes").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_shifts_venue_id_idx").on(table.venueId),
    eventIdx: index("venue_shifts_event_id_idx").on(table.eventId),
    staffIdx: index("venue_shifts_staff_profile_id_idx").on(table.staffProfileId),
    startsIdx: index("venue_shifts_starts_at_idx").on(table.startsAt),
    statusIdx: index("venue_shifts_status_idx").on(table.status),
  })
);

export const venueShiftRequests = pgTable(
  "venue_shift_requests",
  {
    id: serial("id").primaryKey(),
    shiftId: integer("shift_id").notNull().references(() => venueShifts.id, { onDelete: "cascade" }),
    requesterStaffProfileId: integer("requester_staff_profile_id").notNull().references(() => venueStaffProfiles.id, { onDelete: "cascade" }),
    targetStaffProfileId: integer("target_staff_profile_id").references(() => venueStaffProfiles.id, { onDelete: "set null" }),
    requestType: venueShiftRequestTypeEnum("request_type").notNull(),
    status: venueShiftRequestStatusEnum("status").notNull().default("pending"),
    reason: text("reason"),
    managerNotes: text("manager_notes"),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    shiftIdx: index("venue_shift_requests_shift_id_idx").on(table.shiftId),
    requesterIdx: index("venue_shift_requests_requester_staff_profile_id_idx").on(table.requesterStaffProfileId),
    statusIdx: index("venue_shift_requests_status_idx").on(table.status),
  })
);

export const venueTimeEntries = pgTable(
  "venue_time_entries",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    shiftId: integer("shift_id").references(() => venueShifts.id, { onDelete: "set null" }),
    staffProfileId: integer("staff_profile_id").notNull().references(() => venueStaffProfiles.id, { onDelete: "cascade" }),
    clockInAt: timestamp("clock_in_at").notNull(),
    clockOutAt: timestamp("clock_out_at"),
    breakStartedAt: timestamp("break_started_at"),
    breakEndedAt: timestamp("break_ended_at"),
    breakMinutesTotal: integer("break_minutes_total").notNull().default(0),
    attendanceStatus: text("attendance_status").notNull().default("clocked_in"),
    approvedByStaffProfileId: integer("approved_by_staff_profile_id").references(() => venueStaffProfiles.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_time_entries_venue_id_idx").on(table.venueId),
    shiftIdx: index("venue_time_entries_shift_id_idx").on(table.shiftId),
    staffIdx: index("venue_time_entries_staff_profile_id_idx").on(table.staffProfileId),
    clockInIdx: index("venue_time_entries_clock_in_at_idx").on(table.clockInAt),
  })
);

export const venueOperationPlans = pgTable(
  "venue_operation_plans",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
    createdByStaffProfileId: integer("created_by_staff_profile_id").references(() => venueStaffProfiles.id, { onDelete: "set null" }),
    planType: text("plan_type").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    scheduledFor: timestamp("scheduled_for"),
    status: venueTaskStatusEnum("status").notNull().default("pending"),
    metricsJson: text("metrics_json").notNull().default("{}"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_operation_plans_venue_id_idx").on(table.venueId),
    eventIdx: index("venue_operation_plans_event_id_idx").on(table.eventId),
    typeIdx: index("venue_operation_plans_plan_type_idx").on(table.planType),
    statusIdx: index("venue_operation_plans_status_idx").on(table.status),
  })
);

export const venueOperationTasks = pgTable(
  "venue_operation_tasks",
  {
    id: serial("id").primaryKey(),
    planId: integer("plan_id").notNull().references(() => venueOperationPlans.id, { onDelete: "cascade" }),
    assignedStaffProfileId: integer("assigned_staff_profile_id").references(() => venueStaffProfiles.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    priority: text("priority").notNull().default("normal"),
    status: venueTaskStatusEnum("status").notNull().default("pending"),
    dueAt: timestamp("due_at"),
    completedAt: timestamp("completed_at"),
    checklistJson: text("checklist_json").notNull().default("[]"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    planIdx: index("venue_operation_tasks_plan_id_idx").on(table.planId),
    assignedIdx: index("venue_operation_tasks_assigned_staff_profile_id_idx").on(table.assignedStaffProfileId),
    dueIdx: index("venue_operation_tasks_due_at_idx").on(table.dueAt),
    statusIdx: index("venue_operation_tasks_status_idx").on(table.status),
  })
);

export const venueFloorPlans = pgTable(
  "venue_floor_plans",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    width: integer("width").notNull().default(1200),
    height: integer("height").notNull().default(800),
    backgroundImageUrl: text("background_image_url"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_floor_plans_venue_id_idx").on(table.venueId),
    activeIdx: index("venue_floor_plans_is_active_idx").on(table.isActive),
  })
);

export const venueFloorPlanObjects = pgTable(
  "venue_floor_plan_objects",
  {
    id: serial("id").primaryKey(),
    floorPlanId: integer("floor_plan_id").notNull().references(() => venueFloorPlans.id, { onDelete: "cascade" }),
    objectType: text("object_type").notNull(),
    label: text("label").notNull(),
    sectionName: text("section_name"),
    capacity: integer("capacity").notNull().default(0),
    coordinatesJson: text("coordinates_json").notNull().default("{}"),
    rotationDegrees: real("rotation_degrees").notNull().default(0),
    metadataJson: text("metadata_json").notNull().default("{}"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    floorPlanIdx: index("venue_floor_plan_objects_floor_plan_id_idx").on(table.floorPlanId),
    typeIdx: index("venue_floor_plan_objects_object_type_idx").on(table.objectType),
    sectionIdx: index("venue_floor_plan_objects_section_name_idx").on(table.sectionName),
  })
);

export const venueCustomerProfiles = pgTable(
  "venue_customer_profiles",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    consumerUserId: integer("consumer_user_id").references(() => users.id, { onDelete: "set null" }),
    clerkUserId: text("clerk_user_id"),
    fullName: text("full_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    birthDate: date("birth_date"),
    favoriteGenresJson: text("favorite_genres_json").notNull().default("[]"),
    favoriteEventsJson: text("favorite_events_json").notNull().default("[]"),
    tagsJson: text("tags_json").notNull().default("[]"),
    visitCount: integer("visit_count").notNull().default(0),
    vipVisitCount: integer("vip_visit_count").notNull().default(0),
    lifetimeSpendCents: integer("lifetime_spend_cents").notNull().default(0),
    lastVisitAt: timestamp("last_visit_at"),
    loyaltyPoints: integer("loyalty_points").notNull().default(0),
    loyaltyTier: venueLoyaltyTierEnum("loyalty_tier").notNull().default("bronze"),
    marketingEligible: boolean("marketing_eligible").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_customer_profiles_venue_id_idx").on(table.venueId),
    userIdx: index("venue_customer_profiles_consumer_user_id_idx").on(table.consumerUserId),
    emailIdx: index("venue_customer_profiles_email_idx").on(table.email),
    spendIdx: index("venue_customer_profiles_lifetime_spend_cents_idx").on(table.lifetimeSpendCents),
  })
);

export const venueCustomerNotes = pgTable(
  "venue_customer_notes",
  {
    id: serial("id").primaryKey(),
    customerProfileId: integer("customer_profile_id").notNull().references(() => venueCustomerProfiles.id, { onDelete: "cascade" }),
    authorStaffProfileId: integer("author_staff_profile_id").references(() => venueStaffProfiles.id, { onDelete: "set null" }),
    note: text("note").notNull(),
    visibility: text("visibility").notNull().default("internal"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    customerIdx: index("venue_customer_notes_customer_profile_id_idx").on(table.customerProfileId),
    authorIdx: index("venue_customer_notes_author_staff_profile_id_idx").on(table.authorStaffProfileId),
  })
);

export const venueVipReservations = pgTable(
  "venue_vip_reservations",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
    customerProfileId: integer("customer_profile_id").references(() => venueCustomerProfiles.id, { onDelete: "set null" }),
    bookedByStaffProfileId: integer("booked_by_staff_profile_id").references(() => venueStaffProfiles.id, { onDelete: "set null" }),
    serverStaffProfileId: integer("server_staff_profile_id").references(() => venueStaffProfiles.id, { onDelete: "set null" }),
    hostStaffProfileId: integer("host_staff_profile_id").references(() => venueStaffProfiles.id, { onDelete: "set null" }),
    floorObjectId: integer("floor_object_id").references(() => venueFloorPlanObjects.id, { onDelete: "set null" }),
    reservationName: text("reservation_name").notNull(),
    partySize: integer("party_size").notNull().default(2),
    minimumSpendCents: integer("minimum_spend_cents").notNull().default(0),
    finalSpendCents: integer("final_spend_cents").notNull().default(0),
    status: venueVipReservationStatusEnum("status").notNull().default("pending"),
    packageJson: text("package_json").notNull().default("{}"),
    notes: text("notes"),
    arrivalAt: timestamp("arrival_at"),
    seatedAt: timestamp("seated_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_vip_reservations_venue_id_idx").on(table.venueId),
    eventIdx: index("venue_vip_reservations_event_id_idx").on(table.eventId),
    customerIdx: index("venue_vip_reservations_customer_profile_id_idx").on(table.customerProfileId),
    statusIdx: index("venue_vip_reservations_status_idx").on(table.status),
    arrivalIdx: index("venue_vip_reservations_arrival_at_idx").on(table.arrivalAt),
  })
);

export const venueBottlePackages = pgTable(
  "venue_bottle_packages",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    priceCents: integer("price_cents").notNull().default(0),
    packageItemsJson: text("package_items_json").notNull().default("[]"),
    mixersJson: text("mixers_json").notNull().default("[]"),
    addOnsJson: text("add_ons_json").notNull().default("[]"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_bottle_packages_venue_id_idx").on(table.venueId),
    activeIdx: index("venue_bottle_packages_is_active_idx").on(table.isActive),
  })
);

export const venueSuppliers = pgTable(
  "venue_suppliers",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    contactName: text("contact_name"),
    email: text("email"),
    phone: text("phone"),
    leadTimeDays: integer("lead_time_days").notNull().default(0),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_suppliers_venue_id_idx").on(table.venueId),
    activeIdx: index("venue_suppliers_is_active_idx").on(table.isActive),
  })
);

export const venueInventoryItems = pgTable(
  "venue_inventory_items",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    supplierId: integer("supplier_id").references(() => venueSuppliers.id, { onDelete: "set null" }),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    unitLabel: text("unit_label").notNull().default("unit"),
    onHandQuantity: integer("on_hand_quantity").notNull().default(0),
    reorderThreshold: integer("reorder_threshold").notNull().default(0),
    parQuantity: integer("par_quantity").notNull().default(0),
    unitCostCents: integer("unit_cost_cents").notNull().default(0),
    sellPriceCents: integer("sell_price_cents").notNull().default(0),
    metadataJson: text("metadata_json").notNull().default("{}"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_inventory_items_venue_id_idx").on(table.venueId),
    supplierIdx: index("venue_inventory_items_supplier_id_idx").on(table.supplierId),
    skuIdx: index("venue_inventory_items_sku_idx").on(table.sku),
    thresholdIdx: index("venue_inventory_items_reorder_threshold_idx").on(table.reorderThreshold),
  })
);

export const venueInventoryMovements = pgTable(
  "venue_inventory_movements",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    itemId: integer("item_id").notNull().references(() => venueInventoryItems.id, { onDelete: "cascade" }),
    movementType: venueInventoryMovementTypeEnum("movement_type").notNull(),
    quantity: integer("quantity").notNull().default(0),
    referenceType: text("reference_type"),
    referenceId: integer("reference_id"),
    staffProfileId: integer("staff_profile_id").references(() => venueStaffProfiles.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_inventory_movements_venue_id_idx").on(table.venueId),
    itemIdx: index("venue_inventory_movements_item_id_idx").on(table.itemId),
    typeIdx: index("venue_inventory_movements_movement_type_idx").on(table.movementType),
  })
);

export const venuePurchaseOrders = pgTable(
  "venue_purchase_orders",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    supplierId: integer("supplier_id").references(() => venueSuppliers.id, { onDelete: "set null" }),
    createdByStaffProfileId: integer("created_by_staff_profile_id").references(() => venueStaffProfiles.id, { onDelete: "set null" }),
    status: venuePurchaseOrderStatusEnum("status").notNull().default("draft"),
    itemsJson: text("items_json").notNull().default("[]"),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    expectedAt: timestamp("expected_at"),
    receivedAt: timestamp("received_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_purchase_orders_venue_id_idx").on(table.venueId),
    supplierIdx: index("venue_purchase_orders_supplier_id_idx").on(table.supplierId),
    statusIdx: index("venue_purchase_orders_status_idx").on(table.status),
  })
);

export const venueMarketingCampaigns = pgTable(
  "venue_marketing_campaigns",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    createdByStaffProfileId: integer("created_by_staff_profile_id").references(() => venueStaffProfiles.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    audienceLabel: text("audience_label").notNull(),
    channel: venueMarketingChannelEnum("channel").notNull(),
    status: venueMarketingCampaignStatusEnum("status").notNull().default("draft"),
    audienceFilterJson: text("audience_filter_json").notNull().default("{}"),
    contentJson: text("content_json").notNull().default("{}"),
    scheduledAt: timestamp("scheduled_at"),
    sentAt: timestamp("sent_at"),
    metricsJson: text("metrics_json").notNull().default("{}"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_marketing_campaigns_venue_id_idx").on(table.venueId),
    channelIdx: index("venue_marketing_campaigns_channel_idx").on(table.channel),
    statusIdx: index("venue_marketing_campaigns_status_idx").on(table.status),
    scheduledIdx: index("venue_marketing_campaigns_scheduled_at_idx").on(table.scheduledAt),
  })
);

export const venueLoyaltyRewards = pgTable(
  "venue_loyalty_rewards",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    pointsCost: integer("points_cost").notNull().default(0),
    tierRequired: venueLoyaltyTierEnum("tier_required").notNull().default("bronze"),
    benefitJson: text("benefit_json").notNull().default("{}"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_loyalty_rewards_venue_id_idx").on(table.venueId),
    tierIdx: index("venue_loyalty_rewards_tier_required_idx").on(table.tierRequired),
    activeIdx: index("venue_loyalty_rewards_is_active_idx").on(table.isActive),
  })
);

export const venueLoyaltyLedger = pgTable(
  "venue_loyalty_ledger",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    customerProfileId: integer("customer_profile_id").notNull().references(() => venueCustomerProfiles.id, { onDelete: "cascade" }),
    rewardId: integer("reward_id").references(() => venueLoyaltyRewards.id, { onDelete: "set null" }),
    createdByStaffProfileId: integer("created_by_staff_profile_id").references(() => venueStaffProfiles.id, { onDelete: "set null" }),
    entryType: text("entry_type").notNull(),
    pointsDelta: integer("points_delta").notNull().default(0),
    spendCents: integer("spend_cents").notNull().default(0),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_loyalty_ledger_venue_id_idx").on(table.venueId),
    customerIdx: index("venue_loyalty_ledger_customer_profile_id_idx").on(table.customerProfileId),
    typeIdx: index("venue_loyalty_ledger_entry_type_idx").on(table.entryType),
  })
);

export const venueAiInsights = pgTable(
  "venue_ai_insights",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
    requestedByClerkUserId: text("requested_by_clerk_user_id").notNull(),
    insightType: venueAiInsightTypeEnum("insight_type").notNull(),
    status: venueAiInsightStatusEnum("status").notNull().default("pending"),
    inputJson: text("input_json").notNull().default("{}"),
    outputJson: text("output_json"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_ai_insights_venue_id_idx").on(table.venueId),
    eventIdx: index("venue_ai_insights_event_id_idx").on(table.eventId),
    typeIdx: index("venue_ai_insights_insight_type_idx").on(table.insightType),
    statusIdx: index("venue_ai_insights_status_idx").on(table.status),
  })
);

export const venueIncidentReports = pgTable(
  "venue_incident_reports",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
    reportedByStaffProfileId: integer("reported_by_staff_profile_id").references(() => venueStaffProfiles.id, { onDelete: "set null" }),
    severity: venueIncidentSeverityEnum("severity").notNull().default("low"),
    category: text("category").notNull(),
    summary: text("summary").notNull(),
    details: text("details"),
    status: venueTaskStatusEnum("status").notNull().default("pending"),
    occurredAt: timestamp("occurred_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_incident_reports_venue_id_idx").on(table.venueId),
    eventIdx: index("venue_incident_reports_event_id_idx").on(table.eventId),
    severityIdx: index("venue_incident_reports_severity_idx").on(table.severity),
    statusIdx: index("venue_incident_reports_status_idx").on(table.status),
  })
);

export const venueIntelligenceStatusEnum = pgEnum("venue_intelligence_status", [
  "available",
  "estimated",
  "insufficient_data",
  "stale",
  "unavailable",
  "configuration_required",
  "error",
]);

export const venueIntelligenceConfidenceEnum = pgEnum("venue_intelligence_confidence", [
  "low",
  "medium",
  "high",
]);

export const venueIntelligenceActionStatusEnum = pgEnum("venue_intelligence_action_status", [
  "proposed",
  "reviewed",
  "approved",
  "applied",
  "dismissed",
  "snoozed",
]);

export const venueIntelligenceRunStatusEnum = pgEnum("venue_intelligence_run_status", [
  "started",
  "completed",
  "failed",
  "partial",
]);

export const venueIntelligenceSnapshotTypeEnum = pgEnum("venue_intelligence_snapshot_type", [
  "daily",
  "weekly",
  "monthly",
  "event_pre",
  "event_post",
]);

export const venueIntelligenceRecommendationTypeEnum = pgEnum("venue_intelligence_recommendation_type", [
  "marketing",
  "staffing",
  "inventory",
  "pricing",
  "promoter",
  "operations",
  "campaign_draft",
]);

export const venueIntelligenceConversationStatusEnum = pgEnum("venue_intelligence_conversation_status", ["active", "archived"]);
export const venueIntelligenceMessageRoleEnum = pgEnum("venue_intelligence_message_role", ["user", "assistant", "system"]);

export const venueIntelligenceRuns = pgTable(
  "venue_intelligence_runs",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
    triggeredByClerkUserId: text("triggered_by_clerk_user_id").notNull(),
    runType: text("run_type").notNull(),
    status: venueIntelligenceRunStatusEnum("status").notNull().default("started"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    finishedAt: timestamp("finished_at"),
    algorithmVersion: text("algorithm_version").notNull().default("v1"),
    providerUsed: text("provider_used").notNull().default("deterministic"),
    metricsJson: text("metrics_json").notNull().default("{}"),
    limitationsJson: text("limitations_json").notNull().default("[]"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_intelligence_runs_venue_id_idx").on(table.venueId),
    eventIdx: index("venue_intelligence_runs_event_id_idx").on(table.eventId),
    statusIdx: index("venue_intelligence_runs_status_idx").on(table.status),
    startedIdx: index("venue_intelligence_runs_started_at_idx").on(table.startedAt),
  })
);

export const venueIntelligenceSources = pgTable(
  "venue_intelligence_sources",
  {
    id: serial("id").primaryKey(),
    runId: integer("run_id").notNull().references(() => venueIntelligenceRuns.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(),
    sourceTable: text("source_table").notNull(),
    sourceWindowStart: timestamp("source_window_start"),
    sourceWindowEnd: timestamp("source_window_end"),
    lastDataAt: timestamp("last_data_at"),
    sampleSize: integer("sample_size"),
    status: venueIntelligenceStatusEnum("status").notNull().default("available"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    runIdx: index("venue_intelligence_sources_run_id_idx").on(table.runId),
    tableIdx: index("venue_intelligence_sources_source_table_idx").on(table.sourceTable),
    statusIdx: index("venue_intelligence_sources_status_idx").on(table.status),
  })
);

export const venueIntelligenceSnapshots = pgTable(
  "venue_intelligence_snapshots",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
    runId: integer("run_id").references(() => venueIntelligenceRuns.id, { onDelete: "set null" }),
    snapshotType: venueIntelligenceSnapshotTypeEnum("snapshot_type").notNull(),
    summary: text("summary").notNull(),
    payloadJson: text("payload_json").notNull().default("{}"),
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
    sourceWindowStart: timestamp("source_window_start"),
    sourceWindowEnd: timestamp("source_window_end"),
    status: venueIntelligenceStatusEnum("status").notNull().default("available"),
    confidenceLevel: venueIntelligenceConfidenceEnum("confidence_level").notNull().default("medium"),
    confidenceScore: real("confidence_score"),
    algorithmVersion: text("algorithm_version").notNull().default("v1"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_intelligence_snapshots_venue_id_idx").on(table.venueId),
    eventIdx: index("venue_intelligence_snapshots_event_id_idx").on(table.eventId),
    typeIdx: index("venue_intelligence_snapshots_type_idx").on(table.snapshotType),
    generatedIdx: index("venue_intelligence_snapshots_generated_at_idx").on(table.generatedAt),
  })
);

export const venueMetricSnapshots = pgTable(
  "venue_metric_snapshots",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
    runId: integer("run_id").references(() => venueIntelligenceRuns.id, { onDelete: "set null" }),
    metricKey: text("metric_key").notNull(),
    metricLabel: text("metric_label").notNull(),
    metricValue: real("metric_value"),
    metricUnit: text("metric_unit"),
    baselineValue: real("baseline_value"),
    deltaValue: real("delta_value"),
    status: venueIntelligenceStatusEnum("status").notNull().default("available"),
    isEstimated: boolean("is_estimated").notNull().default(false),
    isPartial: boolean("is_partial").notNull().default(false),
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
    sourceWindowStart: timestamp("source_window_start"),
    sourceWindowEnd: timestamp("source_window_end"),
    sourceTablesJson: text("source_tables_json").notNull().default("[]"),
    limitationsJson: text("limitations_json").notNull().default("[]"),
  },
  (table) => ({
    venueIdx: index("venue_metric_snapshots_venue_id_idx").on(table.venueId),
    metricIdx: index("venue_metric_snapshots_metric_key_idx").on(table.metricKey),
    generatedIdx: index("venue_metric_snapshots_generated_at_idx").on(table.generatedAt),
  })
);

export const venueEventForecasts = pgTable(
  "venue_event_forecasts",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    runId: integer("run_id").references(() => venueIntelligenceRuns.id, { onDelete: "set null" }),
    expectedAttendance: integer("expected_attendance"),
    lowAttendance: integer("low_attendance"),
    highAttendance: integer("high_attendance"),
    expectedCapacityUtilization: real("expected_capacity_utilization"),
    status: venueIntelligenceStatusEnum("status").notNull().default("estimated"),
    confidenceLevel: venueIntelligenceConfidenceEnum("confidence_level").notNull().default("medium"),
    confidenceScore: real("confidence_score"),
    keySignalsJson: text("key_signals_json").notNull().default("[]"),
    assumptionsJson: text("assumptions_json").notNull().default("[]"),
    limitationsJson: text("limitations_json").notNull().default("[]"),
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
    sourceWindowStart: timestamp("source_window_start"),
    sourceWindowEnd: timestamp("source_window_end"),
  },
  (table) => ({
    venueIdx: index("venue_event_forecasts_venue_id_idx").on(table.venueId),
    eventIdx: index("venue_event_forecasts_event_id_idx").on(table.eventId),
    generatedIdx: index("venue_event_forecasts_generated_at_idx").on(table.generatedAt),
  })
);

export const venueRevenueForecasts = pgTable(
  "venue_revenue_forecasts",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
    runId: integer("run_id").references(() => venueIntelligenceRuns.id, { onDelete: "set null" }),
    confirmedGrossCents: integer("confirmed_gross_cents").notNull().default(0),
    confirmedNetCents: integer("confirmed_net_cents").notNull().default(0),
    estimatedGrossCents: integer("estimated_gross_cents").notNull().default(0),
    estimatedNetCents: integer("estimated_net_cents").notNull().default(0),
    pendingRevenueCents: integer("pending_revenue_cents").notNull().default(0),
    refundedCents: integer("refunded_cents").notNull().default(0),
    lowNetCents: integer("low_net_cents").notNull().default(0),
    highNetCents: integer("high_net_cents").notNull().default(0),
    status: venueIntelligenceStatusEnum("status").notNull().default("estimated"),
    confidenceLevel: venueIntelligenceConfidenceEnum("confidence_level").notNull().default("medium"),
    confidenceScore: real("confidence_score"),
    assumptionsJson: text("assumptions_json").notNull().default("[]"),
    exclusionsJson: text("exclusions_json").notNull().default("[]"),
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_revenue_forecasts_venue_id_idx").on(table.venueId),
    eventIdx: index("venue_revenue_forecasts_event_id_idx").on(table.eventId),
    generatedIdx: index("venue_revenue_forecasts_generated_at_idx").on(table.generatedAt),
  })
);

export const venueStaffingRecommendations = pgTable(
  "venue_staffing_recommendations",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
    runId: integer("run_id").references(() => venueIntelligenceRuns.id, { onDelete: "set null" }),
    recommendationJson: text("recommendation_json").notNull().default("{}"),
    rationaleJson: text("rationale_json").notNull().default("[]"),
    status: venueIntelligenceStatusEnum("status").notNull().default("available"),
    confidenceLevel: venueIntelligenceConfidenceEnum("confidence_level").notNull().default("medium"),
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_staffing_recommendations_venue_id_idx").on(table.venueId),
    eventIdx: index("venue_staffing_recommendations_event_id_idx").on(table.eventId),
    generatedIdx: index("venue_staffing_recommendations_generated_at_idx").on(table.generatedAt),
  })
);

export const venueInventoryForecasts = pgTable(
  "venue_inventory_forecasts",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
    runId: integer("run_id").references(() => venueIntelligenceRuns.id, { onDelete: "set null" }),
    itemId: integer("item_id").references(() => venueInventoryItems.id, { onDelete: "set null" }),
    expectedConsumption: integer("expected_consumption").notNull().default(0),
    recommendedQuantity: integer("recommended_quantity").notNull().default(0),
    reorderQuantity: integer("reorder_quantity").notNull().default(0),
    shortageRisk: real("shortage_risk").notNull().default(0),
    overstockRisk: real("overstock_risk").notNull().default(0),
    status: venueIntelligenceStatusEnum("status").notNull().default("estimated"),
    confidenceLevel: venueIntelligenceConfidenceEnum("confidence_level").notNull().default("medium"),
    assumptionsJson: text("assumptions_json").notNull().default("[]"),
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_inventory_forecasts_venue_id_idx").on(table.venueId),
    itemIdx: index("venue_inventory_forecasts_item_id_idx").on(table.itemId),
    generatedIdx: index("venue_inventory_forecasts_generated_at_idx").on(table.generatedAt),
  })
);

export const venueMarketingRecommendations = pgTable(
  "venue_marketing_recommendations",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
    runId: integer("run_id").references(() => venueIntelligenceRuns.id, { onDelete: "set null" }),
    recommendationType: venueIntelligenceRecommendationTypeEnum("recommendation_type").notNull().default("marketing"),
    title: text("title").notNull(),
    objective: text("objective").notNull(),
    audienceLabel: text("audience_label").notNull(),
    channel: text("channel").notNull(),
    timingLabel: text("timing_label").notNull(),
    messageAngle: text("message_angle").notNull(),
    reason: text("reason").notNull(),
    restrictionsJson: text("restrictions_json").notNull().default("[]"),
    status: venueIntelligenceStatusEnum("status").notNull().default("available"),
    confidenceLevel: venueIntelligenceConfidenceEnum("confidence_level").notNull().default("medium"),
    confidenceScore: real("confidence_score"),
    requiresApproval: boolean("requires_approval").notNull().default(true),
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_marketing_recommendations_venue_id_idx").on(table.venueId),
    eventIdx: index("venue_marketing_recommendations_event_id_idx").on(table.eventId),
    typeIdx: index("venue_marketing_recommendations_type_idx").on(table.recommendationType),
  })
);

export const venueCustomerSegmentSnapshots = pgTable(
  "venue_customer_segment_snapshots",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    runId: integer("run_id").references(() => venueIntelligenceRuns.id, { onDelete: "set null" }),
    segmentKey: text("segment_key").notNull(),
    segmentLabel: text("segment_label").notNull(),
    audienceSize: integer("audience_size").notNull().default(0),
    requiredPermissionsJson: text("required_permissions_json").notNull().default("[]"),
    exclusionsJson: text("exclusions_json").notNull().default("[]"),
    objective: text("objective").notNull(),
    status: venueIntelligenceStatusEnum("status").notNull().default("available"),
    isPrivacyRestricted: boolean("is_privacy_restricted").notNull().default(false),
    dataFreshnessMinutes: integer("data_freshness_minutes"),
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_customer_segment_snapshots_venue_id_idx").on(table.venueId),
    segmentIdx: index("venue_customer_segment_snapshots_segment_key_idx").on(table.segmentKey),
    generatedIdx: index("venue_customer_segment_snapshots_generated_at_idx").on(table.generatedAt),
  })
);

export const venuePromoterInsights = pgTable(
  "venue_promoter_insights",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
    promoterProfileId: integer("promoter_profile_id").references(() => promoterProfiles.id, { onDelete: "set null" }),
    runId: integer("run_id").references(() => venueIntelligenceRuns.id, { onDelete: "set null" }),
    metricsJson: text("metrics_json").notNull().default("{}"),
    recommendation: text("recommendation"),
    status: venueIntelligenceStatusEnum("status").notNull().default("available"),
    confidenceLevel: venueIntelligenceConfidenceEnum("confidence_level").notNull().default("medium"),
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_promoter_insights_venue_id_idx").on(table.venueId),
    eventIdx: index("venue_promoter_insights_event_id_idx").on(table.eventId),
    promoterIdx: index("venue_promoter_insights_promoter_profile_id_idx").on(table.promoterProfileId),
  })
);

export const venueAnomalies = pgTable(
  "venue_anomalies",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
    runId: integer("run_id").references(() => venueIntelligenceRuns.id, { onDelete: "set null" }),
    metricKey: text("metric_key").notNull(),
    severity: venueIncidentSeverityEnum("severity").notNull().default("low"),
    expectedLow: real("expected_low"),
    expectedHigh: real("expected_high"),
    actualValue: real("actual_value"),
    confidenceLevel: venueIntelligenceConfidenceEnum("confidence_level").notNull().default("low"),
    explanation: text("explanation"),
    recommendation: text("recommendation"),
    status: venueIntelligenceStatusEnum("status").notNull().default("available"),
    resolvedAt: timestamp("resolved_at"),
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_anomalies_venue_id_idx").on(table.venueId),
    metricIdx: index("venue_anomalies_metric_key_idx").on(table.metricKey),
    severityIdx: index("venue_anomalies_severity_idx").on(table.severity),
    generatedIdx: index("venue_anomalies_generated_at_idx").on(table.generatedAt),
  })
);

export const venueInsightRecommendations = pgTable(
  "venue_insight_recommendations",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
    runId: integer("run_id").references(() => venueIntelligenceRuns.id, { onDelete: "set null" }),
    recommendationType: venueIntelligenceRecommendationTypeEnum("recommendation_type").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    payloadJson: text("payload_json").notNull().default("{}"),
    actionStatus: venueIntelligenceActionStatusEnum("action_status").notNull().default("proposed"),
    status: venueIntelligenceStatusEnum("status").notNull().default("available"),
    confidenceLevel: venueIntelligenceConfidenceEnum("confidence_level").notNull().default("medium"),
    confidenceScore: real("confidence_score"),
    requiresApproval: boolean("requires_approval").notNull().default(true),
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_insight_recommendations_venue_id_idx").on(table.venueId),
    eventIdx: index("venue_insight_recommendations_event_id_idx").on(table.eventId),
    actionIdx: index("venue_insight_recommendations_action_status_idx").on(table.actionStatus),
    typeIdx: index("venue_insight_recommendations_type_idx").on(table.recommendationType),
  })
);

export const venueInsightFeedback = pgTable(
  "venue_insight_feedback",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    recommendationId: integer("recommendation_id").references(() => venueInsightRecommendations.id, { onDelete: "set null" }),
    submittedByClerkUserId: text("submitted_by_clerk_user_id").notNull(),
    feedbackType: text("feedback_type").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_insight_feedback_venue_id_idx").on(table.venueId),
    recommendationIdx: index("venue_insight_feedback_recommendation_id_idx").on(table.recommendationId),
    typeIdx: index("venue_insight_feedback_feedback_type_idx").on(table.feedbackType),
  })
);

export const venueIntelligenceActions = pgTable(
  "venue_intelligence_actions",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    recommendationId: integer("recommendation_id").references(() => venueInsightRecommendations.id, { onDelete: "set null" }),
    actionType: text("action_type").notNull(),
    status: venueIntelligenceActionStatusEnum("status").notNull().default("proposed"),
    openedByClerkUserId: text("opened_by_clerk_user_id").notNull(),
    confirmedByClerkUserId: text("confirmed_by_clerk_user_id"),
    payloadJson: text("payload_json").notNull().default("{}"),
    resultJson: text("result_json"),
    openedAt: timestamp("opened_at").defaultNow().notNull(),
    appliedAt: timestamp("applied_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_intelligence_actions_venue_id_idx").on(table.venueId),
    recommendationIdx: index("venue_intelligence_actions_recommendation_id_idx").on(table.recommendationId),
    statusIdx: index("venue_intelligence_actions_status_idx").on(table.status),
    typeIdx: index("venue_intelligence_actions_action_type_idx").on(table.actionType),
  })
);

export const venueAiConversations = pgTable(
  "venue_ai_conversations",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    startedByClerkUserId: text("started_by_clerk_user_id").notNull(),
    title: text("title").notNull().default("Ask Nightly for Business"),
    status: venueIntelligenceConversationStatusEnum("status").notNull().default("active"),
    contextJson: text("context_json").notNull().default("{}"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_ai_conversations_venue_id_idx").on(table.venueId),
    userIdx: index("venue_ai_conversations_started_by_clerk_user_id_idx").on(table.startedByClerkUserId),
    statusIdx: index("venue_ai_conversations_status_idx").on(table.status),
  })
);

export const venueAiMessages = pgTable(
  "venue_ai_messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id").notNull().references(() => venueAiConversations.id, { onDelete: "cascade" }),
    role: venueIntelligenceMessageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    structuredPayloadJson: text("structured_payload_json").notNull().default("{}"),
    provenanceJson: text("provenance_json").notNull().default("{}"),
    providerUsed: text("provider_used").notNull().default("deterministic"),
    modelVersion: text("model_version").notNull().default("deterministic-v1"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    conversationIdx: index("venue_ai_messages_conversation_id_idx").on(table.conversationId),
    roleIdx: index("venue_ai_messages_role_idx").on(table.role),
    createdIdx: index("venue_ai_messages_created_at_idx").on(table.createdAt),
  })
);

export const venueBenchmarkSnapshots = pgTable(
  "venue_benchmark_snapshots",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    cohortKey: text("cohort_key").notNull(),
    cohortSize: integer("cohort_size").notNull().default(0),
    metricKey: text("metric_key").notNull(),
    venueValue: real("venue_value"),
    cohortMedian: real("cohort_median"),
    cohortP75: real("cohort_p75"),
    status: venueIntelligenceStatusEnum("status").notNull().default("insufficient_data"),
    methodology: text("methodology").notNull().default("anonymized_internal_aggregate"),
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_benchmark_snapshots_venue_id_idx").on(table.venueId),
    cohortIdx: index("venue_benchmark_snapshots_cohort_key_idx").on(table.cohortKey),
    metricIdx: index("venue_benchmark_snapshots_metric_key_idx").on(table.metricKey),
  })
);

export const venueCampaignDrafts = pgTable(
  "venue_campaign_drafts",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    recommendationId: integer("recommendation_id").references(() => venueInsightRecommendations.id, { onDelete: "set null" }),
    channel: text("channel").notNull(),
    title: text("title").notNull(),
    subject: text("subject"),
    shortCopy: text("short_copy").notNull(),
    longCopy: text("long_copy").notNull(),
    cta: text("cta").notNull(),
    audienceLabel: text("audience_label").notNull(),
    scheduleSuggestion: text("schedule_suggestion"),
    complianceNotes: text("compliance_notes"),
    status: venueIntelligenceActionStatusEnum("status").notNull().default("proposed"),
    requiresApproval: boolean("requires_approval").notNull().default(true),
    createdByClerkUserId: text("created_by_clerk_user_id").notNull(),
    approvedByClerkUserId: text("approved_by_clerk_user_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_campaign_drafts_venue_id_idx").on(table.venueId),
    recommendationIdx: index("venue_campaign_drafts_recommendation_id_idx").on(table.recommendationId),
    statusIdx: index("venue_campaign_drafts_status_idx").on(table.status),
  })
);

export const venuePricingRecommendations = pgTable(
  "venue_pricing_recommendations",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
    runId: integer("run_id").references(() => venueIntelligenceRuns.id, { onDelete: "set null" }),
    productType: text("product_type").notNull(),
    productRefId: integer("product_ref_id"),
    currentPriceCents: integer("current_price_cents"),
    suggestedLowCents: integer("suggested_low_cents"),
    suggestedHighCents: integer("suggested_high_cents"),
    rationale: text("rationale").notNull(),
    riskLabel: text("risk_label").notNull().default("medium"),
    confidenceLevel: venueIntelligenceConfidenceEnum("confidence_level").notNull().default("medium"),
    status: venueIntelligenceStatusEnum("status").notNull().default("available"),
    effectiveWindowStart: timestamp("effective_window_start"),
    effectiveWindowEnd: timestamp("effective_window_end"),
    requiresApproval: boolean("requires_approval").notNull().default(true),
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
  },
  (table) => ({
    venueIdx: index("venue_pricing_recommendations_venue_id_idx").on(table.venueId),
    eventIdx: index("venue_pricing_recommendations_event_id_idx").on(table.eventId),
    productTypeIdx: index("venue_pricing_recommendations_product_type_idx").on(table.productType),
    generatedIdx: index("venue_pricing_recommendations_generated_at_idx").on(table.generatedAt),
  })
);

export const adminAssignmentStatusEnum = pgEnum("admin_assignment_status", [
  "active",
  "expired",
  "revoked",
]);

export const adminCaseCategoryEnum = pgEnum("admin_case_category", [
  "support",
  "refund",
  "dispute",
  "fraud",
  "moderation",
  "venue_claim",
  "privacy",
  "billing",
  "technical",
  "safety",
]);

export const adminCasePriorityEnum = pgEnum("admin_case_priority", ["low", "medium", "high", "critical"]);

export const adminCaseStatusEnum = pgEnum("admin_case_status", [
  "open",
  "pending_user",
  "pending_internal",
  "escalated",
  "resolved",
  "closed",
  "reopened",
]);

export const moderationReportStatusEnum = pgEnum("moderation_report_status", [
  "open",
  "in_review",
  "resolved",
  "dismissed",
  "appealed",
]);

export const moderationDecisionEnum = pgEnum("moderation_decision", [
  "no_action",
  "warning",
  "content_removed",
  "content_hidden",
  "feature_restricted",
  "temporary_suspension",
  "permanent_suspension",
  "venue_suspension",
  "dj_suspension",
  "escalation_required",
]);

export const fraudCaseStatusEnum = pgEnum("fraud_case_status", [
  "open",
  "triaged",
  "investigating",
  "escalated",
  "resolved",
  "dismissed",
  "monitoring",
]);

export const fraudSeverityEnum = pgEnum("fraud_severity", ["low", "medium", "high", "critical"]);

export const fraudSignalSourceEnum = pgEnum("fraud_signal_source", [
  "payments",
  "ticketing",
  "bookings",
  "social",
  "venue_claim",
  "webhook",
  "manual",
  "system",
]);

export const platformFlagScopeEnum = pgEnum("platform_flag_scope", [
  "global",
  "environment",
  "role",
  "user",
  "venue",
  "city",
  "percentage",
]);

export const platformJobStatusEnum = pgEnum("platform_job_status", [
  "enabled",
  "disabled",
  "paused",
]);

export const platformJobRunStatusEnum = pgEnum("platform_job_run_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
  "skipped",
]);

export const providerHealthStatusEnum = pgEnum("provider_health_status", [
  "healthy",
  "degraded",
  "down",
  "not_configured",
  "unknown",
]);

export const announcementStatusEnum = pgEnum("announcement_status", [
  "draft",
  "scheduled",
  "published",
  "withdrawn",
  "expired",
]);

export const adminExportStatusEnum = pgEnum("admin_export_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "expired",
]);

export const privacyRequestTypeEnum = pgEnum("privacy_request_type", [
  "access",
  "correction",
  "deletion",
  "restriction",
  "consent",
]);

export const privacyRequestStatusEnum = pgEnum("privacy_request_status", [
  "open",
  "pending_identity",
  "in_review",
  "approved",
  "rejected",
  "completed",
]);

export const impersonationStatusEnum = pgEnum("impersonation_status", [
  "active",
  "ended",
  "revoked",
  "expired",
]);

export const adminRoles = pgTable(
  "admin_roles",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull().unique(),
    label: text("label").notNull(),
    description: text("description"),
    isSystem: boolean("is_system").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    keyIdx: index("admin_roles_key_idx").on(table.key),
  })
);

export const adminRolePermissions = pgTable(
  "admin_role_permissions",
  {
    id: serial("id").primaryKey(),
    roleId: integer("role_id").notNull().references(() => adminRoles.id, { onDelete: "cascade" }),
    permission: text("permission").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    roleIdx: index("admin_role_permissions_role_id_idx").on(table.roleId),
    permissionIdx: index("admin_role_permissions_permission_idx").on(table.permission),
    rolePermissionUnique: unique("admin_role_permissions_role_permission_unique").on(table.roleId, table.permission),
  })
);

export const adminAssignments = pgTable(
  "admin_assignments",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    roleId: integer("role_id").notNull().references(() => adminRoles.id, { onDelete: "restrict" }),
    status: adminAssignmentStatusEnum("status").notNull().default("active"),
    assignedByClerkUserId: text("assigned_by_clerk_user_id").notNull(),
    reason: text("reason").notNull(),
    startsAt: timestamp("starts_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
    revokedAt: timestamp("revoked_at"),
    revokedByClerkUserId: text("revoked_by_clerk_user_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    clerkIdx: index("admin_assignments_clerk_user_id_idx").on(table.clerkUserId),
    roleIdx: index("admin_assignments_role_id_idx").on(table.roleId),
    statusIdx: index("admin_assignments_status_idx").on(table.status),
  })
);

export const adminCases = pgTable(
  "admin_cases",
  {
    id: serial("id").primaryKey(),
    caseNumber: text("case_number").notNull().unique(),
    category: adminCaseCategoryEnum("category").notNull(),
    priority: adminCasePriorityEnum("priority").notNull().default("medium"),
    status: adminCaseStatusEnum("status").notNull().default("open"),
    subject: text("subject").notNull(),
    description: text("description"),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    venueId: integer("venue_id").references(() => venues.id, { onDelete: "set null" }),
    djProfileId: integer("dj_profile_id").references(() => djProfiles.id, { onDelete: "set null" }),
    eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
    bookingId: integer("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    orderId: integer("order_id").references(() => ticketOrders.id, { onDelete: "set null" }),
    assignedToClerkUserId: text("assigned_to_clerk_user_id"),
    openedByClerkUserId: text("opened_by_clerk_user_id").notNull(),
    resolvedByClerkUserId: text("resolved_by_clerk_user_id"),
    slaDueAt: timestamp("sla_due_at"),
    resolution: text("resolution"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => ({
    numberIdx: index("admin_cases_case_number_idx").on(table.caseNumber),
    categoryIdx: index("admin_cases_category_idx").on(table.category),
    statusIdx: index("admin_cases_status_idx").on(table.status),
    assigneeIdx: index("admin_cases_assigned_to_clerk_user_id_idx").on(table.assignedToClerkUserId),
    venueIdx: index("admin_cases_venue_id_idx").on(table.venueId),
    userIdx: index("admin_cases_user_id_idx").on(table.userId),
  })
);

export const adminCaseEvents = pgTable(
  "admin_case_events",
  {
    id: serial("id").primaryKey(),
    caseId: integer("case_id").notNull().references(() => adminCases.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    actorClerkUserId: text("actor_clerk_user_id").notNull(),
    reason: text("reason"),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    caseIdx: index("admin_case_events_case_id_idx").on(table.caseId),
    typeIdx: index("admin_case_events_event_type_idx").on(table.eventType),
    createdIdx: index("admin_case_events_created_at_idx").on(table.createdAt),
  })
);

export const adminInternalNotes = pgTable(
  "admin_internal_notes",
  {
    id: serial("id").primaryKey(),
    caseId: integer("case_id").references(() => adminCases.id, { onDelete: "cascade" }),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    note: text("note").notNull(),
    visibility: text("visibility").notNull().default("internal"),
    createdByClerkUserId: text("created_by_clerk_user_id").notNull(),
    taggedStaffJson: text("tagged_staff_json").notNull().default("[]"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    caseIdx: index("admin_internal_notes_case_id_idx").on(table.caseId),
    resourceIdx: index("admin_internal_notes_resource_idx").on(table.resourceType, table.resourceId),
    creatorIdx: index("admin_internal_notes_created_by_idx").on(table.createdByClerkUserId),
  })
);

export const moderationReports = pgTable(
  "moderation_reports",
  {
    id: serial("id").primaryKey(),
    queue: text("queue").notNull().default("general"),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    reporterUserId: integer("reporter_user_id").references(() => users.id, { onDelete: "set null" }),
    reason: text("reason").notNull(),
    details: text("details"),
    evidenceJson: text("evidence_json").notNull().default("[]"),
    severity: adminCasePriorityEnum("severity").notNull().default("medium"),
    status: moderationReportStatusEnum("status").notNull().default("open"),
    assignedModeratorClerkUserId: text("assigned_moderator_clerk_user_id"),
    isReporterIdentityRestricted: boolean("is_reporter_identity_restricted").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => ({
    queueIdx: index("moderation_reports_queue_idx").on(table.queue),
    statusIdx: index("moderation_reports_status_idx").on(table.status),
    resourceIdx: index("moderation_reports_resource_idx").on(table.resourceType, table.resourceId),
    assigneeIdx: index("moderation_reports_assigned_moderator_idx").on(table.assignedModeratorClerkUserId),
  })
);

export const moderationActions = pgTable(
  "moderation_actions",
  {
    id: serial("id").primaryKey(),
    reportId: integer("report_id").notNull().references(() => moderationReports.id, { onDelete: "cascade" }),
    decision: moderationDecisionEnum("decision").notNull(),
    enforcementScope: text("enforcement_scope").notNull(),
    actorClerkUserId: text("actor_clerk_user_id").notNull(),
    reason: text("reason").notNull(),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    reportIdx: index("moderation_actions_report_id_idx").on(table.reportId),
    decisionIdx: index("moderation_actions_decision_idx").on(table.decision),
  })
);

export const moderationAppeals = pgTable(
  "moderation_appeals",
  {
    id: serial("id").primaryKey(),
    reportId: integer("report_id").notNull().references(() => moderationReports.id, { onDelete: "cascade" }),
    submittedByUserId: integer("submitted_by_user_id").references(() => users.id, { onDelete: "set null" }),
    reason: text("reason").notNull(),
    status: adminCaseStatusEnum("status").notNull().default("open"),
    reviewedByClerkUserId: text("reviewed_by_clerk_user_id"),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    reportIdx: index("moderation_appeals_report_id_idx").on(table.reportId),
    statusIdx: index("moderation_appeals_status_idx").on(table.status),
  })
);

export const fraudCases = pgTable(
  "fraud_cases",
  {
    id: serial("id").primaryKey(),
    caseNumber: text("case_number").notNull().unique(),
    severity: fraudSeverityEnum("severity").notNull().default("medium"),
    status: fraudCaseStatusEnum("status").notNull().default("open"),
    assignedReviewerClerkUserId: text("assigned_reviewer_clerk_user_id"),
    summary: text("summary").notNull(),
    userImpact: text("user_impact"),
    venueImpact: text("venue_impact"),
    financialImpactCents: integer("financial_impact_cents").notNull().default(0),
    openedByClerkUserId: text("opened_by_clerk_user_id").notNull(),
    resolvedByClerkUserId: text("resolved_by_clerk_user_id"),
    resolution: text("resolution"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => ({
    numberIdx: index("fraud_cases_case_number_idx").on(table.caseNumber),
    severityIdx: index("fraud_cases_severity_idx").on(table.severity),
    statusIdx: index("fraud_cases_status_idx").on(table.status),
    reviewerIdx: index("fraud_cases_assigned_reviewer_idx").on(table.assignedReviewerClerkUserId),
  })
);

export const fraudSignals = pgTable(
  "fraud_signals",
  {
    id: serial("id").primaryKey(),
    fraudCaseId: integer("fraud_case_id").references(() => fraudCases.id, { onDelete: "set null" }),
    source: fraudSignalSourceEnum("source").notNull(),
    signalType: text("signal_type").notNull(),
    severity: fraudSeverityEnum("severity").notNull().default("medium"),
    score: real("score"),
    evidenceJson: text("evidence_json").notNull().default("{}"),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    venueId: integer("venue_id").references(() => venues.id, { onDelete: "set null" }),
    eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
    bookingId: integer("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    orderId: integer("order_id").references(() => ticketOrders.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    caseIdx: index("fraud_signals_fraud_case_id_idx").on(table.fraudCaseId),
    sourceIdx: index("fraud_signals_source_idx").on(table.source),
    typeIdx: index("fraud_signals_signal_type_idx").on(table.signalType),
    severityIdx: index("fraud_signals_severity_idx").on(table.severity),
  })
);

export const fraudCaseEvents = pgTable(
  "fraud_case_events",
  {
    id: serial("id").primaryKey(),
    fraudCaseId: integer("fraud_case_id").notNull().references(() => fraudCases.id, { onDelete: "cascade" }),
    actorClerkUserId: text("actor_clerk_user_id").notNull(),
    eventType: text("event_type").notNull(),
    reason: text("reason"),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    caseIdx: index("fraud_case_events_fraud_case_id_idx").on(table.fraudCaseId),
    typeIdx: index("fraud_case_events_event_type_idx").on(table.eventType),
    createdIdx: index("fraud_case_events_created_at_idx").on(table.createdAt),
  })
);

export const supportCases = pgTable(
  "support_cases",
  {
    id: serial("id").primaryKey(),
    caseNumber: text("case_number").notNull().unique(),
    category: adminCaseCategoryEnum("category").notNull(),
    priority: adminCasePriorityEnum("priority").notNull().default("medium"),
    status: adminCaseStatusEnum("status").notNull().default("open"),
    subject: text("subject").notNull(),
    description: text("description"),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    venueId: integer("venue_id").references(() => venues.id, { onDelete: "set null" }),
    djProfileId: integer("dj_profile_id").references(() => djProfiles.id, { onDelete: "set null" }),
    eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
    bookingId: integer("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    orderId: integer("order_id").references(() => ticketOrders.id, { onDelete: "set null" }),
    ticketId: integer("ticket_id").references(() => tickets.id, { onDelete: "set null" }),
    assignedAgentClerkUserId: text("assigned_agent_clerk_user_id"),
    openedByClerkUserId: text("opened_by_clerk_user_id").notNull(),
    internalNotesJson: text("internal_notes_json").notNull().default("[]"),
    timelineJson: text("timeline_json").notNull().default("[]"),
    resolution: text("resolution"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => ({
    numberIdx: index("support_cases_case_number_idx").on(table.caseNumber),
    categoryIdx: index("support_cases_category_idx").on(table.category),
    statusIdx: index("support_cases_status_idx").on(table.status),
    agentIdx: index("support_cases_assigned_agent_idx").on(table.assignedAgentClerkUserId),
  })
);

export const supportCaseEvents = pgTable(
  "support_case_events",
  {
    id: serial("id").primaryKey(),
    supportCaseId: integer("support_case_id").notNull().references(() => supportCases.id, { onDelete: "cascade" }),
    actorClerkUserId: text("actor_clerk_user_id").notNull(),
    eventType: text("event_type").notNull(),
    reason: text("reason"),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    caseIdx: index("support_case_events_support_case_id_idx").on(table.supportCaseId),
    typeIdx: index("support_case_events_event_type_idx").on(table.eventType),
  })
);

export const platformFeatureFlags = pgTable(
  "platform_feature_flags",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull().unique(),
    description: text("description"),
    enabled: boolean("enabled").notNull().default(false),
    rolloutPercentage: integer("rollout_percentage").notNull().default(0),
    environment: text("environment").notNull().default("production"),
    scheduledAt: timestamp("scheduled_at"),
    expiresAt: timestamp("expires_at"),
    killSwitch: boolean("kill_switch").notNull().default(false),
    metadataJson: text("metadata_json").notNull().default("{}"),
    updatedByClerkUserId: text("updated_by_clerk_user_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    keyIdx: index("platform_feature_flags_key_idx").on(table.key),
    envIdx: index("platform_feature_flags_environment_idx").on(table.environment),
  })
);

export const platformFeatureFlagOverrides = pgTable(
  "platform_feature_flag_overrides",
  {
    id: serial("id").primaryKey(),
    flagId: integer("flag_id").notNull().references(() => platformFeatureFlags.id, { onDelete: "cascade" }),
    scope: platformFlagScopeEnum("scope").notNull(),
    scopeValue: text("scope_value").notNull(),
    enabled: boolean("enabled").notNull(),
    reason: text("reason").notNull(),
    createdByClerkUserId: text("created_by_clerk_user_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    flagIdx: index("platform_feature_flag_overrides_flag_id_idx").on(table.flagId),
    scopeIdx: index("platform_feature_flag_overrides_scope_idx").on(table.scope, table.scopeValue),
  })
);

export const platformFeatureFlagHistory = pgTable(
  "platform_feature_flag_history",
  {
    id: serial("id").primaryKey(),
    flagId: integer("flag_id").notNull().references(() => platformFeatureFlags.id, { onDelete: "cascade" }),
    actorClerkUserId: text("actor_clerk_user_id").notNull(),
    action: text("action").notNull(),
    reason: text("reason").notNull(),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    flagIdx: index("platform_feature_flag_history_flag_id_idx").on(table.flagId),
    actionIdx: index("platform_feature_flag_history_action_idx").on(table.action),
  })
);

export const platformHealthChecks = pgTable(
  "platform_health_checks",
  {
    id: serial("id").primaryKey(),
    component: text("component").notNull(),
    status: providerHealthStatusEnum("status").notNull().default("unknown"),
    latencyMs: integer("latency_ms"),
    message: text("message"),
    checkedAt: timestamp("checked_at").defaultNow().notNull(),
    metadataJson: text("metadata_json").notNull().default("{}"),
  },
  (table) => ({
    componentIdx: index("platform_health_checks_component_idx").on(table.component),
    statusIdx: index("platform_health_checks_status_idx").on(table.status),
    checkedAtIdx: index("platform_health_checks_checked_at_idx").on(table.checkedAt),
  })
);

export const platformProviderHealth = pgTable(
  "platform_provider_health",
  {
    id: serial("id").primaryKey(),
    providerKey: text("provider_key").notNull(),
    status: providerHealthStatusEnum("status").notNull().default("unknown"),
    details: text("details"),
    lastSuccessAt: timestamp("last_success_at"),
    lastFailureAt: timestamp("last_failure_at"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    providerKeyUnique: unique("platform_provider_health_provider_key_unique").on(table.providerKey),
    statusIdx: index("platform_provider_health_status_idx").on(table.status),
  })
);

export const platformJobs = pgTable(
  "platform_jobs",
  {
    id: serial("id").primaryKey(),
    jobKey: text("job_key").notNull().unique(),
    label: text("label").notNull(),
    description: text("description"),
    scheduleCron: text("schedule_cron"),
    status: platformJobStatusEnum("status").notNull().default("enabled"),
    supportsDryRun: boolean("supports_dry_run").notNull().default(true),
    adapterReady: boolean("adapter_ready").notNull().default(false),
    lastRunAt: timestamp("last_run_at"),
    nextRunAt: timestamp("next_run_at"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    keyIdx: index("platform_jobs_job_key_idx").on(table.jobKey),
    statusIdx: index("platform_jobs_status_idx").on(table.status),
  })
);

export const platformJobRuns = pgTable(
  "platform_job_runs",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id").notNull().references(() => platformJobs.id, { onDelete: "cascade" }),
    status: platformJobRunStatusEnum("status").notNull().default("queued"),
    trigger: text("trigger").notNull().default("scheduled"),
    idempotencyKey: text("idempotency_key"),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    durationMs: integer("duration_ms"),
    attempts: integer("attempts").notNull().default(0),
    failureReason: text("failure_reason"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    jobIdx: index("platform_job_runs_job_id_idx").on(table.jobId),
    statusIdx: index("platform_job_runs_status_idx").on(table.status),
    startedIdx: index("platform_job_runs_started_at_idx").on(table.startedAt),
  })
);

export const platformAnnouncements = pgTable(
  "platform_announcements",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    audienceScope: text("audience_scope").notNull(),
    audienceFilterJson: text("audience_filter_json").notNull().default("{}"),
    priority: adminCasePriorityEnum("priority").notNull().default("medium"),
    status: announcementStatusEnum("status").notNull().default("draft"),
    requiresAcknowledgment: boolean("requires_acknowledgment").notNull().default(false),
    channelsJson: text("channels_json").notNull().default("[]"),
    scheduledAt: timestamp("scheduled_at"),
    publishedAt: timestamp("published_at"),
    expiresAt: timestamp("expires_at"),
    createdByClerkUserId: text("created_by_clerk_user_id").notNull(),
    approvedByClerkUserId: text("approved_by_clerk_user_id"),
    withdrawnAt: timestamp("withdrawn_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index("platform_announcements_status_idx").on(table.status),
    audienceIdx: index("platform_announcements_audience_scope_idx").on(table.audienceScope),
    scheduleIdx: index("platform_announcements_scheduled_at_idx").on(table.scheduledAt),
  })
);

export const adminExportJobs = pgTable(
  "admin_export_jobs",
  {
    id: serial("id").primaryKey(),
    exportType: text("export_type").notNull(),
    scopeJson: text("scope_json").notNull().default("{}"),
    status: adminExportStatusEnum("status").notNull().default("queued"),
    requestedByClerkUserId: text("requested_by_clerk_user_id").notNull(),
    reason: text("reason").notNull(),
    fileUrl: text("file_url"),
    expiresAt: timestamp("expires_at"),
    rowCount: integer("row_count"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    typeIdx: index("admin_export_jobs_export_type_idx").on(table.exportType),
    statusIdx: index("admin_export_jobs_status_idx").on(table.status),
    requesterIdx: index("admin_export_jobs_requested_by_idx").on(table.requestedByClerkUserId),
  })
);

export const privacyRequests = pgTable(
  "privacy_requests",
  {
    id: serial("id").primaryKey(),
    requestType: privacyRequestTypeEnum("request_type").notNull(),
    status: privacyRequestStatusEnum("status").notNull().default("open"),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    venueId: integer("venue_id").references(() => venues.id, { onDelete: "set null" }),
    requestPayloadJson: text("request_payload_json").notNull().default("{}"),
    legalReviewRequired: boolean("legal_review_required").notNull().default(false),
    reviewedByClerkUserId: text("reviewed_by_clerk_user_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    typeIdx: index("privacy_requests_request_type_idx").on(table.requestType),
    statusIdx: index("privacy_requests_status_idx").on(table.status),
    userIdx: index("privacy_requests_user_id_idx").on(table.userId),
  })
);

export const adminImpersonationSessions = pgTable(
  "admin_impersonation_sessions",
  {
    id: serial("id").primaryKey(),
    adminClerkUserId: text("admin_clerk_user_id").notNull(),
    targetClerkUserId: text("target_clerk_user_id").notNull(),
    reason: text("reason").notNull(),
    status: impersonationStatusEnum("status").notNull().default("active"),
    readOnly: boolean("read_only").notNull().default(true),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    endedAt: timestamp("ended_at"),
    endedByClerkUserId: text("ended_by_clerk_user_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    adminIdx: index("admin_impersonation_sessions_admin_idx").on(table.adminClerkUserId),
    targetIdx: index("admin_impersonation_sessions_target_idx").on(table.targetClerkUserId),
    statusIdx: index("admin_impersonation_sessions_status_idx").on(table.status),
  })
);

export const adminAuditEvents = pgTable(
  "admin_audit_events",
  {
    id: serial("id").primaryKey(),
    actorClerkUserId: text("actor_clerk_user_id").notNull(),
    actorRole: text("actor_role"),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    scope: text("scope").notNull(),
    reason: text("reason").notNull(),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    correlationId: text("correlation_id"),
    relatedCaseId: integer("related_case_id").references(() => adminCases.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    actorIdx: index("admin_audit_events_actor_idx").on(table.actorClerkUserId),
    actionIdx: index("admin_audit_events_action_idx").on(table.action),
    resourceIdx: index("admin_audit_events_resource_idx").on(table.resourceType, table.resourceId),
    createdAtIdx: index("admin_audit_events_created_at_idx").on(table.createdAt),
  })
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: serial("id").primaryKey(),
    provider: text("provider").notNull(),
    externalEventId: text("external_event_id").notNull(),
    eventType: text("event_type").notNull(),
    status: text("status").notNull().default("received"),
    signatureVerified: boolean("signature_verified").notNull().default(false),
    receivedAt: timestamp("received_at").notNull().defaultNow(),
    processedAt: timestamp("processed_at"),
    attempts: integer("attempts").notNull().default(1),
    lastError: text("last_error"),
    payloadJson: text("payload_json"),
    metadataJson: text("metadata_json").notNull().default("{}"),
  },
  (table) => ({
    providerEventUnique: unique("webhook_deliveries_provider_event_unique").on(
      table.provider,
      table.externalEventId
    ),
    statusIdx: index("webhook_deliveries_status_idx").on(table.status),
    receivedAtIdx: index("webhook_deliveries_received_at_idx").on(table.receivedAt),
  })
);

export const platformJobLocks = pgTable(
  "platform_job_locks",
  {
    id: serial("id").primaryKey(),
    jobKey: text("job_key").notNull(),
    lockToken: text("lock_token").notNull().unique(),
    correlationId: text("correlation_id"),
    acquiredAt: timestamp("acquired_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
    releasedAt: timestamp("released_at"),
    releasedBy: text("released_by"),
    metadataJson: text("metadata_json").notNull().default("{}"),
  },
  (table) => ({
    jobKeyIdx: index("platform_job_locks_job_key_idx").on(table.jobKey),
    expiresIdx: index("platform_job_locks_expires_at_idx").on(table.expiresAt),
  })
);

export const platformReleaseRecords = pgTable(
  "platform_release_records",
  {
    id: serial("id").primaryKey(),
    version: text("version").notNull(),
    commitHash: text("commit_hash").notNull(),
    environment: text("environment").notNull(),
    migrationStatus: text("migration_status").notNull(),
    featureFlagSnapshotJson: text("feature_flag_snapshot_json").notNull().default("{}"),
    providerStatusJson: text("provider_status_json").notNull().default("{}"),
    knownIssuesJson: text("known_issues_json").notNull().default("[]"),
    smokeTestStatus: text("smoke_test_status").notNull().default("unknown"),
    goNoGo: text("go_no_go").notNull().default("unknown"),
    approvedByClerkUserId: text("approved_by_clerk_user_id"),
    rollbackInstructions: text("rollback_instructions"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    envIdx: index("platform_release_records_environment_idx").on(table.environment),
    createdAtIdx: index("platform_release_records_created_at_idx").on(table.createdAt),
  })
);

export const platformSmokeTestRuns = pgTable(
  "platform_smoke_test_runs",
  {
    id: serial("id").primaryKey(),
    environment: text("environment").notNull(),
    baseUrl: text("base_url").notNull(),
    status: text("status").notNull().default("running"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
    resultJson: text("result_json").notNull().default("{}"),
    initiatedByClerkUserId: text("initiated_by_clerk_user_id"),
  },
  (table) => ({
    envIdx: index("platform_smoke_test_runs_environment_idx").on(table.environment),
    statusIdx: index("platform_smoke_test_runs_status_idx").on(table.status),
    startedIdx: index("platform_smoke_test_runs_started_at_idx").on(table.startedAt),
  })
);

export const platformIncidents = pgTable(
  "platform_incidents",
  {
    id: serial("id").primaryKey(),
    incidentKey: text("incident_key").notNull().unique(),
    category: text("category").notNull(),
    severity: text("severity").notNull(),
    status: text("status").notNull().default("open"),
    title: text("title").notNull(),
    impactSummary: text("impact_summary").notNull(),
    commanderClerkUserId: text("commander_clerk_user_id"),
    affectedServicesJson: text("affected_services_json").notNull().default("[]"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at"),
    postmortemUrl: text("postmortem_url"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    severityIdx: index("platform_incidents_severity_idx").on(table.severity),
    statusIdx: index("platform_incidents_status_idx").on(table.status),
    startedIdx: index("platform_incidents_started_at_idx").on(table.startedAt),
  })
);

export const platformIncidentEvents = pgTable(
  "platform_incident_events",
  {
    id: serial("id").primaryKey(),
    incidentId: integer("incident_id").notNull().references(() => platformIncidents.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    message: text("message").notNull(),
    actorClerkUserId: text("actor_clerk_user_id"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    incidentIdx: index("platform_incident_events_incident_id_idx").on(table.incidentId),
    createdIdx: index("platform_incident_events_created_at_idx").on(table.createdAt),
  })
);

export const platformBetaCohorts = pgTable(
  "platform_beta_cohorts",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull().unique(),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"),
    audienceType: text("audience_type").notNull(),
    environment: text("environment").notNull().default("development"),
    rolloutPercentage: integer("rollout_percentage").notNull().default(0),
    inviteCode: text("invite_code"),
    allowlistJson: text("allowlist_json").notNull().default("[]"),
    denylistJson: text("denylist_json").notNull().default("[]"),
    startsAt: timestamp("starts_at"),
    expiresAt: timestamp("expires_at"),
    agreementRequired: boolean("agreement_required").notNull().default(false),
    createdByClerkUserId: text("created_by_clerk_user_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    keyIdx: index("platform_beta_cohorts_key_idx").on(table.key),
    statusIdx: index("platform_beta_cohorts_status_idx").on(table.status),
  })
);

export const platformBetaMembers = pgTable(
  "platform_beta_members",
  {
    id: serial("id").primaryKey(),
    cohortId: integer("cohort_id").notNull().references(() => platformBetaCohorts.id, { onDelete: "cascade" }),
    memberType: text("member_type").notNull(),
    memberKey: text("member_key").notNull(),
    role: text("role"),
    city: text("city"),
    venueId: integer("venue_id").references(() => venues.id, { onDelete: "set null" }),
    acceptedAgreementAt: timestamp("accepted_agreement_at"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    cohortIdx: index("platform_beta_members_cohort_id_idx").on(table.cohortId),
    memberIdx: index("platform_beta_members_member_key_idx").on(table.memberKey),
    uniqueMember: unique("platform_beta_members_unique_member").on(table.cohortId, table.memberType, table.memberKey),
  })
);

export const platformFeedback = pgTable(
  "platform_feedback",
  {
    id: serial("id").primaryKey(),
    category: text("category").notNull(),
    severity: text("severity").notNull().default("medium"),
    status: text("status").notNull().default("open"),
    route: text("route"),
    appVersion: text("app_version"),
    environment: text("environment").notNull().default("development"),
    userRole: text("user_role"),
    deviceCategory: text("device_category"),
    summary: text("summary").notNull(),
    reproductionSteps: text("reproduction_steps"),
    screenshotUrl: text("screenshot_url"),
    consentToContact: boolean("consent_to_contact").notNull().default(false),
    submittedByClerkUserId: text("submitted_by_clerk_user_id"),
    assignedToClerkUserId: text("assigned_to_clerk_user_id"),
    internalNote: text("internal_note"),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    categoryIdx: index("platform_feedback_category_idx").on(table.category),
    severityIdx: index("platform_feedback_severity_idx").on(table.severity),
    statusIdx: index("platform_feedback_status_idx").on(table.status),
    createdIdx: index("platform_feedback_created_at_idx").on(table.createdAt),
  })
);

export const platformSecurityEvents = pgTable(
  "platform_security_events",
  {
    id: serial("id").primaryKey(),
    eventType: text("event_type").notNull(),
    severity: text("severity").notNull(),
    actorClerkUserId: text("actor_clerk_user_id"),
    relatedResourceType: text("related_resource_type"),
    relatedResourceId: text("related_resource_id"),
    status: text("status").notNull().default("open"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    occurredAt: timestamp("occurred_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    eventIdx: index("platform_security_events_event_type_idx").on(table.eventType),
    severityIdx: index("platform_security_events_severity_idx").on(table.severity),
    statusIdx: index("platform_security_events_status_idx").on(table.status),
  })
);

export const platformDataRetentionRuns = pgTable(
  "platform_data_retention_runs",
  {
    id: serial("id").primaryKey(),
    policyKey: text("policy_key").notNull(),
    dryRun: boolean("dry_run").notNull().default(true),
    status: text("status").notNull().default("queued"),
    deletedRows: integer("deleted_rows").notNull().default(0),
    protectedRows: integer("protected_rows").notNull().default(0),
    detailsJson: text("details_json").notNull().default("{}"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    policyIdx: index("platform_data_retention_runs_policy_key_idx").on(table.policyKey),
    statusIdx: index("platform_data_retention_runs_status_idx").on(table.status),
  })
);

export const platformBackupVerifications = pgTable(
  "platform_backup_verifications",
  {
    id: serial("id").primaryKey(),
    environment: text("environment").notNull(),
    backupReference: text("backup_reference").notNull(),
    status: text("status").notNull(),
    verifiedAt: timestamp("verified_at").notNull().defaultNow(),
    verifiedByClerkUserId: text("verified_by_clerk_user_id"),
    notes: text("notes"),
  },
  (table) => ({
    envIdx: index("platform_backup_verifications_environment_idx").on(table.environment),
    statusIdx: index("platform_backup_verifications_status_idx").on(table.status),
  })
);

export const platformEnvironmentChecks = pgTable(
  "platform_environment_checks",
  {
    id: serial("id").primaryKey(),
    environment: text("environment").notNull(),
    status: text("status").notNull(),
    missingRequiredJson: text("missing_required_json").notNull().default("[]"),
    checksJson: text("checks_json").notNull().default("{}"),
    checkedAt: timestamp("checked_at").notNull().defaultNow(),
    checkedBy: text("checked_by").notNull().default("system"),
  },
  (table) => ({
    envIdx: index("platform_environment_checks_environment_idx").on(table.environment),
    checkedIdx: index("platform_environment_checks_checked_at_idx").on(table.checkedAt),
  })
);

export const platformLaunchReadinessSnapshots = pgTable(
  "platform_launch_readiness_snapshots",
  {
    id: serial("id").primaryKey(),
    environment: text("environment").notNull(),
    goNoGo: text("go_no_go").notNull().default("unknown"),
    score: integer("score").notNull().default(0),
    summaryJson: text("summary_json").notNull().default("{}"),
    generatedAt: timestamp("generated_at").notNull().defaultNow(),
    generatedBy: text("generated_by").notNull().default("system"),
  },
  (table) => ({
    envIdx: index("platform_launch_readiness_snapshots_environment_idx").on(table.environment),
    generatedIdx: index("platform_launch_readiness_snapshots_generated_at_idx").on(table.generatedAt),
  })
);
