ALTER TABLE "venues"
ADD COLUMN IF NOT EXISTS "short_description" text,
ADD COLUMN IF NOT EXISTS "state" text,
ADD COLUMN IF NOT EXISTS "postal_code" text,
ADD COLUMN IF NOT EXISTS "timezone" text DEFAULT 'America/New_York',
ADD COLUMN IF NOT EXISTS "venue_categories_json" text,
ADD COLUMN IF NOT EXISTS "amenities_json" text,
ADD COLUMN IF NOT EXISTS "parking_information" text,
ADD COLUMN IF NOT EXISTS "valet_available" boolean,
ADD COLUMN IF NOT EXISTS "cover_charge_information" text,
ADD COLUMN IF NOT EXISTS "average_rating" real,
ADD COLUMN IF NOT EXISTS "review_count" integer,
ADD COLUMN IF NOT EXISTS "publication_status" text DEFAULT 'published' NOT NULL,
ADD COLUMN IF NOT EXISTS "verification_status" text DEFAULT 'unverified' NOT NULL,
ADD COLUMN IF NOT EXISTS "is_featured" boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS "archived_at" timestamp,
ADD COLUMN IF NOT EXISTS "suspended_at" timestamp,
ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;

ALTER TABLE "events"
ADD COLUMN IF NOT EXISTS "slug" text,
ADD COLUMN IF NOT EXISTS "timezone" text DEFAULT 'America/New_York',
ADD COLUMN IF NOT EXISTS "guest_list_url" text,
ADD COLUMN IF NOT EXISTS "ticket_status" text DEFAULT 'on_sale',
ADD COLUMN IF NOT EXISTS "genres_json" text,
ADD COLUMN IF NOT EXISTS "featured_status" text DEFAULT 'none' NOT NULL,
ADD COLUMN IF NOT EXISTS "publication_status" text DEFAULT 'draft' NOT NULL,
ADD COLUMN IF NOT EXISTS "is_canceled" boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS "is_archived" boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;

CREATE INDEX IF NOT EXISTS "venues_slug_idx" ON "venues" ("slug");
CREATE INDEX IF NOT EXISTS "venues_google_place_id_idx" ON "venues" ("google_place_id");
CREATE INDEX IF NOT EXISTS "venues_publication_status_idx" ON "venues" ("publication_status");
CREATE INDEX IF NOT EXISTS "venues_name_idx" ON "venues" ("name");
CREATE INDEX IF NOT EXISTS "venues_neighborhood_idx" ON "venues" ("neighborhood");

CREATE INDEX IF NOT EXISTS "events_slug_idx" ON "events" ("slug");
CREATE INDEX IF NOT EXISTS "events_venue_id_idx" ON "events" ("venue_id");
CREATE INDEX IF NOT EXISTS "events_starts_at_idx" ON "events" ("starts_at");
CREATE INDEX IF NOT EXISTS "events_publication_status_idx" ON "events" ("publication_status");
