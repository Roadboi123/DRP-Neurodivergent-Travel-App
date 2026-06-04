-- Schema for the preset-profiles feature (GET/POST /presets/).
--
-- This repo has no automated migrations: Supabase tables are created by hand in
-- the dashboard SQL editor (same as user_sensitivities / user_credentials).
-- Run this once against the Supabase project the backend points at (SUPABASE_URL)
-- before the presets endpoints will work — otherwise POST /presets/ returns a 500
-- ("Could not find the table 'public.user_presets'").
--
-- Columns mirror user_sensitivities (1..4 encoding via SENSITIVITY_MAP) so the
-- active preset can be mirrored there for route scoring.

CREATE TABLE IF NOT EXISTS user_presets (
    username           text    NOT NULL,
    preset_id          text    NOT NULL,            -- 'p1' | 'p2' | 'p3'
    name               text    NOT NULL,
    is_active          boolean NOT NULL DEFAULT false,
    noise_sensitivity  int     NOT NULL DEFAULT 2,
    crowd_sensitivity  int     NOT NULL DEFAULT 2,
    heat_sensitivity   int     NOT NULL DEFAULT 2,
    smell_sensitivity  int     NOT NULL DEFAULT 2,
    light_sensitivity  int     NOT NULL DEFAULT 2,
    PRIMARY KEY (username, preset_id),
    CONSTRAINT user_presets_preset_id_chk CHECK (preset_id IN ('p1', 'p2', 'p3'))
);
