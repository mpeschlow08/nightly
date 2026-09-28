DO $$ BEGIN
  CREATE TYPE nightly_device_commissioning_check AS ENUM (
    'cameras', 'audio', 'hdmi', 'hardware_acceleration', 'storage', 'internet', 'nightly_cloud'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE nightly_device_commissioning_status AS ENUM (
    'not_tested', 'checking', 'pass', 'warning', 'fail'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE nightly_devices
  ADD COLUMN IF NOT EXISTS bootstrap_token_hash text,
  ADD COLUMN IF NOT EXISTS service_suspended_at timestamp,
  ADD COLUMN IF NOT EXISTS management_recovery_eligible boolean NOT NULL DEFAULT true,
  ALTER COLUMN service_entitlement_state SET DEFAULT 'inactive';

UPDATE nightly_devices
SET service_entitlement_state = 'inactive'
WHERE claim_state = 'unclaimed' AND service_entitlement_state = 'active';

ALTER TABLE nightly_device_claims
  ADD COLUMN IF NOT EXISTS claim_code_hash text;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'nightly_device_claims' AND column_name = 'claim_code'
  ) THEN
    EXECUTE 'UPDATE nightly_device_claims SET claim_code_hash = ''legacy-revoked-'' || id::text, status = ''revoked'', revoked_at = COALESCE(revoked_at, now()) WHERE claim_code_hash IS NULL';
    ALTER TABLE nightly_device_claims DROP CONSTRAINT IF EXISTS nightly_device_claims_claim_code_unique;
    ALTER TABLE nightly_device_claims DROP COLUMN claim_code;
  END IF;
END $$;

UPDATE nightly_device_claims
SET claim_code_hash = 'legacy-revoked-' || id::text,
    status = 'revoked',
    revoked_at = COALESCE(revoked_at, now())
WHERE claim_code_hash IS NULL;

ALTER TABLE nightly_device_claims ALTER COLUMN claim_code_hash SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS nightly_device_claims_claim_code_hash_unique
  ON nightly_device_claims (claim_code_hash);

DO $$ BEGIN
  ALTER TABLE nightly_devices ADD CONSTRAINT nightly_devices_service_entitlement_state_check
    CHECK (service_entitlement_state IN ('inactive', 'trial', 'active', 'suspended', 'expired', 'cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE nightly_devices ADD CONSTRAINT nightly_devices_management_access_level_check
    CHECK (management_access_level IN ('owner_assisted', 'nightly_managed', 'recovery_only', 'disabled'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE nightly_devices ADD CONSTRAINT nightly_devices_privacy_mode_check
    CHECK (privacy_mode IN ('private', 'venue_only', 'public'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE nightly_devices ADD CONSTRAINT nightly_devices_content_eligibility_check
    CHECK (content_eligibility IN ('restricted', 'approved', 'blocked'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS nightly_devices_id_venue_unique
  ON nightly_devices (id, venue_id);

CREATE UNIQUE INDEX IF NOT EXISTS venue_cameras_id_venue_unique
  ON venue_cameras (id, venue_id);

CREATE TABLE IF NOT EXISTS nightly_device_sources (
  id serial PRIMARY KEY,
  device_id integer NOT NULL,
  venue_id integer NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  source_type nightly_device_source_type NOT NULL,
  source_label text NOT NULL,
  venue_camera_id integer,
  enabled boolean NOT NULL DEFAULT true,
  metadata_json text NOT NULL DEFAULT '{}',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT nightly_device_sources_device_type_label_unique UNIQUE (device_id, source_type, source_label),
  CONSTRAINT nightly_device_sources_venue_camera_unique UNIQUE (venue_camera_id),
  CONSTRAINT nightly_device_sources_camera_link_check CHECK (
    (source_type = 'ip_camera' AND venue_camera_id IS NOT NULL) OR
    (source_type <> 'ip_camera' AND venue_camera_id IS NULL)
  ),
  CONSTRAINT nightly_device_sources_device_venue_fkey FOREIGN KEY (device_id, venue_id)
    REFERENCES nightly_devices (id, venue_id) ON DELETE CASCADE,
  CONSTRAINT nightly_device_sources_camera_venue_fkey FOREIGN KEY (venue_camera_id, venue_id)
    REFERENCES venue_cameras (id, venue_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS nightly_device_commissioning_checks (
  id serial PRIMARY KEY,
  device_id integer NOT NULL REFERENCES nightly_devices(id) ON DELETE CASCADE,
  check_key nightly_device_commissioning_check NOT NULL,
  status nightly_device_commissioning_status NOT NULL DEFAULT 'not_tested',
  summary text,
  evidence_json text NOT NULL DEFAULT '{}',
  checked_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT nightly_device_commissioning_checks_device_check_unique UNIQUE (device_id, check_key),
  CONSTRAINT nightly_device_commissioning_checks_evidence_check CHECK (
    status IN ('not_tested', 'checking') OR (checked_at IS NOT NULL AND evidence_json <> '{}')
  )
);

CREATE INDEX IF NOT EXISTS nightly_device_sources_device_id_idx ON nightly_device_sources (device_id);
CREATE INDEX IF NOT EXISTS nightly_device_sources_venue_id_idx ON nightly_device_sources (venue_id);
CREATE INDEX IF NOT EXISTS nightly_device_sources_venue_camera_id_idx ON nightly_device_sources (venue_camera_id);
CREATE INDEX IF NOT EXISTS nightly_device_commissioning_checks_device_id_idx ON nightly_device_commissioning_checks (device_id);
CREATE INDEX IF NOT EXISTS nightly_device_commissioning_checks_status_idx ON nightly_device_commissioning_checks (status);