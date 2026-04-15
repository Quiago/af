"""Building data REST endpoints."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from enum import Enum

from fastapi import APIRouter, HTTPException, Query, Request

from api.v1.building.schemas import BuildingSnapshot, GridConfig, HistoryPoint, KPIs
from api.v1.building.service import build_grid_config, get_history

from core.config import logger

router = APIRouter(prefix="/building", tags=["building"])


class Resolution(str, Enum):
    one_minute = "1m"
    one_hour   = "1h"
    one_day    = "1d"


def _require_snapshot(request: Request) -> BuildingSnapshot:
    snapshot = getattr(request.app.state, "current_snapshot", None)
    if snapshot is None:
        raise HTTPException(status_code=503, detail="Simulation not ready")
    return snapshot


@router.get("/snapshot", response_model=BuildingSnapshot)
async def get_snapshot(request: Request) -> BuildingSnapshot:
    return _require_snapshot(request)


@router.get("/kpis", response_model=KPIs)
async def get_kpis(request: Request) -> KPIs:
    return _require_snapshot(request).kpis


@router.get("/config", response_model=GridConfig)
async def get_config() -> GridConfig:
    return build_grid_config()


@router.get("/latest", response_model=BuildingSnapshot | None)
async def get_latest(request: Request) -> BuildingSnapshot | None:
    """Return the most recent snapshot, or null if none yet.

    Unlike /snapshot this never returns 503 — useful for polling during startup.
    """
    return getattr(request.app.state, "current_snapshot", None)


@router.get("/history", response_model=list[HistoryPoint])
async def get_history_endpoint(
    resolution: Resolution = Query(Resolution.one_hour, description="Bucket size"),
    start_time: datetime | None = Query(None, description="ISO 8601 start (default: last week)"),
    end_time:   datetime | None = Query(None, description="ISO 8601 end   (default: now)"),
) -> list[HistoryPoint]:
    """Return downsampled time-series data for timeline charts.

    AVG is used for temperature / CO2; MAX is used for fan power (peak demand).
    """
    now = datetime.now(timezone.utc)
    return await get_history(
        resolution.value,
        start_time or now - timedelta(weeks=1),
        end_time   or now,
    )


@router.get("/timeseries", response_model=list[HistoryPoint])
async def get_timeseries(
    resolution: Resolution = Query(Resolution.one_minute, description="Bucket size"),
    start_time: datetime | None = Query(None),
    end_time:   datetime | None = Query(None),
    limit:      int = Query(500, ge=1, le=10_000, description="Max rows returned"),
) -> list[HistoryPoint]:
    """Flexible trending endpoint — returns up to `limit` rows from the historian.

    When start_time/end_time are omitted the most recent `limit` rows are returned
    regardless of absolute time (useful for trending views and Digital Twin data).
    """
    from api.v1.building.service import get_timeseries as _get_ts
    now = datetime.now(timezone.utc)
    return await _get_ts(
        resolution.value,
        start_time,
        end_time or now,
        limit,
    )
