ALTER TABLE "venues" ADD COLUMN "google_place_resource_name" text;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "google_business_status" text;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "google_primary_type" text;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "google_types_json" text;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "google_display_name" text;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "google_formatted_address" text;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "google_national_phone_number" text;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "google_international_phone_number" text;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "google_website_uri" text;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "google_maps_uri" text;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "google_regular_opening_hours_json" text;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "google_current_opening_hours_json" text;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "google_utc_offset_minutes" integer;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "google_rating" real;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "google_user_rating_count" integer;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "google_price_level" integer;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "google_photos_json" text;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "google_attributions_json" text;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "google_data_last_fetched_at" timestamp;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "google_data_expires_at" timestamp;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "google_refresh_status" text DEFAULT 'never' NOT NULL;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "google_refresh_error" text;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "google_refresh_attempted_at" timestamp;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "google_refresh_version" text;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "owner_override_fields_json" text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "admin_override_fields_json" text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "google_refresh_suspended_at" timestamp;
--> statement-breakpoint
CREATE INDEX "venues_google_refresh_status_idx" ON "venues" USING btree ("google_refresh_status");
--> statement-breakpoint
CREATE INDEX "venues_google_data_expires_at_idx" ON "venues" USING btree ("google_data_expires_at");
--> statement-breakpoint
CREATE TABLE "venue_google_photo_metadata" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"photo_resource_name" text NOT NULL,
	"width_px" integer,
	"height_px" integer,
	"author_attributions_json" text DEFAULT '[]' NOT NULL,
	"ranking_purpose" text,
	"source" text DEFAULT 'google_places' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "venue_google_photo_metadata_venue_photo_unique" UNIQUE("venue_id","photo_resource_name")
);
--> statement-breakpoint
CREATE TABLE "venue_data_refresh_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_key" text DEFAULT 'venue_google_data_refresh' NOT NULL,
	"trigger" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"dry_run" boolean DEFAULT false NOT NULL,
	"force" boolean DEFAULT false NOT NULL,
	"requested_by_clerk_user_id" text,
	"correlation_id" text,
	"request_estimate_count" integer,
	"selected_venue_count" integer DEFAULT 0 NOT NULL,
	"processed_venue_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_data_refresh_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"venue_id" integer NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"changed_fields_json" text DEFAULT '[]' NOT NULL,
	"error_message" text,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "venue_data_refresh_items_run_venue_unique" UNIQUE("run_id","venue_id")
);
--> statement-breakpoint
ALTER TABLE "venue_google_photo_metadata" ADD CONSTRAINT "venue_google_photo_metadata_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "venue_data_refresh_items" ADD CONSTRAINT "venue_data_refresh_items_run_id_venue_data_refresh_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."venue_data_refresh_runs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "venue_data_refresh_items" ADD CONSTRAINT "venue_data_refresh_items_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "venue_google_photo_metadata_venue_id_idx" ON "venue_google_photo_metadata" USING btree ("venue_id");
--> statement-breakpoint
CREATE INDEX "venue_data_refresh_runs_job_key_idx" ON "venue_data_refresh_runs" USING btree ("job_key");
--> statement-breakpoint
CREATE INDEX "venue_data_refresh_runs_status_idx" ON "venue_data_refresh_runs" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "venue_data_refresh_runs_created_at_idx" ON "venue_data_refresh_runs" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "venue_data_refresh_items_run_id_idx" ON "venue_data_refresh_items" USING btree ("run_id");
--> statement-breakpoint
CREATE INDEX "venue_data_refresh_items_venue_id_idx" ON "venue_data_refresh_items" USING btree ("venue_id");
--> statement-breakpoint
CREATE INDEX "venue_data_refresh_items_status_idx" ON "venue_data_refresh_items" USING btree ("status");