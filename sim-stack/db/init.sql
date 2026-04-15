-- sim-stack TimescaleDB schema
-- Runs automatically on first container start via docker-entrypoint-initdb.d

CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ── measurements ──────────────────────────────────────────────────────────────
-- Full advance() output stored as JSONB. Hypertable partitioned by wall_time.
CREATE TABLE IF NOT EXISTS measurements (
    id        BIGSERIAL,
    testid    TEXT             NOT NULL,
    sim_time  DOUBLE PRECISION NOT NULL,  -- simulation seconds elapsed
    wall_time TIMESTAMPTZ      NOT NULL,  -- real-world timestamp
    outputs   JSONB            NOT NULL   -- complete advance() response dict
);

SELECT create_hypertable('measurements', 'wall_time', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS measurements_testid_wall ON measurements (testid, wall_time DESC);

-- ── simulation_runs ────────────────────────────────────────────────────────────
-- Singleton checkpoint row (id = 1) so sim-worker can resume after restart.
CREATE TABLE IF NOT EXISTS simulation_runs (
    id             INTEGER PRIMARY KEY DEFAULT 1,
    testid         TEXT,
    last_sim_time  DOUBLE PRECISION,
    last_wall_time TIMESTAMPTZ,
    boptest_step   INTEGER,
    mode           TEXT        NOT NULL DEFAULT 'observation',  -- 'observation' | 'control'
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- ── control_overrides ──────────────────────────────────────────────────────────
-- Audit log of every control input sent to BOPTEST.
CREATE TABLE IF NOT EXISTS control_overrides (
    id         BIGSERIAL PRIMARY KEY,
    testid     TEXT             NOT NULL,
    sim_time   DOUBLE PRECISION NOT NULL,
    wall_time  TIMESTAMPTZ      NOT NULL DEFAULT now(),
    point_name TEXT             NOT NULL,
    value      DOUBLE PRECISION NOT NULL,
    activate   BOOLEAN          NOT NULL DEFAULT TRUE
);

-- ── kpi_snapshots ──────────────────────────────────────────────────────────────
-- Periodic KPI records from BOPTEST /kpi endpoint. Hypertable by wall_time.
CREATE TABLE IF NOT EXISTS kpi_snapshots (
    id         BIGSERIAL,
    testid     TEXT             NOT NULL,
    sim_time   DOUBLE PRECISION NOT NULL,
    wall_time  TIMESTAMPTZ      NOT NULL,
    energy_tot DOUBLE PRECISION,  -- kWh/m²
    tdis_tot   DOUBLE PRECISION,  -- Kh
    cost_tot   DOUBLE PRECISION   -- currency/m²
);

SELECT create_hypertable('kpi_snapshots', 'wall_time', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS kpi_testid_wall ON kpi_snapshots (testid, wall_time DESC);
