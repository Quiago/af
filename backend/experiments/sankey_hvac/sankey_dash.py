"""
sankey_dash.py — Real-time Dash web app for HVAC energy flow visualization.

Usage:
    pip install -r requirements.txt
    python sankey_dash.py

Then open http://localhost:8050 in your browser.

Environment variables:
    BOPTEST_URL     — default: http://localhost:5000
    BOPTEST_TESTID  — BOPTEST cloud test ID (leave empty for local)
"""

import logging
import os

import dash
from dash import dcc, html
from dash.dependencies import Input, Output

import boptest_client as bc
import energy_flows as ef
import sankey_builder as sb

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s  %(message)s")
log = logging.getLogger(__name__)

REFRESH_INTERVAL_MS: int = int(os.getenv("SANKEY_REFRESH_MS", "5000"))

# ---- Ensure BOPTEST is ready -------------------------------------------
if not bc.ensure_initialized():
    log.warning("Could not initialize BOPTEST — Sankey will show zero flows until data arrives.")

# ---- App layout ---------------------------------------------------------
app = dash.Dash(
    __name__,
    title="INAIA — HVAC Energy Flow",
    suppress_callback_exceptions=True,
)

_KPI_STYLE = {
    "display": "inline-block",
    "marginRight": "32px",
    "fontFamily": "IBM Plex Mono, monospace",
}

_KPI_LABEL = {
    "fontSize": "11px",
    "color": "#9CA3AF",
    "textTransform": "uppercase",
    "letterSpacing": "0.08em",
}

_KPI_VALUE = {
    "fontSize": "22px",
    "fontWeight": "700",
    "color": "#F9FAFB",
    "marginTop": "2px",
}


def _kpi_card(label: str, value: str, accent: str = "#F9FAFB") -> html.Div:
    return html.Div([
        html.Div(label, style=_KPI_LABEL),
        html.Div(value, style={**_KPI_VALUE, "color": accent}),
    ], style=_KPI_STYLE)


app.layout = html.Div([
    # ---- Header ---------------------------------------------------------
    html.Div([
        html.Span("INAIA", style={
            "fontSize": "13px",
            "fontWeight": "700",
            "color": "#F59E0B",
            "letterSpacing": "0.15em",
            "fontFamily": "IBM Plex Mono, monospace",
            "marginRight": "12px",
        }),
        html.Span("HVAC Energy Flow  ·  multizone_office_simple_air", style={
            "fontSize": "13px",
            "color": "#6B7280",
            "fontFamily": "IBM Plex Mono, monospace",
        }),
    ], style={"marginBottom": "16px"}),

    # ---- KPI strip ------------------------------------------------------
    html.Div(id="kpi-strip", style={"marginBottom": "20px", "minHeight": "52px"}),

    # ---- Sankey ---------------------------------------------------------
    dcc.Graph(
        id="sankey-graph",
        style={"height": "680px"},
        config={"displayModeBar": False},
    ),

    # ---- Auto-refresh ---------------------------------------------------
    dcc.Interval(id="interval", interval=REFRESH_INTERVAL_MS, n_intervals=0),

], style={
    "backgroundColor": "#0D1B2A",
    "minHeight": "100vh",
    "padding": "24px 32px",
})


# ---- Callback -----------------------------------------------------------
@app.callback(
    [Output("sankey-graph", "figure"), Output("kpi-strip", "children")],
    Input("interval", "n_intervals"),
)
def update(n_intervals: int):
    # 1. Fetch latest sensor readings
    raw = bc.get_results(bc.SENSOR_POINTS, window_seconds=120.0)

    # 2. Compute energy flows
    flows = ef.compute(raw)

    # 3. Build Sankey figure
    fig = sb.build_figure(flows)

    # 4. Build KPI strip
    cop_chi_str = f"{flows.chiller_cop:.2f}" if flows.chiller_cop > 0 else "—"
    cop_hp_str  = f"{flows.hp_cop:.2f}"      if flows.hp_cop > 0      else "—"
    comfort_str = f"{flows.zones_in_comfort}/5"
    comfort_accent = "#10B981" if flows.zones_in_comfort == 5 else "#F59E0B" if flows.zones_in_comfort >= 3 else "#EF4444"

    kpi_strip = html.Div([
        _kpi_card("Total Electric", f"{flows.total_elec_kw:.1f} kW", "#F59E0B"),
        _kpi_card("Chiller COP",    cop_chi_str, "#3B82F6"),
        _kpi_card("Heat Pump COP",  cop_hp_str,  "#EF4444"),
        _kpi_card("Supply Air",     f"{flows.ahu_t_sup_c:.1f} °C", "#6B7280"),
        _kpi_card("Avg Zone Temp",  f"{flows.avg_zone_t_c:.1f} °C", "#9CA3AF"),
        _kpi_card("Zones Comfort",  comfort_str, comfort_accent),
    ])

    return fig, kpi_strip


if __name__ == "__main__":
    port = int(os.getenv("SANKEY_PORT", "8050"))
    debug = os.getenv("SANKEY_DEBUG", "false").lower() == "true"
    log.info("Starting Dash app on http://localhost:%d", port)
    app.run(debug=debug, host="0.0.0.0", port=port)
