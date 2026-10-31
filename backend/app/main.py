"""Simulator API. Runs natively on macOS (Whisper/MLX uses the Metal GPU). Listens on localhost only.

Routes live in app/api, one router per domain; this module only assembles the app.
"""

import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import applications, exercise, media, mock, practice, quality
from app.core.config import env
from app.core.status import STATUS
from app.pipeline import stt
from app.rag import store

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("api")


def _bootstrap():
    try:
        STATUS["rag"] = store.ingest()
    except Exception as e:  # noqa: BLE001
        STATUS["rag"] = f"error: {e}"[:200]
    if not stt.available():
        # Text mode: the STT dependency group isn't installed (e.g. Linux).
        STATUS["stt"] = "unavailable"
        return
    try:
        stt.warmup()
        STATUS["stt"] = "ready"
    except Exception as e:  # noqa: BLE001
        STATUS["stt"] = f"error: {e}"[:200]


@asynccontextmanager
async def lifespan(_: FastAPI):
    threading.Thread(target=_bootstrap, daemon=True).start()
    yield


app = FastAPI(title="Simulador de Entrevistas", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in env("CORS_ORIGINS", "http://localhost:5173").split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)

for router_module in (applications, media, practice, mock, exercise, quality):
    app.include_router(router_module.router)
