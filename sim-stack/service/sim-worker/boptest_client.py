"""BOPTEST HTTP client for sim-worker.

Self-contained: no imports from the backend. Mirrors the interface of
backend/api/v1/boptest/service.py but without SQLAlchemy or app state.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from config import settings

logger = logging.getLogger("sim-worker.boptest")


# ─── Exception ────────────────────────────────────────────────────────────────

class BOPTESTError(Exception):
    """Raised when a BOPTEST API call fails or returns an error response."""


# ─── Shared HTTP client (module-level singleton) ──────────────────────────────

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

    BOPTEST wraps responses as: {"status": <int>, "message": <str>, "payload": <data>}
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


# ─── Lifecycle ────────────────────────────────────────────────────────────────

async def select_test_case(testcase: str) -> str:
    """POST /testcases/<testcase>/select → testid."""
    c = await get_client()
    try:
        resp = await c.post(f"/testcases/{testcase}/select")
        data = _unwrap(resp, f"select_test_case({testcase})")
        return str(data["testid"] if isinstance(data, dict) else data)
    except BOPTESTError:
        raise
    except Exception as exc:
        raise BOPTESTError(f"select_test_case failed: {exc}") from exc


async def validate_testid(testid: str) -> bool:
    """Return True if testid is still alive on the BOPTEST server."""
    c = await get_client()
    try:
        resp = await c.get(f"/name/{testid}")
        return resp.status_code == 200
    except Exception:
        return False


# ─── Simulation control ───────────────────────────────────────────────────────

async def set_step(testid: str, step: float) -> float:
    """PUT /step/<testid> — set the simulation step size."""
    c = await get_client()
    try:
        resp = await c.put(f"/step/{testid}", json={"step": step})
        payload = _unwrap(resp, f"set_step({testid})")
        return float(payload["step"] if isinstance(payload, dict) else payload)
    except BOPTESTError:
        raise
    except Exception as exc:
        raise BOPTESTError(f"set_step failed: {exc}") from exc


async def initialize(testid: str, start_time: int = 0, warmup_period: int = 0) -> dict:
    """PUT /initialize/<testid> — reset simulation to start_time."""
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
    """GET /kpi/<testid> → current cumulative KPI values."""
    c = await get_client()
    try:
        resp = await c.get(f"/kpi/{testid}")
        return _unwrap(resp, f"get_kpis({testid})")  # type: ignore[return-value]
    except BOPTESTError:
        raise
    except Exception as exc:
        raise BOPTESTError(f"get_kpis failed: {exc}") from exc


# ─── Composite helpers ────────────────────────────────────────────────────────

# Forecast points needed to build a full BuildingSnapshot.
# Mirrors settings.forecast_point_names from the backend.
FORECAST_POINTS = [
    "LowerSetp[1]", "LowerSetp[2]", "LowerSetp[3]", "LowerSetp[4]", "LowerSetp[5]",
    "UpperSetp[1]", "UpperSetp[2]", "UpperSetp[3]", "UpperSetp[4]", "UpperSetp[5]",
    "Occupancy[1]", "Occupancy[2]", "Occupancy[3]", "Occupancy[4]", "Occupancy[5]",
]


async def advance_and_collect(testid: str) -> tuple[dict, dict, dict]:
    """Advance one step and return (outputs, forecast, kpis)."""
    outputs = await advance(testid, {})
    forecast = await get_forecast(
        testid,
        point_names=FORECAST_POINTS,
        horizon=settings.boptest_step * 2,
        interval=settings.boptest_step,
    )
    kpis = await get_kpis(testid)
    return outputs, forecast, kpis


async def deploy_fresh(testcase: str) -> str:
    """Select a new test case and return its testid."""
    logger.info("Deploying new test case: %s", testcase)
    testid = await select_test_case(testcase)
    logger.info("Deployed. testid=%s", testid)
    return testid
