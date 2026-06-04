-- 0001_baseline: tables that predate the migration system (created by hand in
-- the Supabase dashboard). CREATE TABLE IF NOT EXISTS so this is a no-op on the
-- existing prod database and recreates the schema on a fresh database.
--
-- Columns mirror what the services read/write:
--   user_credentials   -> app/services/auth.py
--   user_sensitivities -> app/services/preferences.py (+ routes.py scoring)
--   healthcheck        -> app/api/diagnostics.py

CREATE TABLE IF NOT EXISTS user_credentials (
    username        text PRIMARY KEY,   -- stored lowercased
    hashed_password text NOT NULL
);

CREATE TABLE IF NOT EXISTS user_sensitivities (
    username          text PRIMARY KEY,
    noise_sensitivity int,
    crowd_sensitivity int,
    heat_sensitivity  int,
    smell_sensitivity int,
    light_sensitivity int
);

CREATE TABLE IF NOT EXISTS healthcheck (
    id      text PRIMARY KEY,           -- uuid string
    message text
);
