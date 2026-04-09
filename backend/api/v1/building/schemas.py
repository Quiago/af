"""Pydantic v2 schemas — mirrors frontend types/building.types.ts exactly."""
from __future__ import annotations

from pydantic import BaseModel


class HealthMetric(BaseModel):
    label: str
    value: int                  # 0-100
    displayValue: str
    status: str                 # 'ok' | 'warning' | 'critical'


class ZoneData(BaseModel):
    id: str                     # "cor" | "eas" | "nor" | "sou" | "wes"
    name: str
    temperature: float          # Celsius
    setpoint: float             # Celsius (midpoint of lower/upper)
    setpoint_lower: float       # Celsius
    setpoint_upper: float       # Celsius
    co2: float                  # ppm
    occupancy: bool
    row: int                    # grid position 0-2
    col: int                    # grid position 0-2


class EquipmentData(BaseModel):
    id: str
    name: str
    type: str                   # 'chiller' | 'ahu' | 'filter'
    status: str                 # 'ok' | 'warning' | 'critical' | 'offline'
    metrics: dict[str, float]
    healthScore: int            # 0-100
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
    timestamp: float            # Unix seconds (wall clock)
    simulation_time: float      # BOPTEST simulation time in seconds
    zones: list[ZoneData]
    equipment: list[EquipmentData]
    kpis: KPIs


class GridConfig(BaseModel):
    rows: int
    cols: int
    zones: list[dict]           # list of {id, name, row, col}


class HistoryPoint(BaseModel):
    timestamp: int              # Unix seconds (bucket start)
    core_temp_c: float | None
    fan_power_w: float | None
    core_co2_ppm: float | None
