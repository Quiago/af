"""Transform raw BOPTEST advance() + forecast() output → BuildingSnapshot.

When settings.use_sim_service is True the data source switches to:
  - sim-service /current  for live snapshots
  - TimescaleDB (asyncpg) for historical queries
"""
from __future__ import annotations

import time
from core.config import logger
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import Integer, func, select

from api.v1.building.schemas import (
    BuildingSnapshot,
    EquipmentData,
    GridConfig,
    HealthMetric,
    HistoryPoint,
    KPIs,
    ZoneData,
)
from core.config import settings


@dataclass(frozen=True)
class ZoneConfig:
    id: str
    name: str
    row: int
    col: int


def get_zone_configs() -> list[ZoneConfig]:
    return [ZoneConfig(**z) for z in settings.zone_layout]


def get_zone_by_id(zone_id: str) -> ZoneConfig | None:
    return next((z for z in get_zone_configs() if z.id == zone_id), None)

K_TO_C = 273.15


def _k2c(k: float) -> float:
    return round(k - K_TO_C, 2)


def _clamp(v: float) -> int:
    return max(0, min(100, int(v)))


def _score_status(v: int) -> str:
    if v >= 70:
        return "ok"
    if v >= 40:
        return "warning"
    return "critical"


# ─── Zone transformation ──────────────────────────────────────────────────────

def _build_zones(
    outputs: dict[str, Any],
    forecast: dict[str, list[float]],
) -> list[ZoneData]:
    zones: list[ZoneData] = []
    for zc in get_zone_configs():
        z = zc.id
        zone_cap = z.capitalize()   # cor → Cor

        temp_k: float = outputs.get(f"hvac_reaZon{zone_cap}_TZon_y", K_TO_C + 21)
        co2: float = outputs.get(f"hvac_reaZon{zone_cap}_CO2Zon_y", 600.0)

        # Setpoints from forecast — first value = current step
        lower_k: float = (forecast.get(f"LowerSetp[{z}]") or [K_TO_C + 20])[0]
        upper_k: float = (forecast.get(f"UpperSetp[{z}]") or [K_TO_C + 24])[0]
        occ_vals = forecast.get(f"Occupancy[{z}]") or [0.0]
        occupancy = float(occ_vals[0]) > 0

        temp_c    = _k2c(temp_k)
        lower_c   = _k2c(lower_k)
        upper_c   = _k2c(upper_k)
        setpoint  = round((lower_c + upper_c) / 2, 2)

        zones.append(
            ZoneData(
                id=z,
                name=zc.name,
                temperature=temp_c,
                setpoint=setpoint,
                setpoint_lower=lower_c,
                setpoint_upper=upper_c,
                co2=round(co2, 1),
                occupancy=occupancy,
                row=zc.row,
                col=zc.col,
            )
        )
    return zones


# ─── Equipment transformation ─────────────────────────────────────────────────

def _build_chiller(outputs: dict[str, Any]) -> EquipmentData:
    power_w: float  = outputs.get("chi_reaPChi_y", 0.0)
    t_sup_k: float  = outputs.get("chi_reaTSup_y", K_TO_C + 7.0)
    t_ret_k: float  = outputs.get("chi_reaTRet_y", K_TO_C + 12.0)
    flow_m3s: float = outputs.get("chi_reaFloSup_y", 0.01)

    t_sup_c = _k2c(t_sup_k)
    t_ret_c = _k2c(t_ret_k)

    if power_w > 0:
        cop = round((t_ret_k - t_sup_k) * 4300 * flow_m3s / power_w, 2)
    else:
        cop = 0.0

    cop = max(0.0, cop)

    if cop > 3.0:
        status = "ok"
    elif cop > 2.0:
        status = "warning"
    else:
        status = "critical"

    health_score = _clamp(min(100.0, cop / 5.0 * 100))
    cop_score    = health_score
    vib_score    = 85          # static until RUL model
    filter_score = 80          # static

    return EquipmentData(
        id="chiller-1",
        name="Chiller 1",
        type="chiller",
        status=status,
        zone="Central Plant",
        lastServiceDate="2026-01-15",
        metrics={
            "cop": cop,
            "power_w": round(power_w, 1),
            "supply_temp_c": t_sup_c,
            "return_temp_c": t_ret_c,
        },
        healthScore=health_score,
        healthMetrics=[
            HealthMetric(
                label="COP Efficiency",
                value=cop_score,
                displayValue=f"{cop:.2f}",
                status=_score_status(cop_score),
            ),
            HealthMetric(
                label="Vibration",
                value=vib_score,
                displayValue="Normal",
                status=_score_status(vib_score),
            ),
            HealthMetric(
                label="Filter ΔP",
                value=filter_score,
                displayValue="—",
                status=_score_status(filter_score),
            ),
        ],
    )


