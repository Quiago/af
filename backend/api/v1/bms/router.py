"""BMS REST endpoints.

GET  /api/v1/bms/snapshot  — latest BOPTEST measurements + derived KPIs
POST /api/v1/bms/control   — write a setpoint override via BOPTEST advance
"""
from __future__ import annotations

import logging
import time

from fastapi import APIRouter, HTTPException, Request

from api.v1.boptest.service import BOPTESTError, advance
from .schemas import BmsControlPayload, BmsSnapshot

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/bms", tags=["bms"])

# ── Physical constants ────────────────────────────────────────────────────────
_RHO_WATER = 1000.0   # kg/m³
_CP_WATER  = 4186.0   # J/(kg·K)

# Illinois grid carbon factor (kg CO₂ / kWh) — EIA 2019 average for Illinois
_CO2_FACTOR = 0.341

# ── All BOPTEST sensor points the BMS cares about ────────────────────────────
# (used only for default-value lookup — the actual values come from advance() outputs)
_POINTS: list[str] = [
    # Chiller
    "chi_reaPChi_y",
    "chi_reaPPumDis_y",
    "chi_reaTSup_y",
    "chi_reaTRet_y",
    "chi_reaFloSup_y",
    # Heat pump
    "heaPum_reaPHeaPum_y",
    "heaPum_reaPPumDis_y",
    "heaPum_reaTSup_y",
    "heaPum_reaTRet_y",
    "heaPum_reaFloSup_y",
    # AHU fans & pumps
    "hvac_reaAhu_PFanSup_y",
    "hvac_reaAhu_PPumCoo_y",
    "hvac_reaAhu_PPumHea_y",
    # AHU air-side
    "hvac_reaAhu_TMix_y",
    "hvac_reaAhu_TSup_y",
    "hvac_reaAhu_TRet_y",
    "hvac_reaAhu_V_flow_sup_y",
    "hvac_reaAhu_V_flow_ret_y",
    "hvac_reaAhu_dp_sup_y",
    # AHU cooling coil water
    "hvac_reaAhu_TCooCoiSup_y",
    "hvac_reaAhu_TCooCoiRet_y",
    # AHU heating coil water (distinct from heat pump supply/return!)
    "hvac_reaAhu_THeaCoiSup_y",
    "hvac_reaAhu_THeaCoiRet_y",
    # Zones
    "hvac_reaZonCor_TZon_y", "hvac_reaZonCor_V_flow_y",
    "hvac_reaZonCor_CO2Zon_y", "hvac_reaZonCor_TSup_y",
    "hvac_reaZonNor_TZon_y", "hvac_reaZonNor_V_flow_y",
    "hvac_reaZonNor_CO2Zon_y", "hvac_reaZonNor_TSup_y",
    "hvac_reaZonSou_TZon_y", "hvac_reaZonSou_V_flow_y",
    "hvac_reaZonSou_CO2Zon_y", "hvac_reaZonSou_TSup_y",
    "hvac_reaZonEas_TZon_y", "hvac_reaZonEas_V_flow_y",
    "hvac_reaZonEas_CO2Zon_y", "hvac_reaZonEas_TSup_y",
    "hvac_reaZonWes_TZon_y", "hvac_reaZonWes_V_flow_y",
    "hvac_reaZonWes_CO2Zon_y", "hvac_reaZonWes_TSup_y",
    # Weather (Chicago O'Hare TMY3)
    "weaSta_reaWeaTDryBul_y",
    "weaSta_reaWeaTWetBul_y",
    "weaSta_reaWeaRelHum_y",
    "weaSta_reaWeaWinSpe_y",
    "weaSta_reaWeaWinDir_y",
    "weaSta_reaWeaHGloHor_y",
    "weaSta_reaWeaHDirNor_y",
    "weaSta_reaWeaPAtm_y",
]

# Temperature sensor names (default to 293.15 K if BOPTEST returns 0/null)
_TEMP_POINTS = {p for p in _POINTS if "_T" in p}


def _water_kw(flow_m3s: float, t_hot_k: float, t_cold_k: float) -> float:
    """Thermal power transferred by a water loop [kW]."""
    return flow_m3s * _RHO_WATER * _CP_WATER * abs(t_hot_k - t_cold_k) / 1000.0


def _read_val(outputs: dict, key: str) -> float:
    """Read a scalar sensor value from advance() outputs.

    advance() returns plain scalars: {"hvac_reaAhu_TSup_y": 289.5, ...}
    Temperatures default to 293.15 K (room temp) when missing or suspiciously low.
    """
    raw = outputs.get(key)
    if raw is None:
        return 293.15 if key in _TEMP_POINTS else 0.0
    v = float(raw)
    if key in _TEMP_POINTS and v < 50.0:
        return 293.15   # guard: BOPTEST returns 0 for off sensors
    return v


