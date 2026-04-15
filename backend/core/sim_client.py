"""HTTP client for sim-service.

The backend treats sim-service as an external operational data source
(analogous to a BMS or historian). All BOPTEST knowledge is hidden behind
this client.

Uses a module-level httpx.AsyncClient initialized at app startup.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import httpx

from core.config import settings, logger

_client: httpx.AsyncClient | None = None


class SimServiceError(Exception):
    """Raised when sim-service returns an unexpected response."""


def init_client() -> None:
    """Create the module-level client. Call once from lifespan."""
    global _client
    _client = httpx.AsyncClient(
        base_url=settings.sim_service_url,
        timeout=10.0,
    )
    logger.info("SimClient ready → %s", settings.sim_service_url)


async def close_client() -> None:
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
        _client = None


def _get() -> httpx.AsyncClient:
    if _client is None or _client.is_closed:
        raise SimServiceError("sim-service client not initialized")
    return _client


# ─── Live data ────────────────────────────────────────────────────────────────

async def get_current() -> dict[str, Any]:
    """GET /current → BuildingSnapshot dict (or raises SimServiceError)."""
    try:
        resp = await _get().get("/current")
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as exc:
        raise SimServiceError(
            f"sim-service /current returned {exc.response.status_code}"
        ) from exc
    except httpx.RequestError as exc:
        raise SimServiceError(f"sim-service unreachable: {exc}") from exc


async def get_status() -> dict[str, Any]:
    """GET /status → SimWorkerStatus dict."""
    try:
        resp = await _get().get("/status")
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        raise SimServiceError(f"sim-service /status failed: {exc}") from exc


async def post_control(point_name: str, value: float, activate: bool = True) -> dict[str, Any]:
    """POST /control → forward override to sim-service which forwards to BOPTEST."""
    try:
        resp = await _get().post(
            "/control",
            json={"point_name": point_name, "value": value, "activate": activate},
        )
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as exc:
        raise SimServiceError(
            f"sim-service /control returned {exc.response.status_code}: {exc.response.text[:200]}"
        ) from exc
    except httpx.RequestError as exc:
        raise SimServiceError(f"sim-service unreachable: {exc}") from exc
