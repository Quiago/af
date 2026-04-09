from __future__ import annotations

import json
from typing import Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # BOPTEST connection
    boptest_url: str = "https://api.boptest.net"
    boptest_test_case: str = "multizone_office_simple_air"
    boptest_test_id: str = ""    # legacy: testid is now stored in SimulationRun checkpoint table
    boptest_step: int = 60       # seconds per BOPTEST advance step

    # Database
    database_url: str = "sqlite+aiosqlite:///./boptest.db"

    # Historian — backfill runs only when the DB has no checkpoint yet.
    # On subsequent restarts the server resumes from the last persisted sim_time.
    initial_backfill_days: int = 7    # days of history to generate on first boot
    backfill_step_seconds: int = 3600  # step size during backfill (larger = fewer calls = faster)
    backfill_batch_size: int = 500    # rows per DB commit during catch-up

    # Live loop: seconds to sleep between real-time advances.
    # Must equal boptest_step to maintain 1:1 sim-to-wall-clock rate.
    live_tick_seconds: float = 300.0

    # Benchmark runner — used ONLY by POST /api/v1/benchmark/run, not by the historian loop.
    benchmark_scenario: str = "peak_cool_day"
    benchmark_price: str = "dynamic"

    # CORS
    cors_origins: str = "http://localhost:5173"

    # Zone spatial layout — JSON string in .env, parsed to list[dict]
    zone_layout: list[dict[str, Any]] = Field(
        default=[
            {"id": "nor", "name": "North", "row": 0, "col": 1},
            {"id": "wes", "name": "West",  "row": 1, "col": 0},
            {"id": "cor", "name": "Core",  "row": 1, "col": 1},
            {"id": "eas", "name": "East",  "row": 1, "col": 2},
            {"id": "sou", "name": "South", "row": 2, "col": 1},
        ]
    )
    grid_rows: int = 3
    grid_cols: int = 3

    @field_validator("zone_layout", mode="before")
    @classmethod
    def parse_zone_layout(cls, v: Any) -> Any:
        if isinstance(v, str):
            return json.loads(v)
        return v

    @property
    def effective_backfill_days(self) -> int:
        return self.initial_backfill_days

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    # Forecast point names required every step
    @property
    def forecast_point_names(self) -> list[str]:
        zone_ids = [z["id"] for z in self.zone_layout]
        points: list[str] = []
        for z in zone_ids:
            points += [f"LowerSetp[{z}]", f"UpperSetp[{z}]", f"Occupancy[{z}]"]
        points.append("PriceElectricPowerHighlyDynamic")
        return points


settings = Settings()
