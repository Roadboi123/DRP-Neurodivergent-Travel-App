-- 0004_analytics_metrics: stores user behavior and app performance analytics metrics.

CREATE TABLE IF NOT EXISTS journey_metrics (
    id                           SERIAL PRIMARY KEY,
    username                     text,
    time_to_start_seconds        double precision,
    actions_in_timeframe         integer,
    route_changed_after_warning  boolean,
    app_accesses_during_journey  integer,
    warning_clicked_for_info     boolean,
    created_at                   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS disruption_report_metrics (
    id                  SERIAL PRIMARY KEY,
    username            text,
    time_taken_seconds  double precision,
    would_contribute    boolean,
    created_at          timestamptz NOT NULL DEFAULT now()
);
