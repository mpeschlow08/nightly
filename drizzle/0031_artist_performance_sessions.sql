CREATE TABLE artist_performance_sessions (
  id serial PRIMARY KEY,
  public_id text NOT NULL UNIQUE,
  dj_profile_id integer NOT NULL REFERENCES dj_profiles(id),
  user_id integer NOT NULL REFERENCES users(id),
  venue_id integer NOT NULL REFERENCES venues(id),
  event_id integer REFERENCES events(id),
  status text NOT NULL DEFAULT 'ready',
  origin text NOT NULL DEFAULT 'dj_checkin',
  checked_in_at timestamp NOT NULL DEFAULT now(),
  started_at timestamp,
  ended_at timestamp,
  include_microphone boolean NOT NULL DEFAULT false,
  media_revision integer NOT NULL DEFAULT 1,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT artist_sessions_status_check CHECK (status IN ('ready', 'active', 'ended', 'cancelled', 'failed')),
  CONSTRAINT artist_sessions_time_check CHECK (ended_at IS NULL OR (started_at IS NOT NULL AND ended_at >= started_at))
);
CREATE UNIQUE INDEX artist_sessions_one_active_dj_idx ON artist_performance_sessions (dj_profile_id) WHERE status = 'active';
CREATE INDEX artist_sessions_venue_status_idx ON artist_performance_sessions (venue_id, status);
CREATE INDEX artist_sessions_user_idx ON artist_performance_sessions (user_id);

CREATE TABLE artist_session_sources (
  id serial PRIMARY KEY,
  session_id integer NOT NULL REFERENCES artist_performance_sessions(id),
  source_id integer REFERENCES nightly_device_sources(id) ON DELETE SET NULL,
  device_id integer REFERENCES nightly_devices(id) ON DELETE SET NULL,
  source_key integer NOT NULL,
  device_key integer NOT NULL,
  source_type text NOT NULL,
  role text NOT NULL,
  label text NOT NULL,
  config_revision text NOT NULL,
  associated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT artist_session_source_unique UNIQUE (session_id, source_key),
  CONSTRAINT artist_session_sources_role_check CHECK (role IN ('camera', 'program_audio', 'ambient_audio'))
);
CREATE INDEX artist_session_sources_session_idx ON artist_session_sources (session_id);

CREATE TABLE artist_session_media (
  id serial PRIMARY KEY,
  session_id integer NOT NULL REFERENCES artist_performance_sessions(id),
  session_source_id integer NOT NULL REFERENCES artist_session_sources(id),
  device_id integer NOT NULL REFERENCES nightly_devices(id),
  candidate_id text NOT NULL,
  hot_id text NOT NULL,
  window_start_at timestamp NOT NULL,
  window_end_at timestamp NOT NULL,
  review_state text NOT NULL DEFAULT 'pending',
  include_microphone boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT artist_session_media_device_hot_unique UNIQUE (device_id, hot_id),
  CONSTRAINT artist_session_media_review_check CHECK (review_state IN ('pending', 'available', 'approved', 'hidden')),
  CONSTRAINT artist_session_media_window_check CHECK (window_end_at > window_start_at)
);
CREATE INDEX artist_session_media_session_idx ON artist_session_media (session_id);

CREATE TABLE artist_session_history (
  id serial PRIMARY KEY,
  session_id integer NOT NULL REFERENCES artist_performance_sessions(id),
  actor_user_id integer REFERENCES users(id),
  action text NOT NULL,
  occurred_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX artist_session_history_session_idx ON artist_session_history (session_id);