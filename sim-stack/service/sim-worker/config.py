from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    boptest_url: str = "http://web"
    boptest_test_case: str = "multizone_office_simple_air"
    boptest_step: int = 300          # seconds per advance step
    live_tick_seconds: float = 300.0 # wall-clock pause between live ticks

    database_url: str  # postgresql://user:pass@host:5432/dbname


settings = Settings()
