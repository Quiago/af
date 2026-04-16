"""sim-worker — autonomous BOPTEST advance loop.

Responsibilities:
  1. Connect to BOPTEST and obtain a testid (new or resumed from checkpoint)
  2. Initialize simulation from checkpoint sim_time (or 0 on first run)
  3. Run a continuous live loop: advance → persist measurements + KPIs → checkpoint
  4. Auto-recover if testid expires

No backfill. No wall-clock mapping. The worker generates data from the moment
it starts; the backend consumes what's in TimescaleDB via sim-service.

Architecture:
  BOPTEST (web:80)
       ↑ advance / kpis / forecast
  sim-worker (this file)
       ↓ INSERT measurements, kpi_snapshots, simulation_runs
  TimescaleDB
"""
from __future__ import annotations

import asyncio
import logging
import sys
from datetime import datetime, timezone

import boptest_client as boptest
from boptest_client import BOPTESTError
import db
from config import settings

# ─── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("sim-worker")


# ─── Startup: obtain testid ───────────────────────────────────────────────────

async def _connect_boptest() -> str:
    """Obtain a valid testid, retrying until BOPTEST is reachable.

    Priority:
    1. Resume testid from DB checkpoint (if still valid on server)
    2. Deploy a fresh test case and immediately persist it

    The testid is saved to simulation_runs right after deploy so that
    a restart before the first tick can still resume the same instance.
    """
    while True:
        try:
            # Check for existing checkpoint
            checkpoint = await db.get_checkpoint()
            if checkpoint:
                cp_testid, cp_sim_time, cp_wall_time = checkpoint
                logger.info(
                    "Checkpoint found: testid=%s  sim_time=%.0f s  wall=%s",
                    cp_testid, cp_sim_time,
                    cp_wall_time.isoformat(timespec="seconds"),
                )
                if await boptest.validate_testid(cp_testid):
                    logger.info("Checkpoint testid valid — resuming.")
                    return cp_testid
                logger.warning("Checkpoint testid=%s expired on server — deploying fresh.", cp_testid)

            # Deploy fresh and immediately persist testid so any restart
            # before the first advance tick can still resume this instance.
            testid = await boptest.deploy_fresh(settings.boptest_test_case)
            await db.upsert_checkpoint(testid, 0.0, datetime.now(timezone.utc))
            logger.info("Testid %s persisted to DB.", testid)
            return testid

        except BOPTESTError as exc:
            logger.warning("BOPTEST not ready (%s) — retrying in 15 s", exc)
            await asyncio.sleep(15)
        except Exception as exc:
            logger.exception("Unexpected error during connect: %s — retrying in 15 s", exc)
            await asyncio.sleep(15)


# ─── Startup: initialize simulation ──────────────────────────────────────────

async def _initialize_simulation(testid: str) -> float:
    """Initialize BOPTEST and return the starting sim_time.

    If a checkpoint exists for this testid, skip initialize (BOPTEST is already
    at or past that sim_time). Otherwise start from 0.
    """
    checkpoint = await db.get_checkpoint()
    if checkpoint:
        cp_testid, cp_sim_time, _ = checkpoint
        if cp_testid == testid:
            logger.info(
                "Reusing checkpoint testid — skipping initialize "
                "(BOPTEST already at sim_time≥%.0f s)", cp_sim_time
            )
            return cp_sim_time

    logger.info("Initializing BOPTEST from start_time=0, warmup=0")
    try:
        await boptest.initialize(testid, start_time=0, warmup_period=0)
    except BOPTESTError as exc:
        logger.warning("initialize() failed (%s) — proceeding with current state", exc)

    return 0.0


# ─── Live loop ────────────────────────────────────────────────────────────────

