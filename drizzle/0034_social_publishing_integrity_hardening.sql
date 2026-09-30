ALTER TABLE "social_platform_accounts"
  ADD CONSTRAINT "social_platform_accounts_id_venue_platform_unique"
  UNIQUE ("id", "venue_id", "platform");

ALTER TABLE "social_distribution_requests"
  ADD CONSTRAINT "social_distribution_requests_id_hot_reel_venue_unique"
  UNIQUE ("id", "hot_reel_id", "venue_id");

ALTER TABLE "social_publications"
  ADD CONSTRAINT "social_publications_request_reel_venue_fkey"
  FOREIGN KEY ("request_id", "hot_reel_id", "venue_id")
  REFERENCES "social_distribution_requests" ("id", "hot_reel_id", "venue_id")
  ON DELETE CASCADE;

ALTER TABLE "social_publications"
  ADD CONSTRAINT "social_publications_account_venue_platform_fkey"
  FOREIGN KEY ("account_id", "venue_id", "platform")
  REFERENCES "social_platform_accounts" ("id", "venue_id", "platform")
  ON DELETE RESTRICT;

ALTER TABLE "social_publications"
  DROP CONSTRAINT "social_publications_request_venue_fkey",
  DROP CONSTRAINT "social_publications_account_venue_fkey",
  DROP CONSTRAINT "social_publications_reel_venue_fkey";