def _build_ahu(outputs: dict[str, Any]) -> EquipmentData:
    t_sup_k: float    = outputs.get("hvac_reaAhu_TSup_y", K_TO_C + 16.0)
    t_ret_k: float    = outputs.get("hvac_reaAhu_TRet_y", K_TO_C + 22.0)
    fan_w: float      = outputs.get("hvac_reaAhu_PFanSup_y", 0.0)
    dp_pa: float      = outputs.get("hvac_reaAhu_dp_sup_y", 100.0)

    t_sup_c = _k2c(t_sup_k)
    t_ret_c = _k2c(t_ret_k)

    if t_sup_c < 10 or t_sup_c > 20:
        status = "warning"
    else:
        status = "ok"

    deviation   = abs(t_sup_c - 16.0)
    temp_score  = _clamp(100 - deviation * 20)
    dp_score    = _clamp((1 - dp_pa / 500) * 100)
    health_score = _clamp((temp_score * 0.5 + dp_score * 0.3 + 85 * 0.2))

    return EquipmentData(
        id="ahu-1",
        name="AHU-1",
        type="ahu",
        status=status,
        zone="Air Handling",
        lastServiceDate="2026-02-01",
        metrics={
            "supply_temp_c": t_sup_c,
            "return_temp_c": t_ret_c,
            "fan_power_w": round(fan_w, 1),
            "duct_pressure_pa": round(dp_pa, 1),
        },
        healthScore=health_score,
        healthMetrics=[
            HealthMetric(
                label="Supply Temp Deviation",
                value=temp_score,
                displayValue=f"{deviation:.1f}°C",
                status=_score_status(temp_score),
            ),
            HealthMetric(
                label="Fan Power",
                value=_clamp((1 - fan_w / 5000) * 100) if fan_w > 0 else 100,
                displayValue=f"{fan_w:.0f} W",
                status="ok",
            ),
            HealthMetric(
                label="Duct Pressure",
                value=dp_score,
                displayValue=f"{dp_pa:.0f} Pa",
                status=_score_status(dp_score),
            ),
        ],
    )


def _build_filter(outputs: dict[str, Any]) -> EquipmentData:
    dp_pa: float = outputs.get("hvac_reaAhu_dp_sup_y", 100.0)

    if dp_pa > 350:
        status = "critical"
    elif dp_pa > 250:
        status = "warning"
    else:
        status = "ok"

    dp_score         = _clamp((1 - dp_pa / 500) * 100)
    days_since       = 45
    days_score       = _clamp(100 - (days_since / 180) * 100)
    remaining        = max(0, 180 - days_since)
    remaining_score  = _clamp((remaining / 180) * 100)
    health_score     = _clamp(dp_score * 0.5 + days_score * 0.25 + remaining_score * 0.25)

    return EquipmentData(
        id="filter-1",
        name="Filter Bank 1",
        type="filter",
        status=status,
        zone="Air Handling",
        parentId="ahu-1",
        lastServiceDate="2025-12-01",
        metrics={
            "differential_pressure_pa": round(dp_pa, 1),
        },
        healthScore=health_score,
        healthMetrics=[
            HealthMetric(
                label="ΔP Usage",
                value=dp_score,
                displayValue=f"{dp_pa:.0f} Pa",
                status=_score_status(dp_score),
            ),
            HealthMetric(
                label="Days Since Change",
                value=days_score,
                displayValue=f"{days_since} days",
                status=_score_status(days_score),
            ),
            HealthMetric(
                label="Remaining Life",
                value=remaining_score,
                displayValue=f"{remaining} days",
                status=_score_status(remaining_score),
            ),
        ],
    )


