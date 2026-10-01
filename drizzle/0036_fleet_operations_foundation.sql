CREATE TABLE fleet_device_snapshots (
  device_id integer PRIMARY KEY REFERENCES nightly_devices(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1,
  telemetry_json text NOT NULL DEFAULT '{}',
  received_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT fleet_device_snapshots_schema_check CHECK (schema_version = 1),
  CONSTRAINT fleet_device_snapshots_payload_check CHECK (octet_length(telemetry_json) <= 4096)
);
--> statement-breakpoint
CREATE TABLE fleet_device_alerts (
  id serial PRIMARY KEY,
  device_id integer NOT NULL REFERENCES nightly_devices(id) ON DELETE CASCADE,
  code text NOT NULL,
  severity text NOT NULL,
  state text NOT NULL DEFAULT 'open',
  first_observed_at timestamp NOT NULL DEFAULT now(),
  last_observed_at timestamp NOT NULL DEFAULT now(),
  occurrence_count integer NOT NULL DEFAULT 1,
  acknowledged_at timestamp,
  resolved_at timestamp,
  CONSTRAINT fleet_device_alerts_code_check CHECK (code ~ '^[A-Z_]{3,64}$'),
  CONSTRAINT fleet_device_alerts_severity_check CHECK (severity in ('info','warning','critical')),
  CONSTRAINT fleet_device_alerts_state_check CHECK (state in ('open','acknowledged','resolved')),
  CONSTRAINT fleet_device_alerts_count_check CHECK (occurrence_count > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX fleet_device_alerts_active_unique ON fleet_device_alerts(device_id,code) WHERE state <> 'resolved';
--> statement-breakpoint
CREATE INDEX fleet_device_alerts_device_history_idx ON fleet_device_alerts(device_id,last_observed_at);
--> statement-breakpoint
CREATE INDEX fleet_device_alerts_state_idx ON fleet_device_alerts(state,severity);
--> statement-breakpoint
CREATE TABLE fleet_support_grants (
  id serial PRIMARY KEY,
  device_id integer NOT NULL REFERENCES nightly_devices(id) ON DELETE CASCADE,
  actor_clerk_user_id text NOT NULL,
  scope text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  expires_at timestamp NOT NULL,
  revoked_at timestamp,
  CONSTRAINT fleet_support_grants_id_device_unique UNIQUE (id,device_id),
  CONSTRAINT fleet_support_grants_actor_check CHECK (length(actor_clerk_user_id) between 1 and 128),
  CONSTRAINT fleet_support_grants_scope_check CHECK (scope in ('device.read_diagnostics','device.request_health_check','device.restart_agent','device.retry_commissioning_step','device.request_update','device.collect_support_bundle')),
  CONSTRAINT fleet_support_grants_expiry_check CHECK (expires_at > created_at)
);
--> statement-breakpoint
CREATE INDEX fleet_support_grants_device_idx ON fleet_support_grants(device_id,expires_at);
--> statement-breakpoint
CREATE TABLE fleet_device_operations (
  id serial PRIMARY KEY,
  device_id integer NOT NULL REFERENCES nightly_devices(id) ON DELETE CASCADE,
  grant_id integer NOT NULL,
  idempotency_key text NOT NULL,
  type text NOT NULL,
  state text NOT NULL DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT now(),
  expires_at timestamp NOT NULL,
  acknowledged_at timestamp,
  completed_at timestamp,
  result_code text,
  CONSTRAINT fleet_device_operations_grant_device_fkey FOREIGN KEY (grant_id,device_id) REFERENCES fleet_support_grants(id,device_id) ON DELETE RESTRICT,
  CONSTRAINT fleet_device_operations_idempotency_unique UNIQUE (device_id,idempotency_key),
  CONSTRAINT fleet_device_operations_type_check CHECK (type in ('REQUEST_HEALTH_CHECK','RESTART_AGENT','RETRY_COMMISSIONING_STEP','REQUEST_DIAGNOSTIC_SNAPSHOT','REQUEST_SUPPORT_BUNDLE','REQUEST_UPDATE')),
  CONSTRAINT fleet_device_operations_state_check CHECK (state in ('pending','acknowledged','succeeded','failed','expired')),
  CONSTRAINT fleet_device_operations_expiry_check CHECK (expires_at > created_at),
  CONSTRAINT fleet_device_operations_key_check CHECK (length(idempotency_key) between 8 and 128),
  CONSTRAINT fleet_device_operations_result_check CHECK (result_code IS NULL OR length(result_code) <= 64)
);
--> statement-breakpoint
CREATE INDEX fleet_device_operations_pending_idx ON fleet_device_operations(device_id,state,expires_at);