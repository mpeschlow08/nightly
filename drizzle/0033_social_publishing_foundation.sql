CREATE TYPE "social_platform" AS ENUM ('instagram', 'facebook', 'tiktok', 'youtube', 'x');
CREATE TYPE "social_account_type" AS ENUM ('business', 'creator', 'page', 'channel', 'personal', 'unknown');
CREATE TYPE "social_account_connection_state" AS ENUM ('connected', 'disconnected', 'verification_failed');
CREATE TYPE "social_account_authorization_state" AS ENUM ('valid', 'expired', 'revoked', 'reconnect_required', 'unknown');
CREATE TYPE "social_publishing_mode" AS ENUM ('auto_publish', 'review_before_post', 'disabled');
CREATE TYPE "social_distribution_request_state" AS ENUM ('pending_review', 'queued', 'processing', 'completed', 'partial', 'failed', 'cancelled');
CREATE TYPE "social_destination_state" AS ENUM ('queued', 'waiting_for_review', 'authorized', 'uploading', 'processing', 'published', 'failed_retryable', 'failed_permanent', 'revoke_requested', 'revoked', 'cancelled');

ALTER TABLE "hot_reels"
  ADD CONSTRAINT "hot_reels_id_venue_unique" UNIQUE ("id", "venue_id");

CREATE TABLE "social_platform_accounts" (
  "id" serial PRIMARY KEY,
  "public_id" text NOT NULL UNIQUE,
  "venue_id" integer NOT NULL REFERENCES "venues"("id") ON DELETE CASCADE,
  "platform" "social_platform" NOT NULL,
  "provider_account_id" text NOT NULL,
  "display_name" text NOT NULL,
  "account_type" "social_account_type" NOT NULL DEFAULT 'unknown',
  "connection_state" "social_account_connection_state" NOT NULL DEFAULT 'disconnected',
  "authorization_state" "social_account_authorization_state" NOT NULL DEFAULT 'unknown',
  "granted_scopes_json" text NOT NULL DEFAULT '[]',
  "capabilities_json" text NOT NULL DEFAULT '[]',
  "authorized_at" timestamp,
  "expires_at" timestamp,
  "reconnect_required" boolean NOT NULL DEFAULT true,
  "credential_ref" text,
  "safe_metadata_json" text NOT NULL DEFAULT '{}',
  "last_verified_at" timestamp,
  "disconnected_at" timestamp,
  "revoked_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "social_platform_accounts_provider_account_unique" UNIQUE ("platform", "provider_account_id"),
  CONSTRAINT "social_platform_accounts_id_venue_unique" UNIQUE ("id", "venue_id"),
  CONSTRAINT "social_platform_accounts_credential_ref_unique" UNIQUE ("credential_ref"),
  CONSTRAINT "social_platform_accounts_credential_ref_check" CHECK ("connection_state" <> 'connected' OR "credential_ref" IS NOT NULL)
);
CREATE INDEX "social_platform_accounts_venue_platform_idx" ON "social_platform_accounts" ("venue_id", "platform");

CREATE TABLE "social_publishing_policies" (
  "id" serial PRIMARY KEY,
  "venue_id" integer NOT NULL UNIQUE REFERENCES "venues"("id") ON DELETE CASCADE,
  "mode" "social_publishing_mode" NOT NULL DEFAULT 'review_before_post',
  "revision" integer NOT NULL DEFAULT 1,
  "updated_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "social_publishing_policies_revision_check" CHECK ("revision" > 0)
);

CREATE TABLE "social_distribution_requests" (
  "id" serial PRIMARY KEY,
  "public_id" text NOT NULL UNIQUE,
  "hot_reel_id" integer NOT NULL,
  "venue_id" integer NOT NULL REFERENCES "venues"("id") ON DELETE CASCADE,
  "actor_user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "idempotency_key" text NOT NULL,
  "request_fingerprint" text NOT NULL,
  "policy_mode_snapshot" "social_publishing_mode" NOT NULL,
  "policy_revision_snapshot" integer NOT NULL,
  "state" "social_distribution_request_state" NOT NULL DEFAULT 'pending_review',
  "caption" text NOT NULL DEFAULT '',
  "requested_at" timestamp NOT NULL DEFAULT now(),
  "reviewed_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "reviewed_at" timestamp,
  "completed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "social_distribution_requests_venue_idempotency_unique" UNIQUE ("venue_id", "idempotency_key"),
  CONSTRAINT "social_distribution_requests_id_venue_unique" UNIQUE ("id", "venue_id"),
  CONSTRAINT "social_distribution_requests_policy_revision_check" CHECK ("policy_revision_snapshot" > 0),
  CONSTRAINT "social_distribution_requests_reel_venue_fkey" FOREIGN KEY ("hot_reel_id", "venue_id") REFERENCES "hot_reels"("id", "venue_id") ON DELETE RESTRICT
);
CREATE INDEX "social_distribution_requests_venue_created_idx" ON "social_distribution_requests" ("venue_id", "created_at");
CREATE INDEX "social_distribution_requests_hot_reel_idx" ON "social_distribution_requests" ("hot_reel_id");