# ─── KPI transformation ───────────────────────────────────────────────────────

def _build_kpis(raw_kpis: dict[str, Any]) -> KPIs:
    def _safe(key: str) -> float | None:
        v = raw_kpis.get(key)
        return float(v) if v is not None else None

    return KPIs(
        energy_kwh=_safe("ener_tot"),
        thermal_discomfort=_safe("tdis_tot"),
        cost_total=_safe("cost_tot"),
        pue=None,
    )


# ─── Public API ───────────────────────────────────────────────────────────────

def build_snapshot(
    outputs: dict[str, Any],
    forecast: dict[str, list[float]],
    raw_kpis: dict[str, Any],
) -> BuildingSnapshot:
    """Transform BOPTEST outputs → BuildingSnapshot (frontend contract)."""
    sim_time: float = float(outputs.get("time", 0.0))

    zones     = _build_zones(outputs, forecast)
    equipment = [_build_chiller(outputs), _build_ahu(outputs), _build_filter(outputs)]
    kpis      = _build_kpis(raw_kpis)

    snapshot = BuildingSnapshot(
        timestamp=time.time(),
        simulation_time=sim_time,
        zones=zones,
        equipment=equipment,
        kpis=kpis,
    )

    logger.debug(
        "Snapshot t=%.0f | zones: %s",
        sim_time,
        {z.id: f"{z.temperature:.1f}°C" for z in zones},
    )
    return snapshot


def build_grid_config() -> GridConfig:
    return GridConfig(
        rows=settings.grid_rows,
        cols=settings.grid_cols,
        zones=[
            {"id": z["id"], "name": z["name"], "row": z["row"], "col": z["col"]}
            for z in settings.zone_layout
        ],
    )


# ─── Time-series history (downsampled) ───────────────────────────────────────

# strftime format strings that produce full ISO-like datetimes SQLite can
# round-trip back through strftime('%s', ...) to get Unix epoch seconds.
_RESOLUTION_FMT: dict[str, str] = {
    "1m": "%Y-%m-%d %H:%M:00",
    "1h": "%Y-%m-%d %H:00:00",
    "1d": "%Y-%m-%d 00:00:00",
}


async def get_history(
    resolution: str,
    start_dt: datetime,
    end_dt: datetime,
) -> list[HistoryPoint]:
    """Downsample measurements for the requested time window.

    When USE_SIM_SERVICE=true → queries TimescaleDB via asyncpg (time_bucket).
    When USE_SIM_SERVICE=false → queries SQLite via SQLAlchemy (legacy strftime).
    """
    if settings.use_sim_service:
        from db.timescale import get_history as _ts_history
        rows_dicts = await _ts_history(resolution, start_dt, end_dt)
        return [
            HistoryPoint(
                timestamp=int(r.get("timestamp") or 0),
                core_temp_c=_safe_float(r.get("core_temp_c")),
                fan_power_w=_safe_float(r.get("fan_power_w")),
                core_co2_ppm=_safe_float(r.get("core_co2_ppm")),
            )
            for r in rows_dicts
        ]

    # ── Legacy: SQLite ────────────────────────────────────────────────────────
    from db.engine import AsyncSessionLocal
    from api.v1.boptest.models import BoptestMeasurement

    fmt = _RESOLUTION_FMT.get(resolution, "%Y-%m-%d %H:00:00")
    bucket = func.strftime(fmt, BoptestMeasurement.timestamp)

    stmt = (
        select(
            func.cast(func.strftime("%s", bucket), Integer).label("timestamp"),
            func.avg(BoptestMeasurement.core_temp_c).label("core_temp_c"),
            func.avg(BoptestMeasurement.core_co2_ppm).label("core_co2_ppm"),
            func.max(BoptestMeasurement.fan_power_w).label("fan_power_w"),
        )
        .where(BoptestMeasurement.timestamp.between(start_dt, end_dt))
        .group_by(bucket)
        .order_by(bucket)
    )

    async with AsyncSessionLocal() as session:
        rows = (await session.execute(stmt)).all()

        if not rows:
            # The requested window has no data yet (typical during early backfill).
            # Return the most recent available rows so the chart isn't empty.
            fallback_fmt = "%Y-%m-%d %H:%M:00"   # 1-minute buckets for fallback
            fallback_bucket = func.strftime(fallback_fmt, BoptestMeasurement.timestamp)
            fallback_stmt = (
                select(
                    func.cast(func.strftime("%s", fallback_bucket), Integer).label("timestamp"),
                    func.avg(BoptestMeasurement.core_temp_c).label("core_temp_c"),
                    func.avg(BoptestMeasurement.core_co2_ppm).label("core_co2_ppm"),
                    func.max(BoptestMeasurement.fan_power_w).label("fan_power_w"),
                )
                .group_by(fallback_bucket)
                .order_by(fallback_bucket.desc())
                .limit(500)
            )
            fallback_rows = (await session.execute(fallback_stmt)).all()
            rows = list(reversed(fallback_rows))
            logger.info(
                "History query: resolution=%s start=%s end=%s → 0 rows in range, "
                "returning %d fallback rows",
                resolution,
                start_dt.isoformat(timespec="seconds"),
                end_dt.isoformat(timespec="seconds"),
                len(rows),
            )
        else:
            logger.info(
                "History query: resolution=%s start=%s end=%s → %d rows",
                resolution,
                start_dt.isoformat(timespec="seconds"),
                end_dt.isoformat(timespec="seconds"),
                len(rows),
            )

    return [
        HistoryPoint(
            timestamp=row.timestamp or 0,
            core_temp_c=row.core_temp_c,
            fan_power_w=row.fan_power_w,
            core_co2_ppm=row.core_co2_ppm,
        )
        for row in rows
    ]


