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
