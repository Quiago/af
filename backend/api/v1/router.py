from fastapi import APIRouter
from api.v1.boptest.router import router as boptest_router
from api.v1.building.router import router as building_router
from api.v1.benchmark.router import router as benchmark_router
from api.v1.websocket.router import router as ws_router

# REST endpoints under /api/v1
_rest = APIRouter(prefix="/api/v1")
_rest.include_router(boptest_router)
_rest.include_router(building_router)
_rest.include_router(benchmark_router)

# Root router: combines REST (/api/v1/...) + WebSocket (/ws)
router = APIRouter()
router.include_router(_rest)
router.include_router(ws_router)
