"""
sankey_builder.py — Pure function: EnergyFlows → go.Figure (Sankey).

Node index map
--------------
 0  Electricity Grid
 1  Chiller
 2  Heat Pump
 3  CHW Pump
 4  HW Pump
 5  Supply Fan
 6  Cooling Coil
 7  Heating Coil
 8  Outside Air
 9  Return Air
10  Mixed Air
11  Supply Duct
12  Zone COR
13  Zone NOR
14  Zone SOU
15  Zone EAS
16  Zone WES
17  Heat Losses / Exhaust
"""

from __future__ import annotations

import plotly.graph_objects as go

from energy_flows import EnergyFlows, MIN_LINK_KW, ZONES

# ---- Color palette (dark mission-control theme) -------------------------
C_ELEC   = "#F59E0B"   # amber — electricity
C_COOL   = "#3B82F6"   # blue  — cooling
C_HEAT   = "#EF4444"   # red   — heating
C_AIR    = "#6B7280"   # gray  — air handling
C_ZONE   = "#10B981"   # green — zones (comfortable)
C_DISCOM = "#F97316"   # orange — zone in discomfort
C_LOSS   = "#374151"   # dark gray — losses

BG_COLOR  = "#0D1B2A"
FONT_COLOR = "#F9FAFB"

# Node definitions (index, label, color)
_NODES: list[tuple[int, str, str]] = [
    ( 0, "Electricity Grid",     C_ELEC),
    ( 1, "Chiller",              C_COOL),
    ( 2, "Heat Pump",            C_HEAT),
    ( 3, "CHW Pump",             C_COOL),
    ( 4, "HW Pump",              C_HEAT),
    ( 5, "Supply Fan",           C_AIR),
    ( 6, "Cooling Coil",         C_COOL),
    ( 7, "Heating Coil",         C_HEAT),
    ( 8, "Outside Air",          C_AIR),
    ( 9, "Return Air",           C_AIR),
    (10, "Mixed Air",            C_AIR),
    (11, "Supply Duct",          C_AIR),
    (12, "Zone COR",             C_ZONE),
    (13, "Zone NOR",             C_ZONE),
    (14, "Zone SOU",             C_ZONE),
    (15, "Zone EAS",             C_ZONE),
    (16, "Zone WES",             C_ZONE),
    (17, "Heat Losses/Exhaust",  C_LOSS),
]

_ZONE_IDX = {"cor": 12, "nor": 13, "sou": 14, "eas": 15, "wes": 16}


def _link_color(src_color: str, alpha: float = 0.4) -> str:
    """Convert hex color to rgba with given alpha."""
    h = src_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"rgba({r},{g},{b},{alpha})"


def _at_least(v: float) -> float:
    return max(v, MIN_LINK_KW)


def _zone_hover(ef: EnergyFlows, zone: str) -> str:
    t_c  = ef.zone_t_c.get(zone, 0.0)
    co2  = ef.zone_co2.get(zone, 0.0)
    flow = ef.zone_flow.get(zone, 0.0)
    kw   = ef.zone_kw.get(zone, 0.0)
    return (
        f"Zone {zone.upper()}<br>"
        f"Delivered: {kw:.2f} kW<br>"
        f"T_zone: {t_c:.1f} °C<br>"
        f"CO₂: {co2:.0f} ppm<br>"
        f"Flow: {flow:.4f} m³/s"
    )


def _equip_hover_chiller(ef: EnergyFlows) -> str:
    return (
        f"Chiller<br>"
        f"Electric: {ef.chiller_elec_kw:.2f} kW<br>"
        f"Thermal: {ef.chiller_thermal_kw:.2f} kW<br>"
        f"T_sup: {ef.chiller_t_sup_c:.1f} °C | T_ret: {ef.chiller_t_ret_c:.1f} °C<br>"
        f"Flow: {ef.chiller_flow:.4f} m³/s"
    )


def _equip_hover_hp(ef: EnergyFlows) -> str:
    return (
        f"Heat Pump<br>"
        f"Electric: {ef.hp_elec_kw:.2f} kW<br>"
        f"Thermal: {ef.heatpump_thermal_kw:.2f} kW<br>"
        f"T_sup: {ef.hp_t_sup_c:.1f} °C | T_ret: {ef.hp_t_ret_c:.1f} °C<br>"
        f"Flow: {ef.hp_flow:.4f} m³/s"
    )


def _equip_hover_ahu(ef: EnergyFlows) -> str:
    return (
        f"Mixed Air<br>"
        f"T_mix: {ef.ahu_t_mix_c:.1f} °C<br>"
        f"T_sup: {ef.ahu_t_sup_c:.1f} °C | T_ret: {ef.ahu_t_ret_c:.1f} °C<br>"
        f"Flow_sup: {ef.ahu_flow_sup:.4f} m³/s | Flow_ret: {ef.ahu_flow_ret:.4f} m³/s"
    )


