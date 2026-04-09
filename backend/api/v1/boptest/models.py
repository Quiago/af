"""SQLAlchemy ORM models for BOPTEST time-series historian."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class BoptestMeasurement(Base):
    """Derived/downsampled table consumed by the frontend history endpoint."""

    __tablename__ = "boptest_measurements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # index=True is critical for time-range queries on time series
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    fan_power_w: Mapped[float | None] = mapped_column(Float, nullable=True)
    core_temp_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    core_co2_ppm: Mapped[float | None] = mapped_column(Float, nullable=True)


class SimulationRun(Base):
    """Singleton checkpoint table (always id=1).

    Persists the last known BOPTEST sim_time and its wall-clock mapping so the
    server can resume the historian from exactly where it left off after any
    restart or testid expiry, rather than always rewinding to t=0.
    """

    __tablename__ = "simulation_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)   # always 1
    testid: Mapped[str] = mapped_column(String, nullable=False)
    last_sim_time: Mapped[float] = mapped_column(Float, nullable=False)  # BOPTEST seconds
    last_wall_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    boptest_step: Mapped[int] = mapped_column(Integer, nullable=False)   # step in seconds
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
