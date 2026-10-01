CREATE TABLE fleet_update_rollouts (
  id serial PRIMARY KEY,
  target_version text NOT NULL,
  manifest_json text NOT NULL,
  state text NOT NULL DEFAULT 'available',
  created_by_clerk_user_id text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT fleet_update_rollouts_version_check CHECK (target_version ~ '^[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.-]+)?$'),
  CONSTRAINT fleet_update_rollouts_manifest_check CHECK (octet_length(manifest_json) between 1 and 2048),
  CONSTRAINT fleet_update_rollouts_state_check CHECK (state in ('available','scheduled','cancelled','completed'))
);
--> statement-breakpoint
CREATE INDEX fleet_update_rollouts_state_idx ON fleet_update_rollouts(state,created_at);
--> statement-breakpoint
CREATE TABLE fleet_update_targets (
  id serial PRIMARY KEY,
  rollout_id integer NOT NULL REFERENCES fleet_update_rollouts(id) ON DELETE RESTRICT,
  device_id integer NOT NULL REFERENCES nightly_devices(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'scheduled',
  failure_code text,
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT fleet_update_targets_rollout_device_unique UNIQUE (rollout_id,device_id),
  CONSTRAINT fleet_update_targets_state_check CHECK (state in ('scheduled','downloading','verifying','installing','restarting','health_check','succeeded','failed','rolled_back','recovery_required','cancelled')),
  CONSTRAINT fleet_update_targets_failure_check CHECK (failure_code IS NULL OR length(failure_code) <= 64)
);
--> statement-breakpoint
CREATE UNIQUE INDEX fleet_update_targets_active_device_unique ON fleet_update_targets(device_id) WHERE state in ('scheduled','downloading','verifying','installing','restarting','health_check');
--> statement-breakpoint
CREATE INDEX fleet_update_targets_state_idx ON fleet_update_targets(state,updated_at);