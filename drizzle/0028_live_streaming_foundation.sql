ALTER TABLE venue_cameras
  ADD COLUMN IF NOT EXISTS live_provider text,
  ADD COLUMN IF NOT EXISTS provider_live_input_id text,
  ADD COLUMN IF NOT EXISTS provider_playback_id text,
  ADD COLUMN IF NOT EXISTS provisioning_status text NOT NULL DEFAULT 'unprovisioned',
  ADD COLUMN IF NOT EXISTS public_playback_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_known_stream_status text,
  ADD COLUMN IF NOT EXISTS last_health_check_at timestamp,
  ADD COLUMN IF NOT EXISTS last_provisioned_at timestamp,
  ADD COLUMN IF NOT EXISTS last_provisioning_error text;

CREATE INDEX IF NOT EXISTS venue_cameras_provider_live_input_id_idx
  ON venue_cameras (provider_live_input_id);
