DO $$ BEGIN
  CREATE TYPE commercial_scope AS ENUM ('organization','venue','device','consumer','artist');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE commercial_product AS ENUM ('venue_package','consumer_premium','artist_subscription');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE commercial_lifecycle_state AS ENUM ('trialing','active','grace_period','past_due','suspended','cancel_pending','cancelled','expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE commercial_subscription_source AS ENUM ('trial','manual','billing_provider','migration');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE commercial_grant_source AS ENUM ('manual','promotion','internal');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE commercial_service_purpose AS ENUM ('device_diagnostics','device_reprovision','commissioning','sales_demo','commercial_support');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE TABLE commercial_subscriptions (
  id serial PRIMARY KEY,
  scope_type commercial_scope NOT NULL,
  scope_id integer NOT NULL CHECK (scope_id > 0),
  product commercial_product NOT NULL,
  state commercial_lifecycle_state NOT NULL DEFAULT 'expired',
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  source commercial_subscription_source NOT NULL DEFAULT 'manual',
  started_at timestamp NOT NULL DEFAULT now(),
  trial_started_at timestamp,
  trial_ends_at timestamp,
  grace_until timestamp,
  cancel_at timestamp,
  ends_at timestamp,
  billing_provider text NOT NULL DEFAULT 'none',
  billing_customer_ref text,
  billing_subscription_ref text,
  reason_code text,
  metadata_json text NOT NULL DEFAULT '{}',
  created_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT commercial_subscriptions_scope_product_unique UNIQUE (scope_type,scope_id,product),
  CONSTRAINT commercial_subscriptions_scope_product_check CHECK (
    (product='venue_package' AND scope_type='venue') OR
    (product='consumer_premium' AND scope_type='consumer') OR
    (product='artist_subscription' AND scope_type='artist')
  ),
  CONSTRAINT commercial_subscriptions_trial_window_check CHECK (trial_ends_at IS NULL OR (trial_started_at IS NOT NULL AND trial_ends_at > trial_started_at)),
  CONSTRAINT commercial_subscriptions_grace_window_check CHECK (grace_until IS NULL OR grace_until >= started_at)
);
--> statement-breakpoint
CREATE INDEX commercial_subscriptions_scope_idx ON commercial_subscriptions(scope_type,scope_id);
--> statement-breakpoint
CREATE INDEX commercial_subscriptions_state_idx ON commercial_subscriptions(state);
--> statement-breakpoint
CREATE INDEX commercial_subscriptions_trial_ends_at_idx ON commercial_subscriptions(trial_ends_at);
--> statement-breakpoint
CREATE INDEX commercial_subscriptions_grace_until_idx ON commercial_subscriptions(grace_until);
--> statement-breakpoint

CREATE TABLE commercial_entitlement_grants (
  id serial PRIMARY KEY,
  public_id text NOT NULL UNIQUE,
  scope_type commercial_scope NOT NULL,
  scope_id integer NOT NULL CHECK (scope_id > 0),
  capability text NOT NULL,
  source commercial_grant_source NOT NULL,
  reason text NOT NULL,
  starts_at timestamp NOT NULL DEFAULT now(),
  expires_at timestamp,
  revoked_at timestamp,
  issued_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  metadata_json text NOT NULL DEFAULT '{}',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT commercial_entitlement_grants_capability_check CHECK (capability ~ '^(venue|device|consumer|artist)\.[a-z0-9_.]+$'),
  CONSTRAINT commercial_entitlement_grants_capability_scope_check CHECK (
    (scope_type='venue' AND (capability LIKE 'venue.%' OR capability LIKE 'device.%')) OR
    (scope_type='device' AND capability LIKE 'device.%') OR
    (scope_type='consumer' AND capability LIKE 'consumer.%') OR
    (scope_type='artist' AND capability LIKE 'artist.%')
  ),
  CONSTRAINT commercial_entitlement_grants_expiry_check CHECK (expires_at IS NULL OR expires_at > starts_at)
);
--> statement-breakpoint
CREATE INDEX commercial_entitlement_grants_scope_capability_idx ON commercial_entitlement_grants(scope_type,scope_id,capability);
--> statement-breakpoint
CREATE INDEX commercial_entitlement_grants_expires_at_idx ON commercial_entitlement_grants(expires_at);
--> statement-breakpoint

CREATE TABLE commercial_service_authorizations (
  id serial PRIMARY KEY,
  public_id text NOT NULL UNIQUE,
  actor_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issuer_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  scope_type commercial_scope NOT NULL,
  scope_id integer NOT NULL CHECK (scope_id > 0),
  purpose commercial_service_purpose NOT NULL,
  capabilities text[] NOT NULL,
  reason text NOT NULL,
  issued_at timestamp NOT NULL DEFAULT now(),
  expires_at timestamp NOT NULL,
  revoked_at timestamp,
  revoked_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  last_used_at timestamp,
  metadata_json text NOT NULL DEFAULT '{}',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT commercial_service_authorizations_capability_check CHECK (cardinality(capabilities) > 0),
  CONSTRAINT commercial_service_authorizations_scope_check CHECK (scope_type IN ('venue','device')),
  CONSTRAINT commercial_service_authorizations_capability_catalog_check CHECK (capabilities <@ ARRAY['service.device_diagnostics','service.device_reprovision','service.commissioning']::text[]),
  CONSTRAINT commercial_service_authorizations_purpose_capability_check CHECK (
    (purpose='device_diagnostics' AND capabilities <@ ARRAY['service.device_diagnostics']::text[]) OR
    (purpose='device_reprovision' AND capabilities <@ ARRAY['service.device_reprovision','service.device_diagnostics']::text[]) OR
    (purpose='commissioning' AND capabilities <@ ARRAY['service.commissioning','service.device_diagnostics']::text[]) OR
    (purpose='sales_demo' AND capabilities <@ ARRAY['service.device_diagnostics']::text[]) OR
    (purpose='commercial_support' AND capabilities <@ ARRAY['service.device_diagnostics','service.device_reprovision']::text[])
  ),
  CONSTRAINT commercial_service_authorizations_expiry_check CHECK (expires_at > issued_at)
);
--> statement-breakpoint
CREATE INDEX commercial_service_authorizations_actor_scope_idx ON commercial_service_authorizations(actor_user_id,scope_type,scope_id);
--> statement-breakpoint
CREATE INDEX commercial_service_authorizations_expires_at_idx ON commercial_service_authorizations(expires_at);
--> statement-breakpoint

CREATE TABLE consumer_daily_hot_reel_unlocks (
  id serial PRIMARY KEY,
  consumer_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unlock_date date NOT NULL,
  venue_id integer NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT consumer_daily_hot_reel_unlocks_user_day_unique UNIQUE (consumer_user_id,unlock_date)
);
--> statement-breakpoint
CREATE INDEX consumer_daily_hot_reel_unlocks_venue_day_idx ON consumer_daily_hot_reel_unlocks(venue_id,unlock_date);