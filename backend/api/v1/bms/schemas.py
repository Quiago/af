"""BMS domain Pydantic schemas."""
from __future__ import annotations

from pydantic import BaseModel


class BmsSnapshot(BaseModel):
    timestamp: float
    sim_time_s: float = 0.0          # current BOPTEST simulation time [s]

    # ── Chiller ──────────────────────────────────────────────────────────────
    chi_reaPChi_y: float = 0.0          # W — electric power
    chi_reaPPumDis_y: float = 0.0       # W — CHW distribution pump
    chi_reaTSup_y: float = 273.15       # K — CHW supply
    chi_reaTRet_y: float = 273.15       # K — CHW return
    chi_reaFloSup_y: float = 0.0        # m3/s

    # ── Heat pump ────────────────────────────────────────────────────────────
    heaPum_reaPHeaPum_y: float = 0.0    # W
    heaPum_reaPPumDis_y: float = 0.0    # W — HW distribution pump
    heaPum_reaTSup_y: float = 273.15    # K
    heaPum_reaTRet_y: float = 273.15    # K
    heaPum_reaFloSup_y: float = 0.0     # m3/s

    # ── AHU fans & pumps ─────────────────────────────────────────────────────
    hvac_reaAhu_PFanSup_y: float = 0.0          # W — supply fan
    hvac_reaAhu_PPumCoo_y: float = 0.0          # W — cooling coil pump
    hvac_reaAhu_PPumHea_y: float = 0.0          # W — heating coil pump

    # ── AHU air temperatures ─────────────────────────────────────────────────
    hvac_reaAhu_TMix_y: float = 273.15           # K — mixed air
    hvac_reaAhu_TSup_y: float = 273.15           # K — supply air
    hvac_reaAhu_TRet_y: float = 273.15           # K — return air
    hvac_reaAhu_V_flow_sup_y: float = 0.0        # m3/s
    hvac_reaAhu_V_flow_ret_y: float = 0.0        # m3/s
    hvac_reaAhu_dp_sup_y: float = 0.0            # Pa

    # ── AHU cooling coil water ───────────────────────────────────────────────
    hvac_reaAhu_TCooCoiSup_y: float = 273.15     # K
    hvac_reaAhu_TCooCoiRet_y: float = 273.15     # K

    # ── AHU heating coil water (separate from HP supply/return!) ─────────────
    hvac_reaAhu_THeaCoiSup_y: float = 273.15     # K
    hvac_reaAhu_THeaCoiRet_y: float = 273.15     # K

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

    # ── Weather (Chicago O'Hare TMY3) ─────────────────────────────────────────
    weaSta_reaWeaTDryBul_y: float = 273.15       # K — outside dry bulb
    weaSta_reaWeaTWetBul_y: float = 273.15       # K — wet bulb
    weaSta_reaWeaRelHum_y: float = 0.5           # 0-1 — relative humidity
    weaSta_reaWeaWinSpe_y: float = 0.0           # m/s — wind speed
    weaSta_reaWeaWinDir_y: float = 0.0           # rad — wind direction
    weaSta_reaWeaHGloHor_y: float = 0.0          # W/m2 — global horizontal solar
    weaSta_reaWeaHDirNor_y: float = 0.0          # W/m2 — direct normal solar
    weaSta_reaWeaPAtm_y: float = 101325.0        # Pa — atmospheric pressure

    # ── Derived KPIs (computed by the router) ────────────────────────────────
    total_elec_kw: float = 0.0       # all electrical consumers
    cooling_load_kw: float = 0.0     # chiller thermal output
    heating_load_kw: float = 0.0     # heat pump thermal output
    chiller_cop: float = 0.0         # cooling COP
    hp_cop: float = 0.0              # heating COP
    co2_kg_per_hr: float = 0.0       # Illinois grid 0.341 kgCO2/kWh
    chw_flow_lph: float = 0.0        # CHW volumetric flow L/hr


class BmsControlPayload(BaseModel):
    point_name: str
    value: float
    activate: int = 1
