from __future__ import annotations

import json
from typing import Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str   # postgresql://user:pass@host:5432/dbname
    boptest_url: str = "http://web"

    # ── Zone layout ───────────────────────────────────────────────────────────
    # Override via ZONE_LAYOUT env var as JSON string.
    # Defaults match multizone_office_simple_air (5-zone VAV, Chicago).
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

    # ── Zone signal patterns ──────────────────────────────────────────────────
    # Use {zone_cap} for the zone ID with first letter capitalized.
    # Defaults match multizone_office_simple_air naming convention.
    # Override when using a different test case.
    zone_temp_signal: str = "hvac_reaZon{zone_cap}_TZon_y"
    zone_co2_signal: str = "hvac_reaZon{zone_cap}_CO2Zon_y"

    # ── Forecast key patterns ─────────────────────────────────────────────────
    # Use {zone_id} for the zone ID as-is (e.g. cor, eas, nor, sou, wes).
    # Defaults match multizone_office_simple_air forecast point names.
    forecast_lower_setp: str = "LowerSetp[{zone_id}]"
    forecast_upper_setp: str = "UpperSetp[{zone_id}]"
    forecast_occupancy: str = "Occupancy[{zone_id}]"

    # ── Chiller signal names ──────────────────────────────────────────────────
    chiller_power_signal: str = "chi_reaPChi_y"
    chiller_supply_temp_signal: str = "chi_reaTSup_y"
    chiller_return_temp_signal: str = "chi_reaTRet_y"
    chiller_flow_signal: str = "chi_reaFloSup_y"

    # ── AHU signal names ──────────────────────────────────────────────────────
    ahu_supply_temp_signal: str = "hvac_reaAhu_TSup_y"
    ahu_return_temp_signal: str = "hvac_reaAhu_TRet_y"
    ahu_fan_power_signal: str = "hvac_reaAhu_PFanSup_y"
    ahu_pressure_signal: str = "hvac_reaAhu_dp_sup_y"

    # ── History / analytics query signals ────────────────────────────────────
    # Signals used in time-bucketed history queries.
    # Default to core zone temperature and AHU fan power.
    history_temp_signal: str = "hvac_reaZonCor_TZon_y"
    history_fan_power_signal: str = "hvac_reaAhu_PFanSup_y"
    history_co2_signal: str = "hvac_reaZonCor_CO2Zon_y"

    @field_validator("zone_layout", mode="before")
    @classmethod
    def parse_zone_layout(cls, v: Any) -> Any:
        if isinstance(v, str):
            return json.loads(v)
        return v

    @property
    def zone_ids(self) -> list[str]:
        return [z["id"] for z in self.zone_layout]


settings = Settings()
