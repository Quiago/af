"""Pydantic v2 schemas — identical contract to backend/api/v1/building/schemas.py.

The frontend consumes these shapes. Both services must stay in sync.
"""
from __future__ import annotations

from pydantic import BaseModel


class HealthMetric(BaseModel):
    label: str
    value: int          # 0-100
    displayValue: str
    status: str         # 'ok' | 'warning' | 'critical'


class ZoneData(BaseModel):
    id: str             # "cor" | "eas" | "nor" | "sou" | "wes"
    name: str
    temperature: float  # Celsius
    setpoint: float     # Celsius (midpoint of lower/upper)
    setpoint_lower: float
    setpoint_upper: float
    co2: float          # ppm
    occupancy: bool
    row: int            # grid position 0-2
    col: int            # grid position 0-2


class EquipmentData(BaseModel):
    id: str
    name: str
    type: str           # 'chiller' | 'ahu' | 'filter'
    status: str         # 'ok' | 'warning' | 'critical' | 'offline'
    metrics: dict[str, float]
    healthScore: int    # 0-100
    healthMetrics: list[HealthMetric]
    lastServiceDate: str | None = None
    zone: str | None = None
    parentId: str | None = None


class KPIs(BaseModel):
    energy_kwh: float | None = None
    thermal_discomfort: float | None = None
    cost_total: float | None = None
    pue: float | None = None


class BuildingSnapshot(BaseModel):
    timestamp: float        # Unix seconds (wall clock)
    simulation_time: float  # BOPTEST simulation seconds elapsed
    zones: list[ZoneData]
    equipment: list[EquipmentData]
    kpis: KPIs


class GridConfig(BaseModel):
    rows: int
    cols: int
    zones: list[dict]   # list of {id, name, row, col}


class HistoryPoint(BaseModel):
    timestamp: int              # Unix seconds (bucket start)
    core_temp_c: float | None
    fan_power_w: float | None
    core_co2_ppm: float | None


class SimWorkerStatus(BaseModel):
    testid: str | None
    mode: str                   # 'observation' | 'control'
    last_sim_time: float | None
    last_wall_time: str | None  # ISO 8601
    boptest_step: int | None
    seconds_since_update: float | None


class ControlPayload(BaseModel):
    point_name: str
    value: float
    activate: bool = True
