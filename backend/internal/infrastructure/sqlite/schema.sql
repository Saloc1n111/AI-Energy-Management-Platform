CREATE TABLE IF NOT EXISTS meters (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    meter_id   TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL,
    location   TEXT NOT NULL DEFAULT '',
    status     TEXT NOT NULL DEFAULT 'OK',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Foto por medidor del último análisis (consumo actual, baseline, variación, severidad top).
CREATE TABLE IF NOT EXISTS meter_metrics (
    meter_id         TEXT PRIMARY KEY REFERENCES meters(meter_id),
    current_kwh      REAL NOT NULL,
    baseline_kwh     REAL NOT NULL,
    variation_pct    REAL NOT NULL,
    period_kwh       REAL NOT NULL,
    top_severity     TEXT NOT NULL DEFAULT '',
    top_anomaly_type TEXT NOT NULL DEFAULT '',
    analyzed_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS readings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    meter_id        TEXT NOT NULL REFERENCES meters(meter_id),
    timestamp       TEXT NOT NULL,
    consumption_kwh REAL NOT NULL,
    voltage_v       REAL NOT NULL,
    current_a       REAL NOT NULL,
    power_factor    REAL NOT NULL,
    status          TEXT NOT NULL,
    UNIQUE (meter_id, timestamp)
);
CREATE INDEX IF NOT EXISTS idx_readings_meter_ts ON readings(meter_id, timestamp);

CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    meter_id    TEXT NOT NULL REFERENCES meters(meter_id),
    timestamp   TEXT NOT NULL,
    type        TEXT NOT NULL,
    description TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_meter ON events(meter_id);

CREATE TABLE IF NOT EXISTS anomalies (
    id                  TEXT PRIMARY KEY,
    run_id              TEXT NOT NULL,
    meter_id            TEXT NOT NULL REFERENCES meters(meter_id),
    detected_at         TEXT NOT NULL,
    window_start        TEXT NOT NULL,
    window_end          TEXT NOT NULL,
    type                TEXT NOT NULL,
    severity            TEXT NOT NULL,
    confidence          REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    confidence_factors  TEXT NOT NULL DEFAULT '[]',
    signals             TEXT NOT NULL DEFAULT '[]',
    evidence            TEXT NOT NULL DEFAULT '[]',
    related_event       TEXT,
    reason              TEXT NOT NULL,
    recommended_action  TEXT NOT NULL,
    investigation_steps TEXT NOT NULL DEFAULT '[]',
    explained_by        TEXT NOT NULL DEFAULT 'deterministic',
    status              TEXT NOT NULL DEFAULT 'OPEN'
);
CREATE INDEX IF NOT EXISTS idx_anomalies_meter ON anomalies(meter_id);

CREATE TABLE IF NOT EXISTS analysis_runs (
    id          TEXT PRIMARY KEY,
    status      TEXT NOT NULL,
    started_at  TEXT NOT NULL,
    finished_at TEXT,
    steps       TEXT NOT NULL,
    summary     TEXT NOT NULL DEFAULT '{}',
    error       TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_runs_started ON analysis_runs(started_at);

CREATE TABLE IF NOT EXISTS technical_visits (
    id            TEXT PRIMARY KEY,
    meter_id      TEXT NOT NULL,
    urgency       TEXT NOT NULL,
    reason        TEXT NOT NULL,
    contact_name  TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    notes         TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'CONFIRMED',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_visits_meter ON technical_visits(meter_id);
