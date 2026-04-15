"""WebSocket endpoint — /ws.

When USE_SIM_SERVICE=true:
  - On connect: fetch initial snapshot from sim-service /current
  - Background broadcast task polls sim-service every live_tick_seconds
    and broadcasts to all connected clients

When USE_SIM_SERVICE=false (legacy):
  - On connect: send app.state.current_snapshot if available
  - Broadcast is driven by main.py _polling_loop calling ws_manager.broadcast()
"""
from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from api.v1.websocket.manager import ws_manager
from core.config import logger, settings

router = APIRouter()

# Background broadcast task handle (sim-service mode only)
_broadcast_task: asyncio.Task | None = None


async def _start_broadcast_loop() -> None:
    """Start background task that polls sim-service and broadcasts snapshots."""
    global _broadcast_task
    if _broadcast_task is not None and not _broadcast_task.done():
        return
    _broadcast_task = asyncio.create_task(_broadcast_loop())
    logger.info("WS broadcast loop started (sim-service mode)")


async def _broadcast_loop() -> None:
    """Poll sim-service /current and broadcast to WS clients on each tick."""
    from core.sim_client import SimServiceError, get_current

    while True:
        await asyncio.sleep(settings.live_tick_seconds)

        if not ws_manager.active_connections:
            continue

        try:
            data = await get_current()
            await ws_manager.broadcast(data)
        except SimServiceError as exc:
            logger.warning("WS broadcast: sim-service unavailable — %s", exc)
        except Exception as exc:
            logger.exception("WS broadcast error: %s", exc)


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await ws_manager.connect(websocket)

    # Ensure broadcast loop is running (sim-service mode)
    if settings.use_sim_service:
        await _start_broadcast_loop()

    try:
        # Send current snapshot immediately on connect
        if settings.use_sim_service:
            from core.sim_client import SimServiceError, get_current
            try:
                data = await get_current()
                await ws_manager.send_to(websocket, data)
            except SimServiceError as exc:
                logger.warning("WS initial snapshot unavailable: %s", exc)
        else:
            snapshot = getattr(websocket.app.state, "current_snapshot", None)
            if snapshot is not None:
                await ws_manager.send_to(websocket, snapshot.model_dump())

        # Keep connection alive — backend pushes via broadcast()
        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as exc:
        logger.warning("WS error: %s", exc)
        ws_manager.disconnect(websocket)
