"""sim-service — internal FastAPI exposing sim-stack data to the backend.

Endpoints:
  GET  /health    → DB + worker liveness check
  GET  /current   → latest BuildingSnapshot (outputs → transform)
  GET  /history   → HistoryPoint[] with time_bucket aggregation
  GET  /status    → sim-worker run state (simulation_runs row)
  POST /control   → write control override + advance BOPTEST

Port: 8001 (exposed to host for debugging; internal network for backend)
"""
from __future__ import annotations

import logging
import sys
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from typing import AsyncIterator

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

import db
from building_transform import build_snapshot, build_grid_config, history_rows_to_points
from config import settings
from schemas import (
    BuildingSnapshot,
    ControlPayload,
    GridConfig,
    HistoryPoint,
    SimWorkerStatus,
)

# ─── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("sim-service")

# ─── BOPTEST client (for /control) ────────────────────────────────────────────

_boptest_client: httpx.AsyncClient | None = None


def _boptest() -> httpx.AsyncClient:
    if _boptest_client is None:
        raise HTTPException(status_code=503, detail="BOPTEST client not ready")
    return _boptest_client


# ─── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    global _boptest_client

    logger.info("sim-service starting — connecting to DB and BOPTEST …")

    await db.init_pool()
    _boptest_client = httpx.AsyncClient(base_url=settings.boptest_url, timeout=60.0)
    logger.info("DB pool and BOPTEST client ready")

    yield

    await db.close_pool()
    if _boptest_client:
        await _boptest_client.aclose()
    logger.info("sim-service stopped")


# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(title="sim-service", version="0.3.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # internal network — no auth required
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> dict:
    """Liveness probe. Checks DB connectivity and sim-worker heartbeat."""
    try:
        status_row = await db.get_worker_status()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"DB unreachable: {exc}") from exc

    now = datetime.now(timezone.utc)
    seconds_since = None
    if status_row and status_row.get("last_wall_time"):
        lw = status_row["last_wall_time"]
        if lw.tzinfo is None:
            lw = lw.replace(tzinfo=timezone.utc)
        seconds_since = (now - lw).total_seconds()

    worker_alive = seconds_since is not None and seconds_since < 600

    return {
        "status": "ok",
        "db": "ok",
        "worker_alive": worker_alive,
        "seconds_since_last_tick": seconds_since,
        "testid": status_row.get("testid") if status_row else None,
    }


@app.get("/current", response_model=BuildingSnapshot)
async def get_current() -> BuildingSnapshot:
    """Return the latest BuildingSnapshot built from the most recent measurement row."""
    result = await db.get_latest_row()
    if result is None:
        raise HTTPException(
            status_code=503,
            detail="No measurements yet — sim-worker may still be initializing",
        )

    outputs, sim_time, wall_time = result

    # Build snapshot with empty forecast (forecast not stored in measurements).
    # The backend uses this for live display; setpoints fall back to defaults.
    snapshot = build_snapshot(
        outputs=outputs,
        forecast={},
        raw_kpis={},  # KPIs come from kpi_snapshots, not needed for snapshot shape
        wall_timestamp=wall_time.timestamp(),
    )
    return snapshot


@app.get("/history", response_model=list[HistoryPoint])
async def get_history(
    resolution: str = Query(default="1h", pattern="^(1m|1h|1d)$"),
    start_time: str = Query(default=None),
    end_time: str = Query(default=None),
) -> list[HistoryPoint]:
    """Time-bucketed measurement history.

    Args:
        resolution: bucket size — '1m', '1h', or '1d'
        start_time: ISO 8601 start (defaults to now - 24h)
        end_time:   ISO 8601 end   (defaults to now)
    """
    now = datetime.now(timezone.utc)

    try:
        end_dt   = datetime.fromisoformat(end_time)   if end_time   else now
        start_dt = datetime.fromisoformat(start_time) if start_time else now - timedelta(hours=24)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid datetime: {exc}") from exc

    # Ensure timezone-aware
    if end_dt.tzinfo is None:
        end_dt = end_dt.replace(tzinfo=timezone.utc)
    if start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=timezone.utc)

    rows = await db.get_history(resolution, start_dt, end_dt)
    return history_rows_to_points(rows)


@app.get("/status", response_model=SimWorkerStatus)
async def get_status() -> SimWorkerStatus:
    """Return sim-worker operational state from simulation_runs checkpoint row."""
    row = await db.get_worker_status()
    if row is None:
        return SimWorkerStatus(
            testid=None,
            mode="observation",
            last_sim_time=None,
            last_wall_time=None,
            boptest_step=None,
            seconds_since_update=None,
        )

    now = datetime.now(timezone.utc)
    lw: datetime | None = row.get("last_wall_time")
    if lw is not None and lw.tzinfo is None:
        lw = lw.replace(tzinfo=timezone.utc)

    seconds_since = (now - lw).total_seconds() if lw else None

    return SimWorkerStatus(
        testid=row.get("testid"),
        mode=row.get("mode", "observation"),
        last_sim_time=row.get("last_sim_time"),
        last_wall_time=lw.isoformat() if lw else None,
        boptest_step=row.get("boptest_step"),
        seconds_since_update=seconds_since,
    )


@app.post("/control")
async def post_control(payload: ControlPayload) -> dict:
    """Send a control override to BOPTEST and audit-log it.

    Reads current testid from simulation_runs checkpoint.
    Calls BOPTEST advance with the override inputs.
    """
    row = await db.get_worker_status()
    if not row or not row.get("testid"):
        raise HTTPException(status_code=503, detail="sim-worker not running — no testid available")

    testid   = row["testid"]
    sim_time = row.get("last_sim_time") or 0.0

    activate_key = payload.point_name.replace("_u", "_activate")
    inputs = {
        payload.point_name: payload.value,
        activate_key: 1.0 if payload.activate else 0.0,
    }

    try:
        resp = await _boptest().post(f"/advance/{testid}", json=inputs)
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"BOPTEST advance failed: {exc.response.status_code}",
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"BOPTEST unreachable: {exc}") from exc

    # Audit log
    try:
        await db.write_control_override(
            testid=testid,
            sim_time=sim_time,
            point_name=payload.point_name,
            value=payload.value,
            activate=payload.activate,
        )
    except Exception as exc:
        logger.warning("Failed to audit-log control override: %s", exc)

    return {"status": "ok", "testid": testid, "point": payload.point_name, "value": payload.value}


@app.get("/config/grid", response_model=GridConfig)
async def get_grid_config() -> GridConfig:
    """Return the zone grid layout (static, from config)."""
    return build_grid_config()
