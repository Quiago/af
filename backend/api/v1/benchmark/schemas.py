from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


class PeriodKPIs(BaseModel):
    energy_kwh_m2: float          # BOPTEST ener_tot  (kWh / m²)
    energy_kwh: float             # × FLOOR_AREA_M2
    thermal_discomfort_kh: float  # BOPTEST tdis_tot  (Kh)
    cost_usd_m2: float            # BOPTEST cost_tot  (USD / m²)
    cost_usd: float               # × FLOOR_AREA_M2


class SavingsSummary(BaseModel):
    energy_pct: float         # (baseline - optimized) / baseline × 100
    energy_kwh: float         # absolute kWh saved over the period
    cost_aed: float           # energy_kwh × DEWA_AED_PER_KWH
    cost_aed_annual: float    # cost_aed × (365 / period_days)
    discomfort_pct: float     # (baseline - optimized) / baseline × 100


class BenchmarkResult(BaseModel):
    run_id: str
    scenario: str
    period_days: float
    started_at: datetime
    completed_at: Optional[datetime] = None
    status: Literal[
        "pending",
        "running_baseline",
        "running_optimized",
        "completed",
        "failed",
    ]
    progress_pct: float = 0.0
    baseline: Optional[PeriodKPIs] = None
    optimized: Optional[PeriodKPIs] = None
    savings: Optional[SavingsSummary] = None
    error: Optional[str] = None
