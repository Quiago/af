"""
sankey_static.py — One-shot Plotly Sankey export to HTML.

Fetches one snapshot from BOPTEST, computes flows, and writes
an interactive self-contained HTML file you can open in any browser.

Usage:
    python sankey_static.py [output.html]
"""

import logging
import os
import sys

import boptest_client as bc
import energy_flows as ef
import sankey_builder as sb

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)


def main() -> None:
    out_path = sys.argv[1] if len(sys.argv) > 1 else "sankey_hvac_snapshot.html"

    if not bc.ensure_initialized():
        log.warning("BOPTEST not initialized — diagram will show zero/minimum flows.")

    log.info("Fetching sensor data...")
    raw = bc.get_results(bc.SENSOR_POINTS, window_seconds=120.0)

    flows = ef.compute(raw)
    log.info(
        "Total electric: %.2f kW | Chiller COP: %.2f | HP COP: %.2f | Zones comfort: %d/5",
        flows.total_elec_kw, flows.chiller_cop, flows.hp_cop, flows.zones_in_comfort,
    )

    fig = sb.build_figure(flows)
    fig.update_layout(title=dict(
        text="INAIA — HVAC Energy Flow (snapshot)",
        font=dict(family="IBM Plex Mono, monospace", color="#F59E0B", size=16),
    ))

    fig.write_html(out_path, include_plotlyjs="cdn")
    log.info("Sankey diagram written to: %s", os.path.abspath(out_path))


if __name__ == "__main__":
    main()
