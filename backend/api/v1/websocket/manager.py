"""WebSocket connection manager."""
from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import WebSocket
from core.config import logger

class WebSocketManager:
    def __init__(self) -> None:
        self.active_connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info("WS client connected. Total: %d", len(self.active_connections))

    def disconnect(self, websocket: WebSocket) -> None:
        self.active_connections.discard(websocket)
        logger.info("WS client disconnected. Total: %d", len(self.active_connections))

    async def broadcast(self, data: dict[str, Any]) -> None:
        if not self.active_connections:
            logger.debug("WS broadcast skipped — no active connections")
            return
        message = json.dumps(data)
        ts = data.get("timestamp", "?")
        logger.info(
            "WS broadcast — timestamp=%s clients=%d",
            ts,
            len(self.active_connections),
        )
        disconnected: set[WebSocket] = set()
        for ws in list(self.active_connections):
            try:
                await ws.send_text(message)
            except Exception as exc:
                logger.warning("WS send failed: %s — marking for disconnect", exc)
                disconnected.add(ws)
        for ws in disconnected:
            self.disconnect(ws)

    async def send_to(self, websocket: WebSocket, data: dict[str, Any]) -> None:
        try:
            await websocket.send_text(json.dumps(data))
        except Exception as exc:
            logger.warning("Failed to send to WS client: %s", exc)
            self.disconnect(websocket)


ws_manager = WebSocketManager()
