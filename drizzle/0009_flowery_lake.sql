ALTER TABLE "events" ADD COLUMN "cover_image_url" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "ticket_url" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "age_requirement" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "is_published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "venue_images" ADD COLUMN "caption" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "price_level" integer;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "dress_code" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "age_requirement" integer;