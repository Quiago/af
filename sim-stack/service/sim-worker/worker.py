"""sim-worker — autonomous BOPTEST advance loop.

Connects to BOPTEST, runs the live simulation loop, and persists
measurements + KPIs to TimescaleDB. No backfill. No checkpoints
in the backend. The backend consumes data from TimescaleDB via sim-service.
"""
from __future__ import annotations

import asyncio
import logging

# Placeholder — full implementation in Fase 2
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger("sim-worker")


async def main() -> None:
    logger.info("sim-worker skeleton — full implementation coming in Fase 2")
    await asyncio.sleep(9999)


if __name__ == "__main__":
    asyncio.run(main())
