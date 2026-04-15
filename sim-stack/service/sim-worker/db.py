"""TimescaleDB write helpers for sim-worker.

Uses asyncpg directly (no ORM) for maximum write performance.
All functions expect an active asyncpg connection pool.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

import asyncpg

from config import settings

logger = logging.getLogger("sim-worker.db")

# Module-level connection pool, initialized in worker.py startup.
_pool: asyncpg.Pool | None = None


async def init_pool() -> asyncpg.Pool:
    """Create and store the module-level asyncpg connection pool."""
    global _pool
    _pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=2,
        max_size=10,
        command_timeout=30,
    )
    logger.info("DB pool ready (min=2, max=10)")
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("DB pool closed")


def _get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("DB pool not initialized — call init_pool() first")
    return _pool


# ─── Writes ───────────────────────────────────────────────────────────────────

async def write_measurement(
    testid: str,
    sim_time: float,
    wall_time: datetime,
    outputs: dict[str, Any],
) -> None:
    """Insert one measurement row (full outputs JSONB)."""
    pool = _get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO measurements (testid, sim_time, wall_time, outputs)
            VALUES ($1, $2, $3, $4::jsonb)
            """,
            testid,
            sim_time,
            wall_time,
            json.dumps(outputs),
        )


async def write_kpis(
    testid: str,
    sim_time: float,
    wall_time: datetime,
    kpis: dict[str, Any],
) -> None:
    """Insert one KPI snapshot row."""
    pool = _get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO kpi_snapshots (testid, sim_time, wall_time, energy_tot, tdis_tot, cost_tot)
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            testid,
            sim_time,
            wall_time,
            _safe_float(kpis.get("ener_tot")),
            _safe_float(kpis.get("tdis_tot")),
            _safe_float(kpis.get("cost_tot")),
        )


async def upsert_checkpoint(
    testid: str,
    sim_time: float,
    wall_time: datetime,
) -> None:
    """Upsert the singleton checkpoint row (id=1) in simulation_runs."""
    pool = _get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO simulation_runs (id, testid, last_sim_time, last_wall_time,
                                         boptest_step, updated_at)
            VALUES (1, $1, $2, $3, $4, $5)
            ON CONFLICT (id) DO UPDATE SET
                testid         = EXCLUDED.testid,
                last_sim_time  = EXCLUDED.last_sim_time,
                last_wall_time = EXCLUDED.last_wall_time,
                boptest_step   = EXCLUDED.boptest_step,
                updated_at     = EXCLUDED.updated_at
            """,
            testid,
            sim_time,
            wall_time,
            settings.boptest_step,
            datetime.now(timezone.utc),
        )


async def get_checkpoint() -> tuple[str, float, datetime] | None:
    """Return (testid, last_sim_time, last_wall_time) or None if no checkpoint."""
    pool = _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT testid, last_sim_time, last_wall_time FROM simulation_runs WHERE id = 1"
        )
    if row is None:
        return None
    return row["testid"], row["last_sim_time"], row["last_wall_time"]


async def write_control_override(
    testid: str,
    sim_time: float,
    point_name: str,
    value: float,
    activate: bool = True,
) -> None:
    """Audit-log a control override that was sent to BOPTEST."""
    pool = _get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO control_overrides (testid, sim_time, point_name, value, activate)
            VALUES ($1, $2, $3, $4, $5)
            """,
            testid,
            sim_time,
            point_name,
            value,
            activate,
        )


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _safe_float(v: Any) -> float | None:
    """Convert a value to float, returning None for None/NaN/Inf."""
    if v is None:
        return None
    try:
        f = float(v)
        return None if (f != f or abs(f) == float("inf")) else f
    except (TypeError, ValueError):
        return None
