"""FastAPI application entry point — continuous digital-twin historian."""
from __future__ import annotations

import asyncio
import logging
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
from core.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


# ─── Historian loop ────────────────────────────────────────────────────────────

async def _polling_loop(app: FastAPI) -> None:
    try:
        await _polling_loop_inner(app)
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        logger.exception("_polling_loop crashed — historian stopped: %s", exc)
        raise


async def _polling_loop_inner(app: FastAPI) -> None:  # noqa: C901
    # Wait for BOPTEST to be ready — auto-reconnect if startup failed
    while not getattr(app.state, "testid", None):
        await asyncio.sleep(15)
        try:
            testid = await setup_boptest()
            app.state.testid = testid
            logger.info("BOPTEST connected (polling loop reconnect). testid=%s", testid)
        except BOPTESTError as exc:
            logger.warning("Polling loop reconnect failed: %s — retry in 15s", exc)
    testid: str = app.state.testid

    # ── Read last checkpoint (determines bootstrap vs resume) ─────────────────
    checkpoint = await get_last_checkpoint()

    checkpoint_testid: str | None = None

    if checkpoint is None:
        # ── First boot: bootstrap from scratch ───────────────────────────────
        days = settings.effective_backfill_days
        now_utc = datetime.now(timezone.utc)
        wall_anchor = now_utc - timedelta(days=days)
        target_sim_secs: float = days * 86_400
        start_sim_time: int = 0

        logger.info(
            "No checkpoint found — bootstrapping %d day(s) from %s",
            days,
            wall_anchor.isoformat(timespec="seconds"),
        )
    else:
        # ── Resume: reinitialize from last known sim_time ─────────────────────
        last_sim_time, last_wall_time, checkpoint_testid = checkpoint
        start_sim_time = int(last_sim_time)
        now_utc = datetime.now(timezone.utc)
        wall_anchor = last_wall_time - timedelta(seconds=last_sim_time)
        target_sim_secs = (now_utc - wall_anchor).total_seconds()

        gap_secs = (now_utc - last_wall_time).total_seconds()
        logger.info(
            "Checkpoint found — last sim_time=%.0f s, last_wall=%s, gap=%.1f s (%.2f h)",
            last_sim_time,
            last_wall_time.isoformat(timespec="seconds"),
            gap_secs,
            gap_secs / 3600,
        )

    # ── Initialize BOPTEST only when necessary ────────────────────────────────
    # Reusing the same testid means BOPTEST is already at or past start_sim_time —
    # calling initialize() would reset it backward and lose progress.
    if testid != checkpoint_testid:
        logger.info("Initializing BOPTEST: start_time=%d s, warmup=0", start_sim_time)
        try:
            await initialize(testid, start_time=start_sim_time, warmup_period=0)
        except BOPTESTError as exc:
            logger.warning("initialize failed (%s) — proceeding with current state", exc)
    else:
        logger.info(
            "Reusing checkpoint testid — skipping initialize (BOPTEST already at sim_time≥%d s)",
            start_sim_time,
        )

    # Use coarse step during backfill for maximum speed
    try:
        await set_step(testid, settings.backfill_step_seconds)
        logger.info("Backfill step set to %d s", settings.backfill_step_seconds)
    except BOPTESTError as exc:
        logger.warning("set_step(backfill) failed (%s) — using server default", exc)

    # ── Catch-up loop (fast advance, no forecast/kpis) ────────────────────────
    BATCH = settings.backfill_batch_size
    batch: list[tuple[datetime, dict]] = []
    step_count = 0
    sim_secs: float = float(start_sim_time)

    logger.info(
        "Catch-up start — from sim_time=%.0f to %.0f s (%.2f h to cover)",
        sim_secs,
        target_sim_secs,
        (target_sim_secs - sim_secs) / 3600,
    )

    while sim_secs < target_sim_secs:
        try:
            outputs = await advance_only(testid)
        except BOPTESTError as exc:
            logger.warning("Catch-up advance failed: %s — retry in 5 s", exc)
            await asyncio.sleep(5)
            continue

        sim_secs = float(outputs.get("time", sim_secs))
        wall_ts  = wall_anchor + timedelta(seconds=sim_secs)
        batch.append((wall_ts, outputs))
        step_count += 1

        # Keep bms_raw_outputs current so /bms/snapshot always has data
        app.state.bms_raw_outputs = outputs

        # Publish first snapshot so /snapshot stops returning 503 immediately
        if step_count == 1:
            app.state.current_snapshot = build_snapshot(outputs, {}, {})

        if step_count % 50 == 0:
            pct = 100.0 * (sim_secs - start_sim_time) / max(1, target_sim_secs - start_sim_time)
            logger.info(
                "Backfill: step=%d  sim=%.1f days / %.0f days  (%.1f%%)",
                step_count,
                sim_secs / 86_400,
                target_sim_secs / 86_400,
                pct,
            )

        if len(batch) >= BATCH:
            await save_measurements_bulk(batch)
            await save_checkpoint(sim_secs, wall_ts, testid)
            batch.clear()

    # Flush remainder
    if batch:
        last_wall = wall_anchor + timedelta(seconds=sim_secs)
        await save_measurements_bulk(batch)
        await save_checkpoint(sim_secs, last_wall, testid)
        batch.clear()

    logger.info(
        "Catch-up complete: %d steps, sim_time=%.2f days",
        step_count,
        sim_secs / 86_400,
    )

    # Switch to fine-grained step for live data
    try:
        await set_step(testid, settings.boptest_step)
        logger.info(
            "Switched step %d s → %d s for live loop",
            settings.backfill_step_seconds,
            settings.boptest_step,
        )
    except BOPTESTError as exc:
        logger.warning("set_step(live) failed (%s) — keeping current step", exc)

    # ── Transition: one full advance (with forecast + kpis) ──────────────────
    try:
        outputs, forecast, kpis = await advance_and_collect(testid)
        sim_secs = float(outputs.get("time", sim_secs))
        wall_ts  = wall_anchor + timedelta(seconds=sim_secs)
        snapshot = build_snapshot(outputs, forecast, kpis)
        app.state.current_snapshot = snapshot
        await ws_manager.broadcast(snapshot.model_dump())
        await save_measurements_bulk([(wall_ts, outputs)])
        await save_checkpoint(sim_secs, wall_ts, testid)
    except BOPTESTError as exc:
        logger.error("Transition advance failed: %s", exc)

    # ── Live loop ─────────────────────────────────────────────────────────────
    logger.info("Entering live loop (%.0f s interval)", settings.live_tick_seconds)
    while True:
        await asyncio.sleep(settings.live_tick_seconds)

        testid = getattr(app.state, "testid", None)
        if not testid:
            continue

        try:
            outputs, forecast, kpis = await advance_and_collect(testid)
        except BOPTESTError as exc:
            logger.error("Live advance error: %s", exc)
            if not await validate_testid(testid):
                logger.warning("testid expired — recovering with checkpoint …")
                try:
                    cp = await get_last_checkpoint()
                    resume_from = int(cp[0]) if cp else 0
                    testid = await _fresh_testid()
                    await initialize(testid, start_time=resume_from, warmup_period=0)
                    app.state.testid = testid
                    logger.info(
                        "Recovered: new testid=%s  resumed from sim_time=%d s",
                        testid, resume_from,
                    )
                except BOPTESTError as inner:
                    logger.error("Recovery failed: %s", inner)
            continue
        except Exception as exc:
            logger.exception("Unexpected live error: %s", exc)
            continue

        sim_secs = float(outputs.get("time", sim_secs))
        wall_ts  = wall_anchor + timedelta(seconds=sim_secs)
        await save_measurements_bulk([(wall_ts, outputs)])
        await save_checkpoint(sim_secs, wall_ts, testid)
        snapshot = build_snapshot(outputs, forecast, kpis)
        app.state.bms_raw_outputs  = outputs
        app.state.current_snapshot = snapshot
        await ws_manager.broadcast(snapshot.model_dump())


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
        testid = await setup_boptest()
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

    task = asyncio.create_task(_polling_loop(app))

    yield  # ── app is running ──

    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
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
