DO $$ BEGIN
  CREATE TYPE "event_lifecycle_status" AS ENUM (
    'draft',
    'scheduled',
    'published',
    'live',
    'completed',
    'cancelled',
    'archived'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "events"
ADD COLUMN IF NOT EXISTS "subtitle" text,
ADD COLUMN IF NOT EXISTS "gallery_images_json" text,
ADD COLUMN IF NOT EXISTS "flyer_image_urls_json" text,
ADD COLUMN IF NOT EXISTS "promo_video_urls_json" text,
ADD COLUMN IF NOT EXISTS "imported_venue_image_urls_json" text,
ADD COLUMN IF NOT EXISTS "owner_uploaded_image_urls_json" text,
ADD COLUMN IF NOT EXISTS "table_reservation_url" text,
ADD COLUMN IF NOT EXISTS "vip_reservation_url" text,
ADD COLUMN IF NOT EXISTS "bottle_service_url" text,
ADD COLUMN IF NOT EXISTS "rsvp_url" text,
ADD COLUMN IF NOT EXISTS "recurrence_type" text,
ADD COLUMN IF NOT EXISTS "recurrence_interval" integer,
ADD COLUMN IF NOT EXISTS "recurrence_weekdays_json" text,
ADD COLUMN IF NOT EXISTS "recurrence_day_of_month" integer,
ADD COLUMN IF NOT EXISTS "recurrence_ends_at" timestamp,
ADD COLUMN IF NOT EXISTS "recurrence_exception_dates_json" text,
ADD COLUMN IF NOT EXISTS "recurrence_holiday_overrides_json" text,
ADD COLUMN IF NOT EXISTS "capacity" integer,
ADD COLUMN IF NOT EXISTS "doors_open_at" timestamp,
ADD COLUMN IF NOT EXISTS "visibility" text NOT NULL DEFAULT 'public',
ADD COLUMN IF NOT EXISTS "is_recurring" boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "lifecycle_status" "event_lifecycle_status" NOT NULL DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS "scheduled_for" timestamp,
ADD COLUMN IF NOT EXISTS "published_at" timestamp,
ADD COLUMN IF NOT EXISTS "completed_at" timestamp,
ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp,
ADD COLUMN IF NOT EXISTS "archived_at" timestamp;

CREATE INDEX IF NOT EXISTS "events_lifecycle_status_idx" ON "events" ("lifecycle_status");

CREATE TABLE IF NOT EXISTS "event_lineup" (
  "id" serial PRIMARY KEY NOT NULL,
  "event_id" integer NOT NULL,
  "dj_profile_id" integer,
  "guest_dj_name" text,
  "performance_starts_at" timestamp,
  "performance_ends_at" timestamp,
  "is_featured_dj" boolean DEFAULT false NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "event_lineup" ADD CONSTRAINT "event_lineup_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
 ALTER TABLE "event_lineup" ADD CONSTRAINT "event_lineup_dj_profile_id_dj_profiles_id_fk" FOREIGN KEY ("dj_profile_id") REFERENCES "public"."dj_profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "event_lineup_event_id_idx" ON "event_lineup" ("event_id");
CREATE INDEX IF NOT EXISTS "event_lineup_dj_profile_id_idx" ON "event_lineup" ("dj_profile_id");

CREATE TABLE IF NOT EXISTS "event_recurrence_instances" (
  "id" serial PRIMARY KEY NOT NULL,
  "source_event_id" integer NOT NULL,
  "instance_event_id" integer NOT NULL,
  "occurrence_date" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "event_recurrence_instances_source_occurrence_unique" UNIQUE("source_event_id", "occurrence_date")
);

DO $$ BEGIN
 ALTER TABLE "event_recurrence_instances" ADD CONSTRAINT "event_recurrence_instances_source_event_id_events_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
 ALTER TABLE "event_recurrence_instances" ADD CONSTRAINT "event_recurrence_instances_instance_event_id_events_id_fk" FOREIGN KEY ("instance_event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "event_recurrence_instances_source_event_id_idx" ON "event_recurrence_instances" ("source_event_id");
CREATE INDEX IF NOT EXISTS "event_recurrence_instances_instance_event_id_idx" ON "event_recurrence_instances" ("instance_event_id");

CREATE TABLE IF NOT EXISTS "event_moderation_flags" (
  "id" serial PRIMARY KEY NOT NULL,
  "event_id" integer NOT NULL,
  "flagged_by_clerk_user_id" text NOT NULL,
  "reason" text NOT NULL,
  "notes" text,
  "status" text DEFAULT 'open' NOT NULL,
  "resolved_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "event_moderation_flags" ADD CONSTRAINT "event_moderation_flags_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "event_moderation_flags_event_id_idx" ON "event_moderation_flags" ("event_id");
CREATE INDEX IF NOT EXISTS "event_moderation_flags_status_idx" ON "event_moderation_flags" ("status");

CREATE TABLE IF NOT EXISTS "event_revision_requests" (
  "id" serial PRIMARY KEY NOT NULL,
  "event_id" integer NOT NULL,
  "requested_by_clerk_user_id" text NOT NULL,
  "notes" text NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "resolved_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "event_revision_requests" ADD CONSTRAINT "event_revision_requests_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "event_revision_requests_event_id_idx" ON "event_revision_requests" ("event_id");
CREATE INDEX IF NOT EXISTS "event_revision_requests_status_idx" ON "event_revision_requests" ("status");

CREATE TABLE IF NOT EXISTS "event_analytics_daily" (
  "id" serial PRIMARY KEY NOT NULL,
  "event_id" integer NOT NULL,
  "metric_date" timestamp NOT NULL,
  "traffic_source" text DEFAULT 'direct' NOT NULL,
  "views" integer DEFAULT 0 NOT NULL,
  "favorites" integer DEFAULT 0 NOT NULL,
  "shares" integer DEFAULT 0 NOT NULL,
  "guest_list_requests" integer DEFAULT 0 NOT NULL,
  "reservation_requests" integer DEFAULT 0 NOT NULL,
  "ticket_clicks" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "event_analytics_daily_event_source_date_unique" UNIQUE("event_id", "traffic_source", "metric_date")
);

DO $$ BEGIN
 ALTER TABLE "event_analytics_daily" ADD CONSTRAINT "event_analytics_daily_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "event_analytics_daily_event_date_idx" ON "event_analytics_daily" ("event_id", "metric_date");
CREATE INDEX IF NOT EXISTS "event_analytics_daily_source_idx" ON "event_analytics_daily" ("traffic_source");

CREATE TABLE IF NOT EXISTS "event_notification_outbox" (
  "id" serial PRIMARY KEY NOT NULL,
  "event_id" integer NOT NULL,
  "notification_type" text NOT NULL,
  "payload_json" text NOT NULL,
  "status" text DEFAULT 'queued' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "scheduled_at" timestamp DEFAULT now() NOT NULL,
  "sent_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "event_notification_outbox" ADD CONSTRAINT "event_notification_outbox_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "event_notification_outbox_event_id_idx" ON "event_notification_outbox" ("event_id");
CREATE INDEX IF NOT EXISTS "event_notification_outbox_status_idx" ON "event_notification_outbox" ("status");
