"""BMS domain Pydantic schemas."""
from __future__ import annotations

from pydantic import BaseModel


class BmsSnapshot(BaseModel):
    timestamp: float

    # ── Chiller ──────────────────────────────────────────────────────────────
    chi_reaPChi_y: float = 0.0          # W — electric power
    chi_reaPPumDis_y: float = 0.0       # W — CHW pump electric power
    chi_reaTSup_y: float = 273.15       # K — CHW supply temp
    chi_reaTRet_y: float = 273.15       # K — CHW return temp
    chi_reaFloSup_y: float = 0.0        # m3/s — CHW supply flow

    # ── Heat pump ────────────────────────────────────────────────────────────
    heaPum_reaPHeaPum_y: float = 0.0    # W
    heaPum_reaPPumDis_y: float = 0.0    # W — HW pump electric power
    heaPum_reaTSup_y: float = 273.15    # K
    heaPum_reaTRet_y: float = 273.15    # K
    heaPum_reaFloSup_y: float = 0.0     # m3/s

    # ── AHU ──────────────────────────────────────────────────────────────────
    hvac_reaAhu_PFanSup_y: float = 0.0          # W
    hvac_reaAhu_TMix_y: float = 273.15           # K
    hvac_reaAhu_TSup_y: float = 273.15           # K
    hvac_reaAhu_TRet_y: float = 273.15           # K
    hvac_reaAhu_V_flow_sup_y: float = 0.0        # m3/s
    hvac_reaAhu_V_flow_ret_y: float = 0.0        # m3/s
    hvac_reaAhu_TCooCoiSup_y: float = 273.15     # K
    hvac_reaAhu_TCooCoiRet_y: float = 273.15     # K
    hvac_reaAhu_dp_sup_y: float = 0.0            # Pa

    # ── Zones ─────────────────────────────────────────────────────────────────
    hvac_reaZonCor_TZon_y: float = 273.15
    hvac_reaZonCor_V_flow_y: float = 0.0
    hvac_reaZonCor_CO2Zon_y: float = 400.0
    hvac_reaZonCor_TSup_y: float = 273.15

    hvac_reaZonNor_TZon_y: float = 273.15
    hvac_reaZonNor_V_flow_y: float = 0.0
    hvac_reaZonNor_CO2Zon_y: float = 400.0
    hvac_reaZonNor_TSup_y: float = 273.15

    hvac_reaZonSou_TZon_y: float = 273.15
    hvac_reaZonSou_V_flow_y: float = 0.0
    hvac_reaZonSou_CO2Zon_y: float = 400.0
    hvac_reaZonSou_TSup_y: float = 273.15

    hvac_reaZonEas_TZon_y: float = 273.15
    hvac_reaZonEas_V_flow_y: float = 0.0
    hvac_reaZonEas_CO2Zon_y: float = 400.0
    hvac_reaZonEas_TSup_y: float = 273.15

    hvac_reaZonWes_TZon_y: float = 273.15
    hvac_reaZonWes_V_flow_y: float = 0.0
    hvac_reaZonWes_CO2Zon_y: float = 400.0
    hvac_reaZonWes_TSup_y: float = 273.15

    # ── Weather ───────────────────────────────────────────────────────────────
    weaSta_reaWeaTDryBul_y: float = 273.15       # K

    # ── Derived (computed by the router) ─────────────────────────────────────
    total_elec_kw: float = 0.0
    pue: float = 1.0
    cooling_load_kw: float = 0.0
    heating_load_kw: float = 0.0
    co2_kg_per_hr: float = 0.0
    chw_flow_lph: float = 0.0


class BmsControlPayload(BaseModel):
    point_name: str
    value: float
    activate: int = 1