async def _live_loop(testid: str, start_sim_time: float) -> None:
    """Continuous advance loop. Runs indefinitely.

    On each tick:
      - advance BOPTEST one step
      - persist full outputs to measurements
      - persist KPIs to kpi_snapshots
      - upsert checkpoint in simulation_runs
    """
    logger.info(
        "Entering live loop — step=%d s  tick=%.0f s  start_sim_time=%.0f s",
        settings.boptest_step,
        settings.live_tick_seconds,
        start_sim_time,
    )

    # Set live step size
    try:
        await boptest.set_step(testid, settings.boptest_step)
        logger.info("Step set to %d s", settings.boptest_step)
    except BOPTESTError as exc:
        logger.warning("set_step failed (%s) — using server default", exc)

    sim_secs = start_sim_time
    tick_count = 0

    while True:
        await asyncio.sleep(settings.live_tick_seconds)

        try:
            outputs, _forecast, kpis = await boptest.advance_and_collect(testid)
        except BOPTESTError as exc:
            logger.error("Live advance error: %s", exc)

            # Check if testid expired — if so, recover
            if not await boptest.validate_testid(testid):
                logger.warning("testid=%s expired — recovering …", testid)
                try:
                    testid = await _recover_testid(sim_secs)
                except BOPTESTError as inner:
                    logger.error("Recovery failed: %s — will retry next tick", inner)
            continue
        except Exception as exc:
            logger.exception("Unexpected live error: %s", exc)
            continue

        sim_secs = float(outputs.get("time", sim_secs))
        wall_time = datetime.now(timezone.utc)
        tick_count += 1

        # Persist
        try:
            await db.write_measurement(testid, sim_secs, wall_time, outputs)
            await db.write_kpis(testid, sim_secs, wall_time, kpis)
            await db.upsert_checkpoint(testid, sim_secs, wall_time)
        except Exception as exc:
            logger.error("DB write failed: %s", exc)
            # Non-fatal: continue advancing; next tick will write fresh data

        logger.info(
            "Tick #%d  sim_time=%.1f h  wall=%s  energy=%.3f  tdis=%.4f",
            tick_count,
            sim_secs / 3600,
            wall_time.strftime("%H:%M:%S"),
            _safe_float(kpis.get("ener_tot")),
            _safe_float(kpis.get("tdis_tot")),
        )


async def _recover_testid(last_sim_secs: float) -> str:
    """Deploy a new testid and re-initialize from last known sim_time."""
    testid = await boptest.deploy_fresh(settings.boptest_test_case)
    try:
        await boptest.initialize(testid, start_time=int(last_sim_secs), warmup_period=0)
    except BOPTESTError as exc:
        logger.warning("Re-initialize after recovery failed: %s", exc)
    # Persist immediately so a restart before next tick resumes this instance.
    await db.upsert_checkpoint(testid, last_sim_secs, datetime.now(timezone.utc))
    logger.info("Recovery complete: new testid=%s  sim_time=%.0f s", testid, last_sim_secs)
    return testid


# ─── Entry point ─────────────────────────────────────────────────────────────

async def main() -> None:
    logger.info(
        "sim-worker starting  |  BOPTEST=%s  testcase=%s  step=%ds  tick=%.0fs",
        settings.boptest_url,
        settings.boptest_test_case,
        settings.boptest_step,
        settings.live_tick_seconds,
    )

    # Initialize DB pool
    try:
        await db.init_pool()
    except Exception as exc:
        logger.exception("Cannot connect to TimescaleDB: %s", exc)
        sys.exit(1)

    try:
        # Connect to BOPTEST
        testid = await _connect_boptest()

        # Initialize simulation position
        start_sim_time = await _initialize_simulation(testid)

        # Run live loop (never returns unless exception)
        await _live_loop(testid, start_sim_time)

    except asyncio.CancelledError:
        logger.info("Worker cancelled — shutting down")
    except Exception as exc:
        logger.exception("Worker crashed: %s", exc)
        sys.exit(1)
    finally:
        await boptest.close_client()
        await db.close_pool()
        logger.info("sim-worker stopped")


def _safe_float(v: object) -> float:
    try:
        f = float(v)  # type: ignore[arg-type]
        return 0.0 if (f != f or abs(f) == float("inf")) else f
    except (TypeError, ValueError):
        return 0.0


if __name__ == "__main__":
    asyncio.run(main())
