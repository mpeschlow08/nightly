DO $$ BEGIN
 CREATE TYPE "public"."special_guest_type" AS ENUM('artist', 'celebrity', 'athlete', 'influencer', 'host', 'special_appearance', 'custom');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."special_guest_verification_status" AS ENUM('unverified', 'pending_review', 'verified', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."special_guest_status" AS ENUM('scheduled', 'active', 'cancelled', 'expired', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."special_guest_history_action" AS ENUM('created', 'updated', 'duplicated', 'cancelled', 'archived', 'verification_updated', 'auto_expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "special_guests" (
  "id" serial PRIMARY KEY NOT NULL,
  "venue_id" integer NOT NULL,
  "event_id" integer,
  "display_name" text NOT NULL,
  "stage_name" text,
  "guest_type" "special_guest_type" DEFAULT 'artist' NOT NULL,
  "custom_guest_type" text,
  "photo_url" text,
  "logo_url" text,
  "short_description" text,
  "appearance_start_at" timestamp NOT NULL,
  "appearance_end_at" timestamp NOT NULL,
  "visibility_start_at" timestamp,
  "visibility_end_at" timestamp,
  "verification_status" "special_guest_verification_status" DEFAULT 'unverified' NOT NULL,
  "status" "special_guest_status" DEFAULT 'scheduled' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "cancelled_at" timestamp,
  "cancelled_reason" text,
  "expired_at" timestamp,
  "archived_at" timestamp,
  "is_archived" boolean DEFAULT false NOT NULL,
  "created_by_clerk_user_id" text NOT NULL,
  "updated_by_clerk_user_id" text,
  "reviewed_by_clerk_user_id" text,
  "reviewed_at" timestamp,
  "review_notes" text,
  "metadata_json" text DEFAULT '{}' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "special_guest_history" (
  "id" serial PRIMARY KEY NOT NULL,
  "special_guest_id" integer NOT NULL,
  "venue_id" integer NOT NULL,
  "event_id" integer,
  "action" "special_guest_history_action" NOT NULL,
  "actor_clerk_user_id" text NOT NULL,
  "payload_json" text DEFAULT '{}' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "special_guest_analytics_daily" (
  "id" serial PRIMARY KEY NOT NULL,
  "special_guest_id" integer NOT NULL,
  "venue_id" integer NOT NULL,
  "event_id" integer,
  "metric_date" date NOT NULL,
  "traffic_source" text DEFAULT 'direct' NOT NULL,
  "views" integer DEFAULT 0 NOT NULL,
  "clicks" integer DEFAULT 0 NOT NULL,
  "venue_conversions" integer DEFAULT 0 NOT NULL,
  "reservation_conversions" integer DEFAULT 0 NOT NULL,
  "ticket_conversions" integer DEFAULT 0 NOT NULL,
  "revenue_cents" integer DEFAULT 0 NOT NULL,
  "popularity_score" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "special_guest_analytics_daily_unique" UNIQUE("special_guest_id", "traffic_source", "metric_date")
);

DO $$ BEGIN
 ALTER TABLE "special_guests" ADD CONSTRAINT "special_guests_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "special_guests" ADD CONSTRAINT "special_guests_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "special_guest_history" ADD CONSTRAINT "special_guest_history_special_guest_id_fk" FOREIGN KEY ("special_guest_id") REFERENCES "public"."special_guests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "special_guest_history" ADD CONSTRAINT "special_guest_history_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "special_guest_history" ADD CONSTRAINT "special_guest_history_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "special_guest_analytics_daily" ADD CONSTRAINT "special_guest_analytics_daily_special_guest_id_fk" FOREIGN KEY ("special_guest_id") REFERENCES "public"."special_guests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "special_guest_analytics_daily" ADD CONSTRAINT "special_guest_analytics_daily_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "special_guest_analytics_daily" ADD CONSTRAINT "special_guest_analytics_daily_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "special_guests_venue_id_idx" ON "special_guests" USING btree ("venue_id");
CREATE INDEX IF NOT EXISTS "special_guests_event_id_idx" ON "special_guests" USING btree ("event_id");
CREATE INDEX IF NOT EXISTS "special_guests_status_idx" ON "special_guests" USING btree ("status");
CREATE INDEX IF NOT EXISTS "special_guests_verification_status_idx" ON "special_guests" USING btree ("verification_status");
CREATE INDEX IF NOT EXISTS "special_guests_visibility_window_idx" ON "special_guests" USING btree ("visibility_start_at", "visibility_end_at");
CREATE INDEX IF NOT EXISTS "special_guests_appearance_window_idx" ON "special_guests" USING btree ("appearance_start_at", "appearance_end_at");

CREATE INDEX IF NOT EXISTS "special_guest_history_special_guest_id_idx" ON "special_guest_history" USING btree ("special_guest_id");
CREATE INDEX IF NOT EXISTS "special_guest_history_venue_id_idx" ON "special_guest_history" USING btree ("venue_id");
CREATE INDEX IF NOT EXISTS "special_guest_history_action_idx" ON "special_guest_history" USING btree ("action");

CREATE INDEX IF NOT EXISTS "special_guest_analytics_daily_guest_date_idx" ON "special_guest_analytics_daily" USING btree ("special_guest_id", "metric_date");
CREATE INDEX IF NOT EXISTS "special_guest_analytics_daily_source_idx" ON "special_guest_analytics_daily" USING btree ("traffic_source");
