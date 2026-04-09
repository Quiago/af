from __future__ import annotations
from typing import Any
from pydantic import BaseModel


# ─── Status / lifecycle ───────────────────────────────────────────────────────

class BOPTESTStatus(BaseModel):
    testid: str | None
    current_time: float | None
    test_case: str
    scenario: str
    is_running: bool


class RestartResponse(BaseModel):
    success: bool
    testid: str | None
    message: str


# ─── Simulation control ───────────────────────────────────────────────────────

class StepRequest(BaseModel):
    step: float                         # control step in seconds


class StepResponse(BaseModel):
    step: float


class InitializeRequest(BaseModel):
    start_time: float = 0.0
    warmup_period: float = 0.0


class ScenarioRequest(BaseModel):
    electricity_price: str | None = None   # "constant" | "dynamic" | "highly_dynamic"
    time_period: str | None = None         # e.g. "peak_cool_day"


class ScenarioResponse(BaseModel):
    electricity_price: str | None
    time_period: dict[str, Any] | None    # initial measurements if time_period set


# ─── Data retrieval ───────────────────────────────────────────────────────────

class ForecastRequest(BaseModel):
    point_names: list[str]
    horizon: float                      # seconds
    interval: float                     # seconds


class ResultsRequest(BaseModel):
    point_names: list[str]
    start_time: float
    final_time: float


class AdvanceRequest(BaseModel):
    inputs: dict[str, float] = {}       # {<input_name_u>: value, ...}
