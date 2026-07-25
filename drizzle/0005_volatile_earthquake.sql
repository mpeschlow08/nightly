CREATE TABLE "dj_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"stage_name" text NOT NULL,
	"username" text NOT NULL,
	"bio" text,
	"city" text,
	"profile_image_url" text,
	"genres" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"years_performing" integer,
	"is_resident_dj" boolean DEFAULT false NOT NULL,
	"resident_venue_name" text,
	"instagram_url" text,
	"tiktok_url" text,
	"soundcloud_url" text,
	"website_url" text,
	"booking_email" text,
	"rate_cents" integer,
	"is_available_for_booking" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dj_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "dj_profiles_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "dj_profiles" ADD CONSTRAINT "dj_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint