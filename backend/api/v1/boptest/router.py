"""BOPTEST management + proxy endpoints.

Every BOPTEST API call is exposed here so the full server state can be
inspected or triggered directly from the Swagger docs or the backend.
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from api.v1.boptest import service
from api.v1.boptest.schemas import (
    AdvanceRequest,
    BOPTESTStatus,
    ForecastRequest,
    InitializeRequest,
    RestartResponse,
    ResultsRequest,
    ScenarioRequest,
    ScenarioResponse,
    StepRequest,
    StepResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/boptest", tags=["boptest"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _testid(request: Request) -> str:
    testid = getattr(request.app.state, "testid", None)
    if not testid:
        raise HTTPException(status_code=503, detail="BOPTEST not connected — POST /boptest/restart")
    return testid


def _boptest_error(exc: service.BOPTESTError) -> HTTPException:
    return HTTPException(status_code=502, detail=str(exc))


# ─── Lifecycle ────────────────────────────────────────────────────────────────

@router.get("/status", response_model=BOPTESTStatus)
async def get_status(request: Request) -> BOPTESTStatus:
    snapshot = getattr(request.app.state, "current_snapshot", None)
    return BOPTESTStatus(
        testid=getattr(request.app.state, "testid", None),
        current_time=snapshot.simulation_time if snapshot else None,
        test_case=request.app.state.settings.boptest_test_case,
        scenario=request.app.state.settings.benchmark_scenario,
        is_running=getattr(request.app.state, "testid", None) is not None,
    )


@router.post("/restart", response_model=RestartResponse)
async def restart(request: Request) -> RestartResponse:
    from api.v1.building.service import build_snapshot
    try:
        testid = await service.setup_boptest()
        outputs, forecast, kpis = await service.advance_and_collect(testid)
        request.app.state.testid = testid
        request.app.state.current_snapshot = build_snapshot(outputs, forecast, kpis)
        return RestartResponse(success=True, testid=testid, message="Restarted OK")
    except service.BOPTESTError as exc:
        logger.error("Restart failed: %s", exc)
        raise _boptest_error(exc) from exc


@router.put("/stop")
async def stop(request: Request) -> dict[str, str]:
    testid = _testid(request)
    try:
        await service.stop_test_case(testid)
        request.app.state.testid = None
        return {"message": f"Test case {testid} stopped."}
    except service.BOPTESTError as exc:
        raise _boptest_error(exc) from exc


# ─── Test case information ────────────────────────────────────────────────────

@router.get("/version")
async def get_version(request: Request) -> dict[str, str]:
    testid = _testid(request)
    try:
        return {"version": await service.get_version(testid)}
    except service.BOPTESTError as exc:
        raise _boptest_error(exc) from exc


@router.get("/name")
async def get_name(request: Request) -> dict[str, str]:
    testid = _testid(request)
    try:
        return {"name": await service.get_name(testid)}
    except service.BOPTESTError as exc:
        raise _boptest_error(exc) from exc


@router.get("/measurements")
async def get_measurements(request: Request) -> dict[str, Any]:
    testid = _testid(request)
    try:
        return await service.get_measurements(testid)
    except service.BOPTESTError as exc:
        raise _boptest_error(exc) from exc


@router.get("/inputs")
async def get_inputs(request: Request) -> dict[str, Any]:
    testid = _testid(request)
    try:
        return await service.get_inputs(testid)
    except service.BOPTESTError as exc:
        raise _boptest_error(exc) from exc


@router.get("/forecast_points")
async def get_forecast_points(request: Request) -> dict[str, Any]:
    testid = _testid(request)
    try:
        return await service.get_forecast_points(testid)
    except service.BOPTESTError as exc:
        raise _boptest_error(exc) from exc


# ─── Simulation control ───────────────────────────────────────────────────────

@router.get("/step", response_model=StepResponse)
async def get_step(request: Request) -> StepResponse:
    testid = _testid(request)
    try:
        return StepResponse(step=await service.get_step(testid))
    except service.BOPTESTError as exc:
        raise _boptest_error(exc) from exc


@router.put("/step", response_model=StepResponse)
async def set_step(body: StepRequest, request: Request) -> StepResponse:
    testid = _testid(request)
    try:
        return StepResponse(step=await service.set_step(testid, body.step))
    except service.BOPTESTError as exc:
        raise _boptest_error(exc) from exc


@router.put("/initialize")
async def initialize(body: InitializeRequest, request: Request) -> dict[str, Any]:
    testid = _testid(request)
    try:
        return await service.initialize(testid, int(body.start_time), int(body.warmup_period))
    except service.BOPTESTError as exc:
        raise _boptest_error(exc) from exc


@router.get("/scenario", response_model=ScenarioResponse)
async def get_scenario(request: Request) -> ScenarioResponse:
    testid = _testid(request)
    try:
        data = await service.get_scenario(testid)
        return ScenarioResponse(
            electricity_price=data.get("electricity_price"),
            time_period=data.get("time_period"),
        )
    except service.BOPTESTError as exc:
        raise _boptest_error(exc) from exc


@router.put("/scenario", response_model=ScenarioResponse)
async def set_scenario(body: ScenarioRequest, request: Request) -> ScenarioResponse:
    testid = _testid(request)
    try:
        data = await service.set_scenario(
            testid,
            body.time_period or request.app.state.settings.benchmark_scenario,
            body.electricity_price or request.app.state.settings.benchmark_price,
        )
        return ScenarioResponse(
            electricity_price=data.get("electricity_price"),
            time_period=data.get("time_period"),
        )
    except service.BOPTESTError as exc:
        raise _boptest_error(exc) from exc


# ─── Data ─────────────────────────────────────────────────────────────────────

@router.post("/advance")
async def advance(body: AdvanceRequest, request: Request) -> dict[str, Any]:
    """Manually advance one simulation step. The polling loop also calls this automatically."""
    testid = _testid(request)
    try:
        return await service.advance(testid, body.inputs)
    except service.BOPTESTError as exc:
        raise _boptest_error(exc) from exc


@router.put("/forecast")
async def get_forecast(body: ForecastRequest, request: Request) -> dict[str, Any]:
    testid = _testid(request)
    try:
        return await service.get_forecast(
            testid,
            point_names=body.point_names,
            horizon=int(body.horizon),
            interval=int(body.interval),
        )
    except service.BOPTESTError as exc:
        raise _boptest_error(exc) from exc


@router.put("/results")
async def get_results(body: ResultsRequest, request: Request) -> dict[str, Any]:
    testid = _testid(request)
    try:
        return await service.get_results(
            testid,
            point_names=body.point_names,
            start_time=body.start_time,
            final_time=body.final_time,
        )
    except service.BOPTESTError as exc:
        raise _boptest_error(exc) from exc


@router.get("/kpi")
async def get_kpis(request: Request) -> dict[str, Any]:
    testid = _testid(request)
    try:
        return await service.get_kpis(testid)
    except service.BOPTESTError as exc:
        raise _boptest_error(exc) from exc
