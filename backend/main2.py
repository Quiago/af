"""FastAPI application entry point — continuous digital-twin historian."""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.v1.router import router
from api.v1.websocket.manager import ws_manager
from api.v1.boptest.service import (
    advance_and_collect,
    advance_only,
    BOPTESTError,
    close_client,
    _fresh_testid,
    get_last_checkpoint,
    initialize,
    save_checkpoint,
    save_measurements_bulk,
    set_step,
    setup_boptest,
    validate_testid,
)
from api.v1.building.service import build_snapshot
from core.config import settings, logger


# ─── Historian loop ────────────────────────────────────────────────────────────



#logger.info("Initializing BOPTEST: start_time=%d s, warmup=0", start_sim_time)
#try:
#    initialize(testid, start_time=start_sim_time, warmup_period=0)
#except BOPTESTError as exc:
#    logger.warning("initialize failed (%s) — proceeding with current state", exc)



# ─── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # ── Database ───────────────────────────────────────────────────────────────
    from db.engine import engine as db_engine
    from db.base import Base
    import api.v1.boptest.models  # noqa: F401 — registers ORM models with Base

    async with db_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables ready.")

    # ── App state ──────────────────────────────────────────────────────────────
    app.state.settings         = settings
    app.state.testid           = None
    app.state.current_snapshot = None
    app.state.bms_raw_outputs  = None   # latest advance() outputs for BMS endpoint
    app.state.benchmark_result = None

    # ── BOPTEST ────────────────────────────────────────────────────────────────
    try:
        logger.info("Before testid from checkpoint")
        testid = await setup_boptest()
        logger.info("After testid from checkpoint")
        app.state.testid = testid
        logger.info("BOPTEST ready. testid=%s", testid)
    except BOPTESTError as exc:
        logger.warning(
            "BOPTEST unavailable at startup (%s). "
            "POST /api/v1/boptest/restart once reachable.",
            exc,
        )
    except Exception as exc:
        logger.warning("Startup BOPTEST init failed: %s", exc)

    yield

    await close_client()
    logger.info("Shutdown complete.")


# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(title="Building OS API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
async def health() -> dict:
    cp = await get_last_checkpoint()
    return {
        "status": "ok",
        "boptest_ready": app.state.testid is not None,
        "last_sim_time":  cp[0] if cp else None,
        "last_wall_time": cp[1].isoformat() if cp else None,
    }