def build_figure(ef: EnergyFlows) -> go.Figure:
    """
    Build a complete Plotly Sankey figure from the computed energy flows.
    """
    # ---- Node colors (adjust zone colors for discomfort) ----------------
    node_colors = [color for _, _, color in _NODES]
    for zone, idx in _ZONE_IDX.items():
        t_k = ef.zone_t_c.get(zone, 20.0) + 273.15
        if t_k > 297.0 or t_k < 293.0:
            node_colors[idx] = C_DISCOM

    # ---- Node hover labels ----------------------------------------------
    node_labels = [label for _, label, _ in _NODES]
    node_custom = [
        f"Electricity Grid<br>Total: {ef.total_elec_kw:.2f} kW",
        _equip_hover_chiller(ef),
        _equip_hover_hp(ef),
        f"CHW Pump<br>{ef.chw_pump_kw:.2f} kW electric",
        f"HW Pump<br>{ef.hw_pump_kw:.2f} kW electric",
        f"Supply Fan<br>{ef.fan_kw:.2f} kW electric",
        f"Cooling Coil<br>Duty: {ef.cooling_coil_kw:.2f} kW",
        f"Heating Coil<br>Duty: {ef.heating_coil_kw:.2f} kW",
        f"Outside Air<br>To mixed plenum: {ef.oa_mix_kw:.2f} kW",
        f"Return Air<br>To mixed plenum: {ef.ret_mix_kw:.2f} kW",
        _equip_hover_ahu(ef),
        f"Supply Duct<br>Total: {ef.fan_to_duct_kw:.2f} kW",
    ] + [_zone_hover(ef, z) for z in ZONES] + [
        "Heat Losses / Exhaust<br>(return loop residual)"
    ]

    # ---- Links ----------------------------------------------------------
    # Each link: (source_idx, target_idx, value_kw, src_color, discomfort?)
    raw_links: list[tuple[int, int, float, str, bool]] = [
        # Grid → plant
        (0,  1,  _at_least(ef.chiller_elec_kw),      C_ELEC, False),
        (0,  2,  _at_least(ef.hp_elec_kw),            C_ELEC, False),
        (0,  3,  _at_least(ef.chw_pump_kw),           C_ELEC, False),
        (0,  4,  _at_least(ef.hw_pump_kw),            C_ELEC, False),
        (0,  5,  _at_least(ef.fan_kw),                C_ELEC, False),
        # Chiller → CHW Pump → Cooling Coil
        (1,  3,  _at_least(ef.chiller_thermal_kw),    C_COOL, False),
        (3,  6,  _at_least(ef.chiller_thermal_kw),    C_COOL, False),
        # Heat Pump → HW Pump → Heating Coil
        (2,  4,  _at_least(ef.heatpump_thermal_kw),   C_HEAT, False),
        (4,  7,  _at_least(ef.heatpump_thermal_kw),   C_HEAT, False),
        # Air mix inputs → Mixed Air
        (8,  10, _at_least(ef.oa_mix_kw),             C_AIR,  False),
        (9,  10, _at_least(ef.ret_mix_kw),            C_AIR,  False),
        (6,  10, _at_least(ef.cooling_coil_kw),       C_COOL, False),
        (7,  10, _at_least(ef.heating_coil_kw),       C_HEAT, False),
        # Mixed Air → Fan → Duct
        (10, 5,  _at_least(ef.mixed_to_fan_kw),       C_AIR,  False),
        (5,  11, _at_least(ef.fan_to_duct_kw),        C_AIR,  False),
    ]

    # Duct → Zones and Zones → Losses
    for zone, idx in _ZONE_IDX.items():
        kw = _at_least(ef.zone_kw.get(zone, 0.0))
        t_k = ef.zone_t_c.get(zone, 20.0) + 273.15
        discomfort = t_k > 297.0 or t_k < 293.0
        z_color = C_DISCOM if discomfort else C_ZONE
        raw_links.append((11, idx, kw, C_AIR, discomfort))
        raw_links.append((idx, 17, _at_least(kw * 0.15), z_color, False))  # ~15% loss

    sources, targets, values, link_colors, link_labels = [], [], [], [], []
    for src, tgt, val, src_col, discomfort in raw_links:
        sources.append(src)
        targets.append(tgt)
        values.append(val)
        if discomfort:
            link_colors.append("rgba(239,68,68,0.5)")
        else:
            link_colors.append(_link_color(src_col, 0.4))
        link_labels.append(f"{val:.2f} kW")

    # ---- Figure ---------------------------------------------------------
    fig = go.Figure(go.Sankey(
        arrangement="snap",
        node=dict(
            pad=20,
            thickness=18,
            line=dict(color="rgba(255,255,255,0.1)", width=0.5),
            label=node_labels,
            color=node_colors,
            customdata=node_custom,
            hovertemplate="%{customdata}<extra></extra>",
        ),
        link=dict(
            source=sources,
            target=targets,
            value=values,
            color=link_colors,
            label=link_labels,
            hovertemplate="Flow: %{label}<extra></extra>",
        ),
    ))

    fig.update_layout(
        paper_bgcolor=BG_COLOR,
        plot_bgcolor=BG_COLOR,
        font=dict(family="IBM Plex Mono, JetBrains Mono, monospace", color=FONT_COLOR, size=12),
        margin=dict(l=20, r=20, t=20, b=20),
    )
    return fig
