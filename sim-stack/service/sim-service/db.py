"""TimescaleDB read helpers for sim-service.

Uses asyncpg directly for time-series queries with time_bucket().
The pool is initialized once at app startup via lifespan().
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

import asyncpg

from config import settings

logger = logging.getLogger("sim-service.db")

_pool: asyncpg.Pool | None = None

# Bucket intervals mapped from frontend resolution tokens
_BUCKET: dict[str, str] = {
    "1m": "1 minute",
    "1h": "1 hour",
    "1d": "1 day",
}


async def init_pool() -> asyncpg.Pool:
    global _pool
    _pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=2,
        max_size=10,
        command_timeout=30,
    )
    logger.info("DB pool ready")
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


def _get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("DB pool not initialized")
    return _pool


# ─── Current snapshot ─────────────────────────────────────────────────────────

async def get_latest_row() -> tuple[dict[str, Any], float, datetime] | None:
    """Return (outputs, sim_time, wall_time) of the most recent measurement, or None."""
    pool = _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT outputs, sim_time, wall_time
            FROM measurements
            ORDER BY wall_time DESC
            LIMIT 1
            """
        )
    if row is None:
        return None
    outputs = json.loads(row["outputs"]) if isinstance(row["outputs"], str) else dict(row["outputs"])
    return outputs, float(row["sim_time"]), row["wall_time"]


# ─── History (time-series) ────────────────────────────────────────────────────

async def get_history(
    resolution: str,
    start_dt: datetime,
    end_dt: datetime,
) -> list[dict[str, Any]]:
    """Time-bucketed aggregation of measurements for the requested window.

    Returns rows with: timestamp (Unix int), core_temp_c (avg), fan_power_w (max),
    core_co2_ppm (avg).

    Falls back to most-recent 500 raw rows if the window has no data yet.
    """
    bucket_interval = _BUCKET.get(resolution, "1 hour")
    pool = _get_pool()

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                EXTRACT(EPOCH FROM time_bucket($1::interval, wall_time))::bigint AS timestamp,
                AVG((outputs->>'hvac_reaZonCor_TZon_y')::double precision) - 273.15
                    AS core_temp_c,
                MAX((outputs->>'hvac_reaAhu_PFanSup_y')::double precision)
                    AS fan_power_w,
                AVG((outputs->>'hvac_reaZonCor_CO2Zon_y')::double precision)
                    AS core_co2_ppm
            FROM measurements
            WHERE wall_time BETWEEN $2 AND $3
            GROUP BY time_bucket($1::interval, wall_time)
            ORDER BY 1
            """,
            bucket_interval, start_dt, end_dt,
        )

        if not rows:
            logger.info(
                "History: no rows in [%s, %s] — returning recent 500",
                start_dt.isoformat(timespec="seconds"),
                end_dt.isoformat(timespec="seconds"),
            )
            rows = await conn.fetch(
                """
                SELECT
                    EXTRACT(EPOCH FROM time_bucket('1 minute', wall_time))::bigint AS timestamp,
                    AVG((outputs->>'hvac_reaZonCor_TZon_y')::double precision) - 273.15
                        AS core_temp_c,
                    MAX((outputs->>'hvac_reaAhu_PFanSup_y')::double precision)
                        AS fan_power_w,
                    AVG((outputs->>'hvac_reaZonCor_CO2Zon_y')::double precision)
                        AS core_co2_ppm
                FROM measurements
                GROUP BY time_bucket('1 minute', wall_time)
                ORDER BY 1 DESC
                LIMIT 500
                """
            )
            rows = list(reversed(rows))

        logger.info("History: resolution=%s → %d rows", resolution, len(rows))

    return [dict(r) for r in rows]


# ─── Worker status ────────────────────────────────────────────────────────────

async def get_worker_status() -> dict[str, Any] | None:
    """Return the latest simulation_runs row (id=1), or None."""
    pool = _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM simulation_runs WHERE id = 1"
        )
    if row is None:
        return None
    return dict(row)


# ─── Control override (write) ─────────────────────────────────────────────────

async def write_control_override(
    testid: str,
    sim_time: float,
    point_name: str,
    value: float,
    activate: bool,
) -> None:
    pool = _get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO control_overrides (testid, sim_time, point_name, value, activate)
            VALUES ($1, $2, $3, $4, $5)
            """,
            testid, sim_time, point_name, value, activate,
        )
