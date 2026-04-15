from __future__ import annotations

import json
from typing import Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str   # postgresql://user:pass@host:5432/dbname
    boptest_url: str = "http://web"

    # Zone layout — matches backend defaults exactly
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
    def forecast_point_names(self) -> list[str]:
        zone_ids = [z["id"] for z in self.zone_layout]
        points: list[str] = []
        for z in zone_ids:
            points += [f"LowerSetp[{z}]", f"UpperSetp[{z}]", f"Occupancy[{z}]"]
        return points


settings = Settings()
