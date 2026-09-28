DO $$ BEGIN
CREATE TYPE "nightly_device_lifecycle_state" AS ENUM (
  'factory',
  'inventory',
  'provisioned',
  'unclaimed',
  'claimed',
  'active',
  'degraded',
  'offline',
  'suspended',
  'return_pending',
  'rma',
  'revoked',
  'reprovisioning',
  'retired'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE TYPE "nightly_device_provisioning_state" AS ENUM (
  'inventory',
  'provisioning',
  'provisioned',
  'reprovisioning',
  'failed',
  'revoked'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE TYPE "nightly_device_claim_state" AS ENUM (
  'unclaimed',
  'claimed',
  'pending',
  'rejected',
  'revoked',
  'expired'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE TYPE "nightly_device_operational_state" AS ENUM (
  'starting',
  'healthy',
  'degraded',
  'offline',
  'suspended',
  'maintenance'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE TYPE "nightly_device_source_type" AS ENUM (
  'ip_camera',
  'hdmi_input',
  'mixer_audio',
  'ambient_audio',
  'other'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "nightly_devices" (
  "id" serial PRIMARY KEY NOT NULL,
  "venue_id" integer,
  "public_device_uuid" text NOT NULL,
  "serial_number" text NOT NULL,
  "hardware_model" text,
  "hardware_revision" text,
  "manufacturing_batch" text,
  "factory_metadata_json" text NOT NULL DEFAULT '{}',
  "device_secret_hash" text,
  "device_auth_version" text NOT NULL DEFAULT 'v1',
  "lifecycle_state" "nightly_device_lifecycle_state" NOT NULL DEFAULT 'inventory',
  "provisioning_state" "nightly_device_provisioning_state" NOT NULL DEFAULT 'inventory',
  "claim_state" "nightly_device_claim_state" NOT NULL DEFAULT 'unclaimed',
  "operational_state" "nightly_device_operational_state" NOT NULL DEFAULT 'starting',
  "service_entitlement_state" text NOT NULL DEFAULT 'active',
  "management_access_level" text NOT NULL DEFAULT 'owner_assisted',
  "privacy_mode" text NOT NULL DEFAULT 'private',
  "content_eligibility" text NOT NULL DEFAULT 'restricted',
  "public_publishing_enabled" boolean NOT NULL DEFAULT false,
  "hot_reel_eligible" boolean NOT NULL DEFAULT false,
  "live_eligible" boolean NOT NULL DEFAULT false,
  "privacy_config_revision" integer NOT NULL DEFAULT 1,
  "service_config_revision" integer NOT NULL DEFAULT 1,
  "software_version" text,
  "agent_version" text,
  "public_device_name" text,
  "last_heartbeat_at" timestamp,
  "last_config_sync_at" timestamp,
  "desired_config_revision" text,
  "applied_config_revision" text,
  "capability_summary_json" text NOT NULL DEFAULT '[]',
  "privacy_state_json" text NOT NULL DEFAULT '{}',
  "service_state_json" text NOT NULL DEFAULT '{}',
  "metadata_json" text NOT NULL DEFAULT '{}',
  "activation_at" timestamp,
  "provisioning_at" timestamp,
  "suspension_at" timestamp,
  "revoked_at" timestamp,
  "return_pending_at" timestamp,
  "rma_at" timestamp,
  "retired_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "nightly_devices_public_device_uuid_unique" UNIQUE ("public_device_uuid"),
  CONSTRAINT "nightly_devices_serial_number_unique" UNIQUE ("serial_number"),
  CONSTRAINT "nightly_devices_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "nightly_device_assignments" (
  "id" serial PRIMARY KEY NOT NULL,
  "device_id" integer NOT NULL,
  "venue_id" integer NOT NULL,
  "assigned_by_clerk_user_id" text NOT NULL,
  "assigned_at" timestamp DEFAULT now() NOT NULL,
  "released_at" timestamp,
  "assignment_reason" text,
  "status" text NOT NULL DEFAULT 'active',
  "metadata_json" text NOT NULL DEFAULT '{}',
  CONSTRAINT "nightly_device_assignments_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "nightly_devices"("id") ON DELETE CASCADE,
  CONSTRAINT "nightly_device_assignments_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "nightly_device_capabilities" (
  "id" serial PRIMARY KEY NOT NULL,
  "device_id" integer NOT NULL,
  "category" text NOT NULL,
  "capability_name" text NOT NULL,
  "capability_value" text,
  "supported" boolean NOT NULL DEFAULT true,
  "metadata_json" text NOT NULL DEFAULT '{}',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "nightly_device_capabilities_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "nightly_devices"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "nightly_device_claims" (
  "id" serial PRIMARY KEY NOT NULL,
  "device_id" integer NOT NULL,
  "venue_id" integer NOT NULL,
  "claimant_clerk_user_id" text NOT NULL,
  "claim_code_hash" text NOT NULL,
  "status" "nightly_device_claim_state" NOT NULL DEFAULT 'pending',
  "expires_at" timestamp,
  "used_at" timestamp,
  "revoked_at" timestamp,
  "metadata_json" text NOT NULL DEFAULT '{}',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "nightly_device_claims_claim_code_hash_unique" UNIQUE ("claim_code_hash"),
  CONSTRAINT "nightly_device_claims_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "nightly_devices"("id") ON DELETE CASCADE,
  CONSTRAINT "nightly_device_claims_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "nightly_devices_venue_id_idx" ON "nightly_devices" ("venue_id");
CREATE INDEX IF NOT EXISTS "nightly_devices_lifecycle_state_idx" ON "nightly_devices" ("lifecycle_state");
CREATE INDEX IF NOT EXISTS "nightly_devices_claim_state_idx" ON "nightly_devices" ("claim_state");
CREATE INDEX IF NOT EXISTS "nightly_devices_operational_state_idx" ON "nightly_devices" ("operational_state");
CREATE INDEX IF NOT EXISTS "nightly_devices_public_device_uuid_idx" ON "nightly_devices" ("public_device_uuid");
CREATE INDEX IF NOT EXISTS "nightly_devices_serial_number_idx" ON "nightly_devices" ("serial_number");

CREATE INDEX IF NOT EXISTS "nightly_device_assignments_device_id_idx" ON "nightly_device_assignments" ("device_id");
CREATE INDEX IF NOT EXISTS "nightly_device_assignments_venue_id_idx" ON "nightly_device_assignments" ("venue_id");
CREATE UNIQUE INDEX IF NOT EXISTS "nightly_device_assignments_active_unique" ON "nightly_device_assignments" ("device_id", "venue_id", "status");

CREATE INDEX IF NOT EXISTS "nightly_device_capabilities_device_id_idx" ON "nightly_device_capabilities" ("device_id");
CREATE INDEX IF NOT EXISTS "nightly_device_capabilities_category_idx" ON "nightly_device_capabilities" ("category");
CREATE UNIQUE INDEX IF NOT EXISTS "nightly_device_capabilities_device_name_unique" ON "nightly_device_capabilities" ("device_id", "category", "capability_name");

CREATE INDEX IF NOT EXISTS "nightly_device_claims_device_id_idx" ON "nightly_device_claims" ("device_id");
CREATE INDEX IF NOT EXISTS "nightly_device_claims_venue_id_idx" ON "nightly_device_claims" ("venue_id");
CREATE INDEX IF NOT EXISTS "nightly_device_claims_claimant_idx" ON "nightly_device_claims" ("claimant_clerk_user_id");
CREATE INDEX IF NOT EXISTS "nightly_device_claims_expires_at_idx" ON "nightly_device_claims" ("expires_at");
