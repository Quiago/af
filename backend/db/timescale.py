"""asyncpg connection pool for direct TimescaleDB queries.

Used by the backend for historical/analytics queries that bypass sim-service.
The pool is initialized at app startup and closed at shutdown.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import asyncpg

from core.config import settings, logger

_pool: asyncpg.Pool | None = None

_BUCKET: dict[str, str] = {
    "1m": "1 minute",
    "1h": "1 hour",
    "1d": "1 day",
}


async def init_pool() -> None:
    """Create asyncpg pool. No-op if timescale_url is not configured."""
    global _pool
    if not settings.timescale_url:
        logger.info("TIMESCALE_URL not set — direct TimescaleDB queries disabled")
        return
    _pool = await asyncpg.create_pool(
        dsn=settings.timescale_url,
        min_size=2,
        max_size=10,
        command_timeout=30,
    )
    logger.info("TimescaleDB pool ready → %s", settings.timescale_url[:40])


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


def _get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError(
            "TimescaleDB pool not initialized. "
            "Set TIMESCALE_URL and USE_SIM_SERVICE=true."
        )
    return _pool


async def get_history(
    resolution: str,
    start_dt: datetime,
    end_dt: datetime,
) -> list[dict[str, Any]]:
    """Time-bucketed aggregation using TimescaleDB time_bucket().

    Falls back to most-recent 500 rows if the window has no data.
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
                "History fallback — no rows in [%s, %s], returning recent 500",
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

    return [dict(r) for r in rows]


async def get_timeseries(
    resolution: str,
    start_dt: datetime | None,
    end_dt: datetime,
    limit: int = 500,
) -> list[dict[str, Any]]:
    """Flexible trending — returns up to `limit` bucketed rows."""
    bucket_interval = _BUCKET.get(resolution, "1 minute")
    pool = _get_pool()

    async with pool.acquire() as conn:
        if start_dt is not None:
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
                LIMIT $4
                """,
                bucket_interval, start_dt, end_dt, limit,
            )
        else:
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
                WHERE wall_time <= $2
                GROUP BY time_bucket($1::interval, wall_time)
                ORDER BY 1 DESC
                LIMIT $3
                """,
                bucket_interval, end_dt, limit,
            )
            rows = list(reversed(rows))

    return [dict(r) for r in rows]
