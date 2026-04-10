"""
energy_flows.py — Pure functions: raw sensor dict → computed kW flows dict.

All inputs are SI units as returned by BOPTEST:
  temperatures  [K]
  flow rates    [m3/s]
  powers        [W]

All outputs are [kW].
"""

from __future__ import annotations

from dataclasses import dataclass, field

RHO_AIR: float = 1.2      # kg/m3
CP_AIR: float = 1006.0    # J/(kg·K)
RHO_WATER: float = 1000.0  # kg/m3
CP_WATER: float = 4186.0  # J/(kg·K)

MIN_LINK_KW: float = 0.1  # Plotly hides Sankey links with value=0

ZONES = ["cor", "nor", "sou", "eas", "wes"]


def _safe(v: float | None) -> float:
    return float(v) if v is not None else 0.0


def _water_kw(flow_m3s: float, t_hot_k: float, t_cold_k: float) -> float:
    """Thermal power transferred by a water loop [kW]."""
    return flow_m3s * RHO_WATER * CP_WATER * abs(t_hot_k - t_cold_k) / 1000.0


def _air_kw(flow_m3s: float, t1_k: float, t2_k: float) -> float:
    """Sensible thermal power of an air stream [kW]."""
    return flow_m3s * RHO_AIR * CP_AIR * abs(t1_k - t2_k) / 1000.0


def _at_least(v: float) -> float:
    return max(v, MIN_LINK_KW)


@dataclass
class EnergyFlows:
    # --- Electric inputs [kW] ---
    chiller_elec_kw: float = 0.0
    chw_pump_kw: float = 0.0
    hp_elec_kw: float = 0.0
    hw_pump_kw: float = 0.0
    fan_kw: float = 0.0

    # --- Plant thermal outputs [kW] ---
    chiller_thermal_kw: float = 0.0
    heatpump_thermal_kw: float = 0.0

    # --- Coil duties [kW] ---
    cooling_coil_kw: float = 0.0
    heating_coil_kw: float = 0.0

    # --- Air side [kW] ---
    oa_mix_kw: float = 0.0          # outside air → mixed air
    ret_mix_kw: float = 0.0         # return air → mixed air
    mixed_to_fan_kw: float = 0.0    # mixed air → supply fan
    fan_to_duct_kw: float = 0.0     # supply fan → supply duct

    # --- Per-zone delivered [kW] ---
    zone_kw: dict[str, float] = field(default_factory=dict)

    # --- Zone diagnostics ---
    zone_t_c: dict[str, float] = field(default_factory=dict)   # zone temp [°C]
    zone_co2: dict[str, float] = field(default_factory=dict)   # CO2 [ppm]
    zone_flow: dict[str, float] = field(default_factory=dict)  # m3/s

    # --- Plant diagnostics ---
    chiller_t_sup_c: float = 0.0
    chiller_t_ret_c: float = 0.0
    chiller_flow: float = 0.0
    hp_t_sup_c: float = 0.0
    hp_t_ret_c: float = 0.0
    hp_flow: float = 0.0
    ahu_t_mix_c: float = 0.0
    ahu_t_sup_c: float = 0.0
    ahu_t_ret_c: float = 0.0
    ahu_flow_sup: float = 0.0
    ahu_flow_ret: float = 0.0

    # --- KPIs ---
    total_elec_kw: float = 0.0
    chiller_cop: float = 0.0
    hp_cop: float = 0.0
    avg_zone_t_c: float = 0.0
    zones_in_comfort: int = 0        # count (comfort: 293–297 K)