@router.get("/snapshot", response_model=BmsSnapshot)
async def bms_snapshot(request: Request) -> BmsSnapshot:
    """Build BMS snapshot from the latest advance() outputs stored by the polling loop.

    Reads app.state.bms_raw_outputs — set by main.py on every simulation step.
    No extra BOPTEST API call is needed; advance() already returns all outputs.
    """
    testid: str | None = getattr(request.app.state, "testid", None)
    if not testid:
        raise HTTPException(status_code=503, detail="Simulation not ready — no testid")

    raw: dict | None = getattr(request.app.state, "bms_raw_outputs", None)
    if not raw:
        raise HTTPException(status_code=503, detail="Simulation not ready — no data yet")

    # ── Extract sensor values from advance() scalar outputs ──────────────────
    vals: dict[str, float] = {p: _read_val(raw, p) for p in _POINTS}

    # ── Total electrical consumption (all consumers) ─────────────────────────
    total_elec_kw = (
        vals["chi_reaPChi_y"]           # chiller compressor
        + vals["chi_reaPPumDis_y"]      # CHW distribution pump
        + vals["heaPum_reaPHeaPum_y"]   # heat pump compressor
        + vals["heaPum_reaPPumDis_y"]   # HW distribution pump
        + vals["hvac_reaAhu_PFanSup_y"] # supply fan
        + vals["hvac_reaAhu_PPumCoo_y"] # AHU cooling coil pump
        + vals["hvac_reaAhu_PPumHea_y"] # AHU heating coil pump
    ) / 1000.0

    # ── Chiller thermal output (cooling load) ────────────────────────────────
    # Uses chiller CHW flow and supply/return delta T
    cooling_load_kw = _water_kw(
        vals["chi_reaFloSup_y"],
        vals["chi_reaTRet_y"],   # return is warmer
        vals["chi_reaTSup_y"],   # supply is colder
    )

    # ── Heat pump thermal output (heating load) ──────────────────────────────
    heating_load_kw = _water_kw(
        vals["heaPum_reaFloSup_y"],
        vals["heaPum_reaTSup_y"],  # supply is hotter
        vals["heaPum_reaTRet_y"],  # return is cooler
    )

    # ── COP ──────────────────────────────────────────────────────────────────
    chi_elec_kw  = vals["chi_reaPChi_y"] / 1000.0
    hp_elec_kw   = vals["heaPum_reaPHeaPum_y"] / 1000.0
    chiller_cop  = cooling_load_kw / chi_elec_kw  if chi_elec_kw  > 0.1 else 0.0
    hp_cop       = heating_load_kw / hp_elec_kw   if hp_elec_kw   > 0.1 else 0.0

    co2_kg_per_hr = total_elec_kw * _CO2_FACTOR
    chw_flow_lph  = vals["chi_reaFloSup_y"] * 3600.0 * 1000.0

    sim_time = float(raw.get("time", 0.0))

    return BmsSnapshot(
        timestamp=time.time(),
        sim_time_s=sim_time,
        **vals,
        total_elec_kw=round(total_elec_kw, 3),
        cooling_load_kw=round(cooling_load_kw, 3),
        heating_load_kw=round(heating_load_kw, 3),
        chiller_cop=round(chiller_cop, 2),
        hp_cop=round(hp_cop, 2),
        co2_kg_per_hr=round(co2_kg_per_hr, 3),
        chw_flow_lph=round(chw_flow_lph, 1),
    )


@router.post("/control")
async def bms_control(payload: BmsControlPayload, request: Request) -> dict:
    """
    Write a setpoint override to BOPTEST.

    IMPORTANT: All values must arrive already in BOPTEST native units:
      - Temperatures  → Kelvin [K]
      - Fractions     → 0.0–1.0 (not percent)
      - Pressures     → Pascal [Pa]
    The frontend is responsible for converting before posting.
    """
    testid: str | None = getattr(request.app.state, "testid", None)
    if not testid:
        raise HTTPException(status_code=503, detail="Simulation not ready — no testid")

    activate_key = payload.point_name.replace("_u", "_activate")
    inputs = {
        payload.point_name: payload.value,
        activate_key: float(payload.activate),
    }

    logger.info(
        "BMS control: point=%s value=%.4f activate=%s",
        payload.point_name, payload.value, payload.activate,
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
