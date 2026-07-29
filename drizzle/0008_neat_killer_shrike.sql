CREATE TABLE "venue_cameras" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"name" text NOT NULL,
	"stream_url" text NOT NULL,
	"stream_type" text NOT NULL,
	"status" text DEFAULT 'enabled' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "venue_cameras" ADD CONSTRAINT "venue_cameras_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "venue_cameras_venue_id_idx" ON "venue_cameras" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_cameras_is_primary_idx" ON "venue_cameras" USING btree ("is_primary");