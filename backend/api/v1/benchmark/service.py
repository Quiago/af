"""Benchmark runner — compare BOPTEST baseline vs rule-based INAIA optimizer.

Two independent test cases are deployed sequentially:
  1. Baseline  — default controller (no overrides)
  2. Optimized — SAT reset + DSP reset (rule-based)

Both run the same scenario (peak_cool_day) for N_STEPS hours.
KPIs are collected after each run then the test case is stopped.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from api.v1.benchmark.schemas import BenchmarkResult, PeriodKPIs, SavingsSummary
from api.v1.boptest.service import (
    BOPTESTError,
    advance,
    get_kpis,
    select_test_case,
    set_scenario,
    set_step,
    stop_test_case,
)
from core.config import settings

logger = logging.getLogger(__name__)

# ─── Constants ────────────────────────────────────────────────────────────────

FLOOR_AREA_M2    = 1662.664   # NOR+SOU+EAS+WES+COR combined
DEWA_AED_PER_KWH = 0.44       # Dubai DEWA commercial tariff
STEP_S           = 3600.0            # 1-hour steps for benchmark runs
N_STEPS          = 168               # 7 days
PERIOD_DAYS      = N_STEPS * STEP_S / 86_400

# Zone temperature output keys (Kelvin)
_ZONE_TEMP_KEYS = [
    "hvac_reaZonCor_TZon_y",
    "hvac_reaZonNor_TZon_y",
    "hvac_reaZonSou_TZon_y",
    "hvac_reaZonEas_TZon_y",
    "hvac_reaZonWes_TZon_y",
]
_K_TO_C  = 273.15
_SP_C    = 24.0   # representative comfort setpoint


# ─── Optimizer protocols ──────────────────────────────────────────────────────

class _NoOpOptimizer:
    """Baseline: let the default BOPTEST controller run (no overrides)."""

    def compute_inputs(self, _outputs: dict[str, Any]) -> dict[str, Any]:
        return {}


class _RuleBasedOptimizer:
    """SAT reset + DSP reset strategy.

    SAT reset: raise supply-air temperature setpoint from 12 °C toward 20 °C
    when zones are comfortable — reduces chiller lift and reheat energy.

    DSP reset: lower duct static pressure setpoint from 280 Pa toward 50 Pa
    when VAV damper demand is low — reduces fan energy.
    """

    def compute_inputs(self, outputs: dict[str, Any]) -> dict[str, Any]:
        # Max zone temperature across all 5 zones
        zone_temps_c = [
            outputs[k] - _K_TO_C
            for k in _ZONE_TEMP_KEYS
            if k in outputs and outputs[k] is not None
        ]
        max_temp_c = max(zone_temps_c) if zone_temps_c else _SP_C

        # SAT reset: comfortable → raise SAT (less cooling energy)
        # delta > 0 → zones warm → lower SAT; delta < 0 → zones cool → raise SAT
        delta = max_temp_c - _SP_C
        sat_c  = 12.0 + max(0.0, min(8.0, (0.0 - delta) * 4.0))
        sat_k  = sat_c + _K_TO_C

        # DSP reset: proxy demand via how warm zones are
        # warm zones → high demand → higher pressure; cool zones → lower pressure
        demand_frac = max(0.0, min(1.0, (max_temp_c - (_SP_C - 2.0)) / 4.0))
        dsp_pa = 50.0 + demand_frac * 230.0

        return {
            "hvac_oveTSup_u":          sat_k,
            "hvac_oveTSup_activate":   1,
            "hvac_oveDuctPres_u":      dsp_pa,
            "hvac_oveDuctPres_activate": 1,
        }


# ─── Core runner ──────────────────────────────────────────────────────────────

async def _run_period(
    testid: str,
    optimizer: _NoOpOptimizer | _RuleBasedOptimizer,
    result: BenchmarkResult,
    phase_label: str,
) -> PeriodKPIs:
    """Run N_STEPS advances on testid and return KPIs.

    set_scenario already initialises the simulation to the scenario start time,
    so no separate initialize() call is needed.
    """
    logger.info("[Benchmark] %s — configuring testid=%s", phase_label, testid)
    await set_scenario(testid, settings.benchmark_scenario, settings.benchmark_price)
    await set_step(testid, STEP_S)

    inputs: dict[str, Any] = {}
    for step in range(1, N_STEPS + 1):
        try:
            outputs = await advance(testid, inputs)
        except BOPTESTError as exc:
            raise BOPTESTError(f"{phase_label} step {step} failed: {exc}") from exc

        inputs = optimizer.compute_inputs(outputs)

        result.progress_pct = (
            (step / N_STEPS) * 50.0
            + (0.0 if phase_label == "baseline" else 50.0)
        )

        if step % 24 == 0 or step == N_STEPS:
            logger.info(
                "[Benchmark] %s  step %d/%d  (%.1f%%)",
                phase_label, step, N_STEPS, result.progress_pct,
            )

    kpis_raw = await get_kpis(testid)
    logger.info("[Benchmark] %s KPIs: %s", phase_label, kpis_raw)

    energy_kwh_m2          = float(kpis_raw.get("ener_tot", 0.0))
    thermal_discomfort_kh  = float(kpis_raw.get("tdis_tot", 0.0))
    cost_usd_m2            = float(kpis_raw.get("cost_tot", 0.0))

    return PeriodKPIs(
        energy_kwh_m2         = energy_kwh_m2,
        energy_kwh            = energy_kwh_m2 * FLOOR_AREA_M2,
        thermal_discomfort_kh = thermal_discomfort_kh,
        cost_usd_m2           = cost_usd_m2,
        cost_usd              = cost_usd_m2 * FLOOR_AREA_M2,
    )


def _compute_savings(baseline: PeriodKPIs, optimized: PeriodKPIs) -> SavingsSummary:
    energy_saved_kwh = baseline.energy_kwh - optimized.energy_kwh
    energy_pct = (
        (energy_saved_kwh / baseline.energy_kwh * 100.0)
        if baseline.energy_kwh > 0 else 0.0
    )
    discomfort_pct = (
        ((baseline.thermal_discomfort_kh - optimized.thermal_discomfort_kh)
         / baseline.thermal_discomfort_kh * 100.0)
        if baseline.thermal_discomfort_kh > 0 else 0.0
    )
    cost_aed = max(0.0, energy_saved_kwh) * DEWA_AED_PER_KWH
    return SavingsSummary(
        energy_pct       = round(energy_pct, 2),
        energy_kwh       = round(energy_saved_kwh, 2),
        cost_aed         = round(cost_aed, 2),
        cost_aed_annual  = round(cost_aed * (365.0 / PERIOD_DAYS), 0),
        discomfort_pct   = round(discomfort_pct, 2),
    )


# ─── Background task ──────────────────────────────────────────────────────────

async def run_benchmark(app: Any) -> None:
    """Deploy two test cases sequentially and compute savings.

    Stores a BenchmarkResult in app.state.benchmark_result throughout.
    Safe to run as an asyncio background task.
    """
    result = BenchmarkResult(
        run_id      = str(uuid.uuid4())[:8],
        scenario    = settings.benchmark_scenario,
        period_days = PERIOD_DAYS,
        started_at  = datetime.now(timezone.utc),
        status      = "pending",
    )
    app.state.benchmark_result = result

    baseline_testid:  str | None = None
    optimized_testid: str | None = None

    try:
        # ── Baseline run ────────────────────────────────────────────────────
        result.status = "running_baseline"
        logger.info("[Benchmark] Starting baseline run (run_id=%s)", result.run_id)
        baseline_testid = await select_test_case(settings.boptest_test_case)
        result.baseline = await _run_period(baseline_testid, _NoOpOptimizer(), result, "baseline")
        await stop_test_case(baseline_testid)
        baseline_testid = None
        logger.info("[Benchmark] Baseline complete: %.2f kWh", result.baseline.energy_kwh)

        # ── Optimized run ───────────────────────────────────────────────────
        result.status = "running_optimized"
        logger.info("[Benchmark] Starting optimized run")
        optimized_testid = await select_test_case(settings.boptest_test_case)
        result.optimized = await _run_period(optimized_testid, _RuleBasedOptimizer(), result, "optimized")
        await stop_test_case(optimized_testid)
        optimized_testid = None
        logger.info("[Benchmark] Optimized complete: %.2f kWh", result.optimized.energy_kwh)

        # ── Savings ─────────────────────────────────────────────────────────
        result.savings      = _compute_savings(result.baseline, result.optimized)
        result.status       = "completed"
        result.completed_at = datetime.now(timezone.utc)
        result.progress_pct = 100.0
        logger.info(
            "[Benchmark] Done — savings: %.1f%% energy  AED %.0f/yr",
            result.savings.energy_pct,
            result.savings.cost_aed_annual,
        )

    except asyncio.CancelledError:
        result.status = "failed"
        result.error  = "cancelled"
        raise

    except Exception as exc:
        logger.exception("[Benchmark] Failed: %s", exc)
        result.status = "failed"
        result.error  = str(exc)

    finally:
        # Clean up any dangling test cases
        for tid in filter(None, [baseline_testid, optimized_testid]):
            try:
                await stop_test_case(tid)
            except Exception:
                pass