async def get_timeseries(
    resolution: str,
    start_dt: datetime | None,
    end_dt: datetime,
    limit: int = 500,
) -> list[HistoryPoint]:
    """Flexible trending query — returns up to `limit` buckets.

    When USE_SIM_SERVICE=true → queries TimescaleDB directly via asyncpg.
    When USE_SIM_SERVICE=false → queries SQLite via SQLAlchemy (legacy).
    """
    if settings.use_sim_service:
        from db.timescale import get_timeseries as _ts_get
        rows_dicts = await _ts_get(resolution, start_dt, end_dt, limit)
        return [
            HistoryPoint(
                timestamp=int(r.get("timestamp") or 0),
                core_temp_c=_safe_float(r.get("core_temp_c")),
                fan_power_w=_safe_float(r.get("fan_power_w")),
                core_co2_ppm=_safe_float(r.get("core_co2_ppm")),
            )
            for r in rows_dicts
        ]

    # ── Legacy: SQLite ────────────────────────────────────────────────────────
    from db.engine import AsyncSessionLocal
    from api.v1.boptest.models import BoptestMeasurement

    fmt    = _RESOLUTION_FMT.get(resolution, "%Y-%m-%d %H:%M:00")
    bucket = func.strftime(fmt, BoptestMeasurement.timestamp)

    agg = (
        select(
            func.cast(func.strftime("%s", bucket), Integer).label("timestamp"),
            func.avg(BoptestMeasurement.core_temp_c).label("core_temp_c"),
            func.avg(BoptestMeasurement.core_co2_ppm).label("core_co2_ppm"),
            func.max(BoptestMeasurement.fan_power_w).label("fan_power_w"),
        )
        .group_by(bucket)
    )

    if start_dt is not None:
        agg = agg.where(BoptestMeasurement.timestamp.between(start_dt, end_dt))
        agg = agg.order_by(bucket).limit(limit)
    else:
        agg = agg.where(BoptestMeasurement.timestamp <= end_dt)
        agg = agg.order_by(bucket.desc()).limit(limit)

    async with AsyncSessionLocal() as session:
        rows = list(reversed((await session.execute(agg)).all()))

    return [
        HistoryPoint(
            timestamp=row.timestamp or 0,
            core_temp_c=row.core_temp_c,
            fan_power_w=row.fan_power_w,
            core_co2_ppm=row.core_co2_ppm,
        )
        for row in rows
    ]


# ─── Helper ───────────────────────────────────────────────────────────────────

def _safe_float(v: object) -> float | None:
    if v is None:
        return None
    try:
        f = float(v)  # type: ignore[arg-type]
        return None if (f != f or abs(f) == float("inf")) else f
    except (TypeError, ValueError):
        return None
