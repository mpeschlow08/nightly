ALTER TABLE "venues" ADD COLUMN "google_place_id" text;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "address" text;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "phone" text;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "website_url" text;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "opening_hours_json" text;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "latitude" real;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "longitude" real;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "google_maps_url" text;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "google_imported_at" timestamp;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "google_data_confirmed_by_owner_at" timestamp;
