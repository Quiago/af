"""WebSocket endpoint — /ws."""
from __future__ import annotations

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from api.v1.websocket.manager import ws_manager
from core.config import logger

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await ws_manager.connect(websocket)
    try:
        # Send current snapshot immediately on connect (if available)
        snapshot = getattr(websocket.app.state, "current_snapshot", None)
        if snapshot is not None:
            await ws_manager.send_to(websocket, snapshot.model_dump())

        # Keep connection alive — backend pushes via broadcast()
        while True:
            # Drain any client messages (we don't act on them; this keeps the loop alive)
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as exc:
        logger.warning("WS error: %s", exc)
        ws_manager.disconnect(websocket)
