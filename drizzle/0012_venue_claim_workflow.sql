DO $$ BEGIN
  CREATE TYPE "claim_status" AS ENUM ('pending', 'approved', 'rejected', 'claimed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "moderation_status" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "event_type" AS ENUM ('event', 'special', 'guest_list', 'reservation');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "venues"
ADD COLUMN IF NOT EXISTS "vip_available" boolean,
ADD COLUMN IF NOT EXISTS "bottle_service_available" boolean,
ADD COLUMN IF NOT EXISTS "social_links_json" text,
ADD COLUMN IF NOT EXISTS "contact_email" text;

ALTER TABLE "events"
ADD COLUMN IF NOT EXISTS "reservation_url" text,
ADD COLUMN IF NOT EXISTS "event_type" "event_type" NOT NULL DEFAULT 'event',
ADD COLUMN IF NOT EXISTS "recurrence_rule" text,
ADD COLUMN IF NOT EXISTS "special_details" text,
ADD COLUMN IF NOT EXISTS "approval_status" "moderation_status" NOT NULL DEFAULT 'approved';

CREATE TABLE IF NOT EXISTS "venue_claim_requests" (
  "id" serial PRIMARY KEY NOT NULL,
  "venue_id" integer,
  "claimant_clerk_user_id" text NOT NULL,
  "claimant_role" text DEFAULT 'owner' NOT NULL,
  "business_email" text NOT NULL,
  "business_phone" text NOT NULL,
  "website_url" text,
  "notes" text,
  "venue_name" text NOT NULL,
  "venue_address" text NOT NULL,
  "venue_category" text,
  "google_place_id" text,
  "status" "claim_status" DEFAULT 'pending' NOT NULL,
  "admin_notes" text,
  "reviewed_by_clerk_user_id" text,
  "reviewed_at" timestamp,
  "claimed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "venue_claim_requests" ADD CONSTRAINT "venue_claim_requests_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "venue_claim_requests_venue_id_idx" ON "venue_claim_requests" ("venue_id");
CREATE INDEX IF NOT EXISTS "venue_claim_requests_claimant_idx" ON "venue_claim_requests" ("claimant_clerk_user_id");
CREATE INDEX IF NOT EXISTS "venue_claim_requests_status_idx" ON "venue_claim_requests" ("status");
CREATE INDEX IF NOT EXISTS "venue_claim_requests_google_place_id_idx" ON "venue_claim_requests" ("google_place_id");

CREATE TABLE IF NOT EXISTS "venue_profile_change_requests" (
  "id" serial PRIMARY KEY NOT NULL,
  "venue_id" integer NOT NULL,
  "submitted_by_clerk_user_id" text NOT NULL,
  "previous_values_json" text NOT NULL,
  "proposed_values_json" text NOT NULL,
  "status" "moderation_status" DEFAULT 'pending' NOT NULL,
  "review_notes" text,
  "reviewed_by_clerk_user_id" text,
  "reviewed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "venue_profile_change_requests" ADD CONSTRAINT "venue_profile_change_requests_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "venue_profile_change_requests_venue_id_idx" ON "venue_profile_change_requests" ("venue_id");
CREATE INDEX IF NOT EXISTS "venue_profile_change_requests_status_idx" ON "venue_profile_change_requests" ("status");
CREATE INDEX IF NOT EXISTS "venue_profile_change_requests_submitted_by_idx" ON "venue_profile_change_requests" ("submitted_by_clerk_user_id");

CREATE TABLE IF NOT EXISTS "venue_publish_history" (
  "id" serial PRIMARY KEY NOT NULL,
  "venue_id" integer NOT NULL,
  "actor_clerk_user_id" text NOT NULL,
  "action" text NOT NULL,
  "previous_status" text,
  "next_status" text,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "venue_publish_history" ADD CONSTRAINT "venue_publish_history_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "venue_publish_history_venue_id_idx" ON "venue_publish_history" ("venue_id");
CREATE INDEX IF NOT EXISTS "venue_publish_history_action_idx" ON "venue_publish_history" ("action");

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "actor_clerk_user_id" text NOT NULL,
  "actor_role" text,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "action" text NOT NULL,
  "previous_values_json" text,
  "next_values_json" text,
  "metadata_json" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "audit_logs_entity_idx" ON "audit_logs" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "audit_logs_actor_idx" ON "audit_logs" ("actor_clerk_user_id");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" ("action");
