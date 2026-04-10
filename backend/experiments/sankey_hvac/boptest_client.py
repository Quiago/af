"""
BOPTEST API wrapper.

Handles initialization, scenario setup, stepping, and result fetching.
Module-level _testid caches the active test ID so the app can restart
without re-initializing BOPTEST.
"""

import os
import logging
from typing import Optional

import requests
from dotenv import load_dotenv

load_dotenv()

BOPTEST_URL: str = os.getenv("BOPTEST_URL", "http://localhost:5000").rstrip("/")
TESTID: str = os.getenv("BOPTEST_TESTID", "")  # empty string = local single-container

log = logging.getLogger(__name__)

# Cached test ID (populated after first init or auto-detected)
_testid: Optional[str] = TESTID or None


def _url(path: str) -> str:
    base = BOPTEST_URL
    if _testid:
        return f"{base}/{_testid}{path}"
    return f"{base}{path}"


def get_name() -> Optional[str]:
    """Return the active test case name, or None if not initialized."""
    try:
        r = requests.get(_url("/name"), timeout=5)
        r.raise_for_status()
        data = r.json()
        # Cloud BOPTEST wraps in {"payload": {...}, "message": ...}
        if "payload" in data:
            return data["payload"].get("name")
        return data.get("name")
    except Exception as exc:
        log.warning("GET /name failed: %s", exc)
        return None


def initialize(
    time_period: str = "peak_cool_day",
    electricity_price: str = "dynamic",
) -> bool:
    """
    PUT /scenario to start a test run.
    Returns True on success.
    """
    payload = {
        "time_period": time_period,
        "electricity_price": electricity_price,
    }
    try:
        r = requests.put(_url("/scenario"), json=payload, timeout=10)
        r.raise_for_status()
        log.info("Scenario initialized: %s", r.json())
        return True
    except Exception as exc:
        log.error("PUT /scenario failed: %s", exc)
        return False


def get_current_time() -> float:
    """
    Return current simulation time [s] via GET /kpi.
    Falls back to 0.0 on failure.
    """
    try:
        r = requests.get(_url("/kpi"), timeout=5)
        r.raise_for_status()
        data = r.json()
        payload = data.get("payload", data)
        # 'time_elapsed' or similar key
        return float(payload.get("time_elapsed", payload.get("tdis_tot", 0.0)) or 0.0)
    except Exception as exc:
        log.warning("GET /kpi failed: %s", exc)
        return 0.0


def advance(step: int = 300) -> Optional[dict]:
    """
    POST /advance to step the simulation by `step` seconds.
    Returns the observation dict or None on failure.
    """
    try:
        r = requests.post(_url("/advance"), json={"step": step}, timeout=30)
        r.raise_for_status()
        data = r.json()
        return data.get("payload", data)
    except Exception as exc:
        log.error("POST /advance failed: %s", exc)
        return None


def get_results(point_names: list[str], window_seconds: float = 60.0) -> dict[str, float]:
    """
    Fetch the latest measurement values for the given sensor points.

    Uses PUT /results with a window ending at the current simulation time.
    Returns a flat dict {point_name: latest_value}.
    Values are coerced to float; missing/null → 0.0.
    """
    current_time = get_current_time()
    start_time = max(0.0, current_time - window_seconds)

    payload = {
        "point_names": point_names,
        "start_time": start_time,
        "final_time": current_time,
    }
    try:
        r = requests.put(_url("/results"), json=payload, timeout=15)
        r.raise_for_status()
        data = r.json()
        raw: dict = data.get("payload", data)
    except Exception as exc:
        log.error("PUT /results failed: %s", exc)
        return {p: 0.0 for p in point_names}

    result: dict[str, float] = {}
    for point in point_names:
        series = raw.get(point, [])
        if series:
            val = series[-1]
            result[point] = float(val) if val is not None else 0.0
        else:
            result[point] = 0.0
    return result


def ensure_initialized() -> bool:
    """
    Check if a test case is running. If not, initialize one.
    Returns True if a simulation is active after this call.
    """
    name = get_name()
    if name:
        log.info("BOPTEST simulation already running: %s", name)
        return True
    log.info("No active simulation found — initializing scenario...")
    return initialize()


# ---------------------------------------------------------------------------
# All sensor point names needed for the Sankey
# ---------------------------------------------------------------------------

ZONES = ["cor", "nor", "sou", "eas", "wes"]

SENSOR_POINTS: list[str] = [
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
    # AHU
    "hvac_reaAhu_PFanSup_y",
    "hvac_reaAhu_TMix_y",
    "hvac_reaAhu_TSup_y",
    "hvac_reaAhu_TRet_y",
    "hvac_reaAhu_V_flow_sup_y",
    "hvac_reaAhu_V_flow_ret_y",
    "hvac_reaAhu_TCooCoiSup_y",
    "hvac_reaAhu_TCooCoiRet_y",
    # Weather
    "weaSta_reaWeaTDryBul_y",
]

for _z in ZONES:
    SENSOR_POINTS += [
        f"hvac_reaZon{_z}_TZon_y",
        f"hvac_reaZon{_z}_TSup_y",
        f"hvac_reaZon{_z}_V_flow_y",
        f"hvac_reaZon{_z}_CO2Zon_y",
    ]
