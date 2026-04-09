"""BOPTEST domain: HTTP client + lifecycle management.

All calls to the public BOPTEST API (https://api.boptest.net) live here.
Endpoints follow the pattern: /<request>/<testid>
Exception: POST /testcases/<name>/select  (no testid yet)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

from core.config import settings

logger = logging.getLogger(__name__)


# ─── Exception ────────────────────────────────────────────────────────────────

class BOPTESTError(Exception):
    """Raised when a BOPTEST API call fails."""


# ─── Shared HTTP client ───────────────────────────────────────────────────────

_client: httpx.AsyncClient | None = None


async def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(base_url=settings.boptest_url, timeout=60.0)
    return _client


async def close_client() -> None:
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
        _client = None


def _unwrap(response: httpx.Response, context: str) -> Any:
    """Extract payload from a BOPTEST response.

    Public API wraps all responses as:
      {"status": <int>, "message": <str>, "payload": <data>}
    The /select endpoint returns a bare {"testid": "..."}.
    """
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise BOPTESTError(
            f"{context}: HTTP {exc.response.status_code} — {exc.response.text[:200]}"
        ) from exc
    data = response.json()
    if isinstance(data, dict) and "payload" in data:
        return data["payload"]
    return data


# ─── Test case lifecycle ──────────────────────────────────────────────────────

async def select_test_case(testcase: str) -> str:
    """POST /testcases/<testcase>/select → testid string."""
    c = await get_client()
    try:
        resp = await c.post(f"/testcases/{testcase}/select")
        data = _unwrap(resp, f"select_test_case({testcase})")
        return str(data["testid"] if isinstance(data, dict) else data)
    except BOPTESTError:
        raise
    except Exception as exc:
        raise BOPTESTError(f"select_test_case failed: {exc}") from exc


async def stop_test_case(testid: str) -> None:
    """PUT /stop/<testid> — stop and release the test case."""
    c = await get_client()
    try:
        resp = await c.put(f"/stop/{testid}")
        _unwrap(resp, f"stop({testid})")
    except BOPTESTError:
        raise
    except Exception as exc:
        raise BOPTESTError(f"stop failed: {exc}") from exc


async def validate_testid(testid: str) -> bool:
    """Return True if testid is still alive on the server."""
    c = await get_client()
    try:
        resp = await c.get(f"/name/{testid}")
        return resp.status_code == 200
    except Exception:
        return False


# ─── Test case info ───────────────────────────────────────────────────────────

async def get_version(testid: str) -> str:
    c = await get_client()
    try:
        resp = await c.get(f"/version/{testid}")
        data = _unwrap(resp, f"get_version({testid})")
        return str(data.get("version", data))
    except BOPTESTError:
        raise
    except Exception as exc:
        raise BOPTESTError(f"get_version failed: {exc}") from exc


async def get_name(testid: str) -> str:
    c = await get_client()
    try:
        resp = await c.get(f"/name/{testid}")
        data = _unwrap(resp, f"get_name({testid})")
        return str(data.get("name", data))
    except BOPTESTError:
        raise
    except Exception as exc:
        raise BOPTESTError(f"get_name failed: {exc}") from exc


async def get_measurements(testid: str) -> dict[str, Any]:
    c = await get_client()
    try:
        resp = await c.get(f"/measurements/{testid}")
        return _unwrap(resp, f"get_measurements({testid})")  # type: ignore[return-value]
    except BOPTESTError:
        raise
    except Exception as exc:
        raise BOPTESTError(f"get_measurements failed: {exc}") from exc


async def get_inputs(testid: str) -> dict[str, Any]:
    c = await get_client()
    try:
        resp = await c.get(f"/inputs/{testid}")
        return _unwrap(resp, f"get_inputs({testid})")  # type: ignore[return-value]
    except BOPTESTError:
        raise
    except Exception as exc:
        raise BOPTESTError(f"get_inputs failed: {exc}") from exc


async def get_forecast_points(testid: str) -> dict[str, Any]:
    c = await get_client()
    try:
        resp = await c.get(f"/forecast_points/{testid}")
        return _unwrap(resp, f"get_forecast_points({testid})")  # type: ignore[return-value]
    except BOPTESTError:
        raise
    except Exception as exc:
        raise BOPTESTError(f"get_forecast_points failed: {exc}") from exc


# ─── Simulation control ───────────────────────────────────────────────────────

async def get_step(testid: str) -> float:
    c = await get_client()
    try:
        resp = await c.get(f"/step/{testid}")
        payload = _unwrap(resp, f"get_step({testid})")
        return float(payload["step"] if isinstance(payload, dict) else payload)
    except BOPTESTError:
        raise
    except Exception as exc:
        raise BOPTESTError(f"get_step failed: {exc}") from exc


async def set_step(testid: str, step: float) -> float:
    c = await get_client()
    try:
        resp = await c.put(f"/step/{testid}", json={"step": step})
        payload = _unwrap(resp, f"set_step({testid})")
        # BOPTEST public API returns {"step": <float>}, not a bare float
        return float(payload["step"] if isinstance(payload, dict) else payload)
    except BOPTESTError:
        raise
    except Exception as exc:
        raise BOPTESTError(f"set_step failed: {exc}") from exc


async def initialize(testid: str, start_time: int = 0, warmup_period: int = 0) -> dict:
    c = await get_client()
    try:
        resp = await c.put(
            f"/initialize/{testid}",
            json={"start_time": start_time, "warmup_period": warmup_period},
        )
        return _unwrap(resp, f"initialize({testid})")  # type: ignore[return-value]
    except BOPTESTError:
        raise
    except Exception as exc:
        raise BOPTESTError(f"initialize failed: {exc}") from exc


async def get_scenario(testid: str) -> dict[str, Any]:
    c = await get_client()
    try:
        resp = await c.get(f"/scenario/{testid}")
        return _unwrap(resp, f"get_scenario({testid})")  # type: ignore[return-value]
    except BOPTESTError:
        raise
    except Exception as exc:
        raise BOPTESTError(f"get_scenario failed: {exc}") from exc


async def set_scenario(testid: str, scenario: str, price: str) -> dict:
    """PUT /scenario/<testid> — setting time_period also initializes the simulation.

    Uses a long timeout (5 min) because set_scenario triggers a full 1-week
    warmup simulation on the BOPTEST worker, which can take 2-3 minutes for
    the multizone_office_simple_air test case.
    """
    c = await get_client()
    try:
        resp = await c.put(
            f"/scenario/{testid}",
            json={"time_period": scenario, "electricity_price": price},
            timeout=300.0,   # 5 min — warmup can take ~2-3 min
        )
        return _unwrap(resp, f"set_scenario({testid})")  # type: ignore[return-value]
    except BOPTESTError:
        raise
    except Exception as exc:
        raise BOPTESTError(f"set_scenario failed: {exc}") from exc


async def advance(testid: str, inputs: dict[str, Any] | None = None) -> dict[str, Any]:
    """POST /advance/<testid> — advance one control step, return all outputs."""
    c = await get_client()
    try:
        resp = await c.post(f"/advance/{testid}", json=inputs or {})
        return _unwrap(resp, f"advance({testid})")  # type: ignore[return-value]
    except BOPTESTError:
        raise
    except Exception as exc:
        raise BOPTESTError(f"advance failed: {exc}") from exc


async def advance_only(testid: str) -> dict[str, Any]:
    """POST /advance/<testid> with no forecast/kpi calls.

    Used exclusively during Phase 1 backfill to minimise HTTP round-trips.
    Callers MUST NOT build a BuildingSnapshot from this — forecast/kpi are absent.
    """
    c = await get_client()
    try:
        resp = await c.post(f"/advance/{testid}", json={})
        return _unwrap(resp, f"advance_only({testid})")  # type: ignore[return-value]
    except BOPTESTError:
        raise
    except Exception as exc:
        raise BOPTESTError(f"advance_only failed: {exc}") from exc


async def get_results(
    testid: str,
    point_names: list[str],
    start_time: float,
    final_time: float,
) -> dict[str, Any]:
    """PUT /results/<testid> — historical data for a time range."""
    c = await get_client()
    try:
        resp = await c.put(
            f"/results/{testid}",
            json={"point_names": point_names, "start_time": start_time, "final_time": final_time},
        )
        return _unwrap(resp, f"get_results({testid})")  # type: ignore[return-value]
    except BOPTESTError:
        raise
    except Exception as exc:
        raise BOPTESTError(f"get_results failed: {exc}") from exc


async def get_forecast(
    testid: str,
    point_names: list[str],
    horizon: int = 3600,
    interval: int = 300,
) -> dict[str, list[float]]:
    """PUT /forecast/<testid> — boundary condition forecasts from current time."""
    c = await get_client()
    try:
        resp = await c.put(
            f"/forecast/{testid}",
            json={"point_names": point_names, "horizon": horizon, "interval": interval},
        )
        return _unwrap(resp, f"get_forecast({testid})")  # type: ignore[return-value]
    except BOPTESTError:
        raise
    except Exception as exc:
        raise BOPTESTError(f"get_forecast failed: {exc}") from exc


async def get_kpis(testid: str) -> dict[str, float]:
    """GET /kpi/<testid> → current KPI values."""
    c = await get_client()
    try:
        resp = await c.get(f"/kpi/{testid}")
        return _unwrap(resp, f"get_kpis({testid})")  # type: ignore[return-value]
    except BOPTESTError:
        raise
    except Exception as exc:
        raise BOPTESTError(f"get_kpis failed: {exc}") from exc


# ─── Lifecycle helpers (used by main.py + router) ────────────────────────────

async def _fresh_testid() -> str:
    """Deploy a new test case and set the live step size. Returns testid.

    Does NOT call set_scenario — that is reserved for the benchmark runner.
    Does NOT persist to .env — testid is stored in the SimulationRun checkpoint table.
    The historian loop calls set_step(backfill_step_seconds) and initialize() separately.
    """
    logger.info("Deploying new test case: %s", settings.boptest_test_case)
    testid = await select_test_case(settings.boptest_test_case)
    logger.info("Deployed. testid=%s", testid)
    return testid


async def setup_boptest() -> str:
    """Return a valid testid.

    Priority:
    1. testid stored in SimulationRun checkpoint table (survives .env resets)
    2. testid in settings.boptest_test_id (legacy .env, backwards compat)
    3. Deploy a fresh test case
    """
    # 1. Check checkpoint table
    cp = await get_last_checkpoint()
    if cp:
        _, _, checkpoint_testid = cp
        if checkpoint_testid:
            logger.info("Validating testid from checkpoint: %s …", checkpoint_testid)
            if await validate_testid(checkpoint_testid):
                logger.info("Checkpoint testid valid — reusing.")
                return checkpoint_testid
            logger.warning("Checkpoint testid=%s expired.", checkpoint_testid)

    # 2. Legacy .env fallback
    stored = settings.boptest_test_id
    if stored:
        logger.info("Validating testid from .env: %s …", stored)
        if await validate_testid(stored):
            logger.info("Stored testid valid — reusing.")
            return stored
        logger.warning("Stored testid=%s expired.", stored)

    # 3. Deploy fresh
    return await _fresh_testid()


async def advance_and_collect(testid: str) -> tuple[dict, dict, dict]:
    """Advance one step and return (outputs, forecast, kpis)."""
    outputs  = await advance(testid, {})
    forecast = await get_forecast(
        testid,
        point_names=settings.forecast_point_names,
        horizon=settings.boptest_step * 2,
        interval=settings.boptest_step,
    )
    kpis = await get_kpis(testid)
    return outputs, forecast, kpis


# ─── DB persistence ───────────────────────────────────────────────────────────

_K_TO_C = 273.15


async def save_measurement(timestamp: datetime, outputs: dict[str, Any]) -> None:
    """Persist one BOPTEST measurement row to the database."""
    await save_measurements_bulk([(timestamp, outputs)])


async def save_measurements_bulk(rows: list[tuple[datetime, dict[str, Any]]]) -> None:
    """Persist a batch of BOPTEST measurements in a single DB commit.

    Accepts a list of (wall_clock_timestamp, advance_outputs) tuples.
    Using session.add_all() + a single commit avoids the per-row commit overhead
    that would otherwise bottleneck the Phase 1 backfill loop.
    """
    from db.engine import AsyncSessionLocal
    from api.v1.boptest.models import BoptestMeasurement

    records: list[BoptestMeasurement] = []
    for timestamp, outputs in rows:
        temp_k = outputs.get("hvac_reaZonCor_TZon_y")
        records.append(
            BoptestMeasurement(
                timestamp=timestamp,
                fan_power_w=outputs.get("hvac_reaAhu_PFanSup_y"),
                core_temp_c=round(temp_k - _K_TO_C, 2) if temp_k is not None else None,
                core_co2_ppm=outputs.get("hvac_reaZonCor_CO2Zon_y"),
            )
        )

    async with AsyncSessionLocal() as session:
        session.add_all(records)
        await session.commit()


# ─── Checkpoint helpers ───────────────────────────────────────────────────────

async def get_last_checkpoint() -> tuple[float, datetime, str] | None:
    """Return (last_sim_time, last_wall_time, testid) from the singleton checkpoint row.

    Returns None if no checkpoint exists yet (first boot).
    """
    from db.engine import AsyncSessionLocal
    from api.v1.boptest.models import SimulationRun
    from sqlalchemy import select as sa_select

    async with AsyncSessionLocal() as session:
        row = await session.get(SimulationRun, 1)
        if row is None:
            return None
        return row.last_sim_time, row.last_wall_time, row.testid


async def save_checkpoint(sim_time: float, wall_time: datetime, testid: str) -> None:
    """Upsert the singleton checkpoint row (id=1)."""
    from db.engine import AsyncSessionLocal
    from api.v1.boptest.models import SimulationRun

    async with AsyncSessionLocal() as session:
        row = await session.get(SimulationRun, 1)
        now = datetime.now(timezone.utc)
        if row is None:
            row = SimulationRun(
                id=1,
                testid=testid,
                last_sim_time=sim_time,
                last_wall_time=wall_time,
                boptest_step=settings.boptest_step,
                updated_at=now,
            )
            session.add(row)
        else:
            row.testid        = testid
            row.last_sim_time = sim_time
            row.last_wall_time = wall_time
            row.boptest_step  = settings.boptest_step
            row.updated_at    = now
        await session.commit()