def compute(raw: dict[str, float]) -> EnergyFlows:
    """
    Convert a flat BOPTEST sensor dict to an EnergyFlows dataclass.

    `raw` maps point_name → latest float value (0.0 for missing/null).
    """
    g = raw.get

    # ---- Electric inputs ------------------------------------------------
    chiller_elec_kw = _safe(g("chi_reaPChi_y")) / 1000.0
    chw_pump_kw     = _safe(g("chi_reaPPumDis_y")) / 1000.0
    hp_elec_kw      = _safe(g("heaPum_reaPHeaPum_y")) / 1000.0
    hw_pump_kw      = _safe(g("heaPum_reaPPumDis_y")) / 1000.0
    fan_kw          = _safe(g("hvac_reaAhu_PFanSup_y")) / 1000.0

    total_elec_kw = chiller_elec_kw + chw_pump_kw + hp_elec_kw + hw_pump_kw + fan_kw

    # ---- Plant thermal --------------------------------------------------
    chi_flow = _safe(g("chi_reaFloSup_y"))
    chi_t_sup = _safe(g("chi_reaTSup_y"))
    chi_t_ret = _safe(g("chi_reaTRet_y"))
    chiller_thermal_kw = _water_kw(chi_flow, chi_t_ret, chi_t_sup)  # CHW: ret > sup

    hp_flow = _safe(g("heaPum_reaFloSup_y"))
    hp_t_sup = _safe(g("heaPum_reaTSup_y"))
    hp_t_ret = _safe(g("heaPum_reaTRet_y"))
    heatpump_thermal_kw = _water_kw(hp_flow, hp_t_sup, hp_t_ret)

    # ---- Coils ----------------------------------------------------------
    coi_t_sup = _safe(g("hvac_reaAhu_TCooCoiSup_y"))
    coi_t_ret = _safe(g("hvac_reaAhu_TCooCoiRet_y"))
    # Use coil water flow = chi_flow (same CHW loop)
    cooling_coil_kw = _water_kw(chi_flow, coi_t_ret, coi_t_sup)

    # Heating coil: use HW loop
    heating_coil_kw = _water_kw(hp_flow, hp_t_sup, hp_t_ret)

    # ---- AHU air side --------------------------------------------------
    ahu_v_sup = _safe(g("hvac_reaAhu_V_flow_sup_y"))
    ahu_v_ret = _safe(g("hvac_reaAhu_V_flow_ret_y"))
    ahu_t_mix = _safe(g("hvac_reaAhu_TMix_y"))
    ahu_t_sup = _safe(g("hvac_reaAhu_TSup_y"))
    ahu_t_ret = _safe(g("hvac_reaAhu_TRet_y"))
    t_oa      = _safe(g("weaSta_reaWeaTDryBul_y"))

    # OA fraction = (supply - return) / supply, clamped 0–1
    if ahu_v_sup > 0:
        oa_frac = max(0.0, min(1.0, (ahu_v_sup - ahu_v_ret) / ahu_v_sup))
    else:
        oa_frac = 0.0

    oa_flow = oa_frac * ahu_v_sup
    oa_mix_kw = _air_kw(oa_flow, t_oa, ahu_t_mix) if ahu_t_mix > 0 else 0.0

    ret_mix_kw = _air_kw(ahu_v_ret, ahu_t_ret, ahu_t_mix) if ahu_t_mix > 0 else 0.0

    # Total thermal carried by supply air from mixed plenum
    mixed_to_fan_kw = _air_kw(ahu_v_sup, ahu_t_mix, 273.15) if ahu_t_mix > 0 else 0.0
    # Fan adds heat to air; duct carries mixed thermal + fan heat
    fan_to_duct_kw = mixed_to_fan_kw + fan_kw

    # ---- Per zone -------------------------------------------------------
    zone_kw: dict[str, float] = {}
    zone_t_c: dict[str, float] = {}
    zone_co2: dict[str, float] = {}
    zone_flow: dict[str, float] = {}
    zones_in_comfort = 0

    for z in ZONES:
        t_zon_k = _safe(g(f"hvac_reaZon{z}_TZon_y"))
        t_sup_k = _safe(g(f"hvac_reaZon{z}_TSup_y"))
        v_flow  = _safe(g(f"hvac_reaZon{z}_V_flow_y"))
        co2     = _safe(g(f"hvac_reaZon{z}_CO2Zon_y"))

        zone_kw[z]   = _air_kw(v_flow, t_sup_k, t_zon_k)
        zone_t_c[z]  = t_zon_k - 273.15 if t_zon_k > 0 else 0.0
        zone_co2[z]  = co2
        zone_flow[z] = v_flow

        if 293.0 <= t_zon_k <= 297.0:
            zones_in_comfort += 1

    # ---- COP ------------------------------------------------------------
    chiller_cop = (chiller_thermal_kw / chiller_elec_kw) if chiller_elec_kw > 0 else 0.0
    hp_cop      = (heatpump_thermal_kw / hp_elec_kw) if hp_elec_kw > 0 else 0.0

    avg_zone_t_c = (sum(zone_t_c.values()) / len(zone_t_c)) if zone_t_c else 0.0

    return EnergyFlows(
        chiller_elec_kw=chiller_elec_kw,
        chw_pump_kw=chw_pump_kw,
        hp_elec_kw=hp_elec_kw,
        hw_pump_kw=hw_pump_kw,
        fan_kw=fan_kw,
        chiller_thermal_kw=chiller_thermal_kw,
        heatpump_thermal_kw=heatpump_thermal_kw,
        cooling_coil_kw=cooling_coil_kw,
        heating_coil_kw=heating_coil_kw,
        oa_mix_kw=oa_mix_kw,
        ret_mix_kw=ret_mix_kw,
        mixed_to_fan_kw=mixed_to_fan_kw,
        fan_to_duct_kw=fan_to_duct_kw,
        zone_kw=zone_kw,
        zone_t_c=zone_t_c,
        zone_co2=zone_co2,
        zone_flow=zone_flow,
        chiller_t_sup_c=chi_t_sup - 273.15,
        chiller_t_ret_c=chi_t_ret - 273.15,
        chiller_flow=chi_flow,
        hp_t_sup_c=hp_t_sup - 273.15,
        hp_t_ret_c=hp_t_ret - 273.15,
        hp_flow=hp_flow,
        ahu_t_mix_c=ahu_t_mix - 273.15,
        ahu_t_sup_c=ahu_t_sup - 273.15,
        ahu_t_ret_c=ahu_t_ret - 273.15,
        ahu_flow_sup=ahu_v_sup,
        ahu_flow_ret=ahu_v_ret,
        total_elec_kw=total_elec_kw,
        chiller_cop=chiller_cop,
        hp_cop=hp_cop,
        avg_zone_t_c=avg_zone_t_c,
        zones_in_comfort=zones_in_comfort,
    )
