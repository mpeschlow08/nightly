CREATE TYPE "public"."venue_member_role" AS ENUM('owner', 'manager');--> statement-breakpoint
CREATE TABLE "venue_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"clerk_user_id" text NOT NULL,
	"role" "venue_member_role" DEFAULT 'owner' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "venue_members_venue_id_clerk_user_id_unique" UNIQUE("venue_id","clerk_user_id")
);
--> statement-breakpoint
ALTER TABLE "venue_members" ADD CONSTRAINT "venue_members_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "venue_members_venue_id_idx" ON "venue_members" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_members_clerk_user_id_idx" ON "venue_members" USING btree ("clerk_user_id");