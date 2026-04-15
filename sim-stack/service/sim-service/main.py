"""sim-service — internal FastAPI that exposes sim-stack data to the backend.

Endpoints:
  GET  /health    → worker status + DB connectivity
  GET  /current   → latest BuildingSnapshot (from TimescaleDB)
  GET  /history   → HistoryPoint[] with time_bucket aggregation
  GET  /status    → sim-worker run state
  POST /control   → write control override + forward to BOPTEST

Full implementation in Fase 3.
"""
from __future__ import annotations

from fastapi import FastAPI

app = FastAPI(title="sim-service", version="0.1.0")


@app.get("/health")
async def health() -> dict:
    return {"status": "skeleton — full implementation coming in Fase 3"}
