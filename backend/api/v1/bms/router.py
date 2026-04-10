"""BMS REST endpoints.

GET  /api/v1/bms/snapshot  — latest BOPTEST measurements + derived KPIs
POST /api/v1/bms/control   — write a setpoint override via BOPTEST advance
"""
from __future__ import annotations

import logging
import time

from fastapi import APIRouter, HTTPException, Request

from api.v1.boptest.service import BOPTESTError, advance, get_results
from .schemas import BmsControlPayload, BmsSnapshot

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/bms", tags=["bms"])

# ── Physical constants ────────────────────────────────────────────────────────
_RHO_WATER = 1000.0   # kg/m³
_CP_WATER  = 4186.0   # J/(kg·K)
_RHO_AIR   = 1.2      # kg/m³
_CP_AIR    = 1006.0   # J/(kg·K)

# Illinois grid carbon factor (kg CO₂ / kWh)
_CO2_FACTOR = 0.341

# ── All BOPTEST sensor points needed ─────────────────────────────────────────
_POINTS: list[str] = [
    "chi_reaPChi_y",
    "chi_reaPPumDis_y",
    "chi_reaTSup_y",
    "chi_reaTRet_y",
    "chi_reaFloSup_y",
    "heaPum_reaPHeaPum_y",
    "heaPum_reaPPumDis_y",
    "heaPum_reaTSup_y",
    "heaPum_reaTRet_y",
    "heaPum_reaFloSup_y",
    "hvac_reaAhu_PFanSup_y",
    "hvac_reaAhu_TMix_y",
    "hvac_reaAhu_TSup_y",
    "hvac_reaAhu_TRet_y",
    "hvac_reaAhu_V_flow_sup_y",
    "hvac_reaAhu_V_flow_ret_y",
    "hvac_reaAhu_TCooCoiSup_y",
    "hvac_reaAhu_TCooCoiRet_y",
    "hvac_reaAhu_dp_sup_y",
    "hvac_reaZonCor_TZon_y",
    "hvac_reaZonCor_V_flow_y",
    "hvac_reaZonCor_CO2Zon_y",
    "hvac_reaZonCor_TSup_y",
    "hvac_reaZonNor_TZon_y",
    "hvac_reaZonNor_V_flow_y",
    "hvac_reaZonNor_CO2Zon_y",
    "hvac_reaZonNor_TSup_y",
    "hvac_reaZonSou_TZon_y",
    "hvac_reaZonSou_V_flow_y",
    "hvac_reaZonSou_CO2Zon_y",
    "hvac_reaZonSou_TSup_y",
    "hvac_reaZonEas_TZon_y",
    "hvac_reaZonEas_V_flow_y",
    "hvac_reaZonEas_CO2Zon_y",
    "hvac_reaZonEas_TSup_y",
    "hvac_reaZonWes_TZon_y",
    "hvac_reaZonWes_V_flow_y",
    "hvac_reaZonWes_CO2Zon_y",
    "hvac_reaZonWes_TSup_y",
    "weaSta_reaWeaTDryBul_y",
]


def _last(raw: dict, key: str, default: float = 0.0) -> float:
    """Extract the last value from a BOPTEST result series."""
    series = raw.get(key)
    if isinstance(series, list) and series:
        v = series[-1]
        return float(v) if v is not None else default
    return default


def _water_kw(flow_m3s: float, t_hot_k: float, t_cold_k: float) -> float:
    return flow_m3s * _RHO_WATER * _CP_WATER * abs(t_hot_k - t_cold_k) / 1000.0


@router.get("/snapshot", response_model=BmsSnapshot)
async def bms_snapshot(request: Request) -> BmsSnapshot:
    """Fetch latest BOPTEST measurements and return enriched BMS snapshot."""
    testid: str | None = getattr(request.app.state, "testid", None)
    if not testid:
        raise HTTPException(status_code=503, detail="Simulation not ready — no testid")

    # Get current simulation time from the live snapshot
    current_snapshot = getattr(request.app.state, "current_snapshot", None)
    if current_snapshot is not None:
        sim_time = float(getattr(current_snapshot, "simulation_time", None) or 60.0)
    else:
        sim_time = 60.0

    start_time = max(0.0, sim_time - 60.0)

    try:
        raw = await get_results(testid, _POINTS, start_time, sim_time)
    except BOPTESTError as exc:
        logger.error("BMS snapshot get_results failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"BOPTEST error: {exc}") from exc

    # ── Extract raw sensor values ─────────────────────────────────────────────
    vals: dict[str, float] = {p: _last(raw, p, 0.0) for p in _POINTS}

    # Fix temperature defaults (0 K is wrong — default to 293 K if missing)
    temp_points = [p for p in _POINTS if "_T" in p or "TZon" in p]
    for p in temp_points:
        if vals[p] < 1.0:
            vals[p] = 293.15

    # ── Derived KPIs ──────────────────────────────────────────────────────────
    total_elec_kw = (
        vals["chi_reaPChi_y"]
        + vals["chi_reaPPumDis_y"]
        + vals["heaPum_reaPHeaPum_y"]
        + vals["heaPum_reaPPumDis_y"]
        + vals["hvac_reaAhu_PFanSup_y"]
    ) / 1000.0

    cooling_load_kw = _water_kw(
        vals["chi_reaFloSup_y"],
        vals["hvac_reaAhu_TCooCoiRet_y"],
        vals["hvac_reaAhu_TCooCoiSup_y"],
    )

    heating_load_kw = _water_kw(
        vals["heaPum_reaFloSup_y"],
        vals["heaPum_reaTSup_y"],
        vals["heaPum_reaTRet_y"],
    )

    co2_kg_per_hr = total_elec_kw * _CO2_FACTOR

    chw_flow_lph = vals["chi_reaFloSup_y"] * 3600.0 * 1000.0

    chiller_kw = vals["chi_reaPChi_y"] / 1000.0
    pue = total_elec_kw / max(chiller_kw, 0.1)

    return BmsSnapshot(
        timestamp=time.time(),
        **vals,
        total_elec_kw=round(total_elec_kw, 3),
        pue=round(pue, 3),
        cooling_load_kw=round(cooling_load_kw, 3),
        heating_load_kw=round(heating_load_kw, 3),
        co2_kg_per_hr=round(co2_kg_per_hr, 3),
        chw_flow_lph=round(chw_flow_lph, 1),
    )


@router.post("/control")
async def bms_control(payload: BmsControlPayload, request: Request) -> dict:
    """Write a setpoint override to BOPTEST via advance."""
    testid: str | None = getattr(request.app.state, "testid", None)
    if not testid:
        raise HTTPException(status_code=503, detail="Simulation not ready — no testid")

    activate_key = payload.point_name.replace("_u", "_activate")
    inputs = {
        payload.point_name: payload.value,
        activate_key: float(payload.activate),
    }

    logger.info(
        "BMS control override: testid=%s point=%s value=%s activate=%s",
        testid, payload.point_name, payload.value, payload.activate,
    )

    try:
        await advance(testid, inputs)
    except BOPTESTError as exc:
        logger.error("BMS control advance failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"BOPTEST error: {exc}") from exc

    return {
        "status": "ok",
        "point_name": payload.point_name,
        "value": payload.value,
        "activate": payload.activate,
    }
