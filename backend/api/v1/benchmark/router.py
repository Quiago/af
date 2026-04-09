import asyncio
import logging

from fastapi import APIRouter, HTTPException, Request

from api.v1.benchmark.schemas import BenchmarkResult
from api.v1.benchmark.service import run_benchmark

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/benchmark", tags=["benchmark"])


@router.get("/latest", response_model=BenchmarkResult)
async def get_latest_benchmark(request: Request) -> BenchmarkResult:
    """Return the most recent benchmark result, or 404 if none has run yet."""
    result = getattr(request.app.state, "benchmark_result", None)
    if result is None:
        raise HTTPException(status_code=404, detail="No benchmark result available yet")
    return result


@router.post("/run", status_code=202)
async def trigger_benchmark(request: Request) -> dict:
    """Start a new benchmark run in the background.

    Idempotent: if a run is already in progress, returns the current status
    without starting a second run.
    """
    existing: BenchmarkResult | None = getattr(request.app.state, "benchmark_result", None)
    if existing is not None and existing.status in ("running_baseline", "running_optimized"):
        return {"status": "already_running", "progress_pct": existing.progress_pct}

    asyncio.create_task(run_benchmark(request.app))
    logger.info("[Benchmark] Manual trigger via POST /benchmark/run")
    return {"status": "started"}
