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
from core.config import settings, logger

from dotenv import set_key

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

    # ── sim-service + TimescaleDB (when USE_SIM_SERVICE=true) ─────────────────
    if settings.use_sim_service:
        from core.sim_client import init_client as _init_sim
        from db.timescale import init_pool as _init_ts, close_pool as _close_ts
        _init_sim()
        await _init_ts()
        logger.info("sim-service mode active: %s", settings.sim_service_url)
    else:
        # Legacy mode: connect to BOPTEST directly
        from api.v1.boptest.service import BOPTESTError, close_client, setup_boptest
        try:
            testid = await setup_boptest()
            app.state.testid = testid
            set_key(".env", "BOPTEST_TEST_ID", testid)
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

    if settings.use_sim_service:
        from core.sim_client import close_client as _close_sim
        from db.timescale import close_pool as _close_ts
        await _close_sim()
        await _close_ts()
    else:
        from api.v1.boptest.service import close_client
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


@app.get("/")
async def health() -> dict:
    return {
        "status": "ok",
        "boptest_ready": app.state.testid is not None,
    }
