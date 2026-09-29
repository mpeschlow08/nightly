CREATE TABLE hot_reels (
  id serial PRIMARY KEY,
  public_id text NOT NULL UNIQUE,
  hot_moment_id text NOT NULL,
  venue_id integer NOT NULL REFERENCES venues(id),
  device_id integer NOT NULL REFERENCES nightly_devices(id),
  source_id integer NOT NULL REFERENCES nightly_device_sources(id),
  session_id integer REFERENCES artist_performance_sessions(id),
  lifecycle_state text NOT NULL DEFAULT 'local_ready',
  publication_state text NOT NULL DEFAULT 'private',
  review_state text NOT NULL DEFAULT 'pending',
  provider_key text NOT NULL DEFAULT 'mock',
  provider_object_key text,
  provider_object_version integer NOT NULL DEFAULT 1,
  content_hash text,
  content_bytes integer,
  content_type text NOT NULL DEFAULT 'video/mp4',
  duration_ms integer,
  captured_at timestamp,
  uploaded_at timestamp,
  finalized_at timestamp,
  expires_at timestamp,
  deleted_at timestamp,
  failure_code text,
  failure_reason text,
  metadata_json text NOT NULL DEFAULT '{}',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT hot_reels_state_check CHECK (lifecycle_state IN ('local_ready', 'upload_pending', 'uploading', 'uploaded', 'processing', 'ready', 'failed', 'expired', 'deleting', 'deleted')),
  CONSTRAINT hot_reels_publication_check CHECK (publication_state IN ('private', 'review', 'published', 'unpublished')),
  CONSTRAINT hot_reels_review_check CHECK (review_state IN ('pending', 'approved', 'hidden')),
  CONSTRAINT hot_reels_hot_moment_unique UNIQUE (hot_moment_id)
);
CREATE INDEX hot_reels_venue_id_idx ON hot_reels (venue_id);
CREATE INDEX hot_reels_device_id_idx ON hot_reels (device_id);
CREATE INDEX hot_reels_source_id_idx ON hot_reels (source_id);
CREATE INDEX hot_reels_lifecycle_state_idx ON hot_reels (lifecycle_state);
CREATE INDEX hot_reels_publication_state_idx ON hot_reels (publication_state);
CREATE INDEX hot_reels_expires_at_idx ON hot_reels (expires_at);
