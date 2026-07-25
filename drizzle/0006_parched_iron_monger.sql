CREATE TABLE "dj_sample_mixes" (
	"id" serial PRIMARY KEY NOT NULL,
	"dj_profile_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"audio_url" text NOT NULL,
	"audio_filename" text,
	"duration_seconds" integer,
	"cover_image_url" text,
	"genre" text,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"play_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dj_sample_mixes" ADD CONSTRAINT "dj_sample_mixes_dj_profile_id_dj_profiles_id_fk" FOREIGN KEY ("dj_profile_id") REFERENCES "public"."dj_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dj_sample_mixes_dj_profile_id_idx" ON "dj_sample_mixes" USING btree ("dj_profile_id");