CREATE TABLE "social_publications" (
  "id" serial PRIMARY KEY,
  "public_id" text NOT NULL UNIQUE,
  "request_id" integer NOT NULL,
  "hot_reel_id" integer NOT NULL,
  "venue_id" integer NOT NULL REFERENCES "venues"("id") ON DELETE CASCADE,
  "account_id" integer NOT NULL,
  "actor_user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "platform" "social_platform" NOT NULL,
  "policy_mode_snapshot" "social_publishing_mode" NOT NULL,
  "state" "social_destination_state" NOT NULL DEFAULT 'waiting_for_review',
  "provider_key" text NOT NULL,
  "provider_idempotency_key" text NOT NULL UNIQUE,
  "provider_publication_id" text,
  "provider_url" text,
  "attempts" integer NOT NULL DEFAULT 0,
  "max_attempts" integer NOT NULL DEFAULT 5,
  "status_checks" integer NOT NULL DEFAULT 0,
  "max_status_checks" integer NOT NULL DEFAULT 48,
  "next_retry_at" timestamp,
  "last_failure_code" text,
  "published_at" timestamp,
  "revoked_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "social_publications_request_account_unique" UNIQUE ("request_id", "account_id"),
  CONSTRAINT "social_publications_hot_reel_account_unique" UNIQUE ("hot_reel_id", "account_id"),
  CONSTRAINT "social_publications_attempts_check" CHECK ("attempts" >= 0 AND "max_attempts" > 0 AND "attempts" <= "max_attempts"),
  CONSTRAINT "social_publications_status_checks_check" CHECK ("status_checks" >= 0 AND "max_status_checks" > 0 AND "status_checks" <= "max_status_checks"),
  CONSTRAINT "social_publications_provider_url_check" CHECK ("provider_url" IS NULL OR "provider_url" LIKE 'https://%'),
  CONSTRAINT "social_publications_request_venue_fkey" FOREIGN KEY ("request_id", "venue_id") REFERENCES "social_distribution_requests"("id", "venue_id") ON DELETE CASCADE,
  CONSTRAINT "social_publications_account_venue_fkey" FOREIGN KEY ("account_id", "venue_id") REFERENCES "social_platform_accounts"("id", "venue_id") ON DELETE RESTRICT,
  CONSTRAINT "social_publications_reel_venue_fkey" FOREIGN KEY ("hot_reel_id", "venue_id") REFERENCES "hot_reels"("id", "venue_id") ON DELETE RESTRICT
);
CREATE INDEX "social_publications_request_idx" ON "social_publications" ("request_id");
CREATE INDEX "social_publications_venue_created_idx" ON "social_publications" ("venue_id", "created_at");
CREATE INDEX "social_publications_due_idx" ON "social_publications" ("state", "next_retry_at");

CREATE TABLE "social_oauth_states" (
  "id" serial PRIMARY KEY,
  "state_hash" text NOT NULL UNIQUE,
  "platform" "social_platform" NOT NULL,
  "venue_id" integer NOT NULL REFERENCES "venues"("id") ON DELETE CASCADE,
  "actor_clerk_user_id" text NOT NULL,
  "redirect_uri" text NOT NULL,
  "requested_scopes_json" text NOT NULL DEFAULT '[]',
  "pkce_verifier_ref" text,
  "expires_at" timestamp NOT NULL,
  "consumed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX "social_oauth_states_expiry_idx" ON "social_oauth_states" ("expires_at");
CREATE INDEX "social_oauth_states_venue_actor_idx" ON "social_oauth_states" ("venue_id", "actor_clerk_user_id");

INSERT INTO "platform_feature_flags" ("key", "description", "enabled", "rollout_percentage", "environment", "kill_switch", "metadata_json")
VALUES ('feature.social_publishing', 'Owner social account linking and external Hot Reel distribution.', false, 0, 'production', false, '{}')
ON CONFLICT ("key") DO NOTHING;
