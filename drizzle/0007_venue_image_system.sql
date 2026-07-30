ALTER TABLE "venues"
ADD COLUMN IF NOT EXISTS "hero_image_url" text,
ADD COLUMN IF NOT EXISTS "thumbnail_image_url" text,
ADD COLUMN IF NOT EXISTS "gallery_image_urls_json" text,
ADD COLUMN IF NOT EXISTS "google_photo_references_json" text,
ADD COLUMN IF NOT EXISTS "google_cover_photo_reference" text,
ADD COLUMN IF NOT EXISTS "google_logo_image_url" text;