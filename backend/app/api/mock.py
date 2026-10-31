"""Mock interview and video-call mode."""

import threading

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from app.api.helpers import save_upload, sse
from app.api.schemas import NewSession
from app.generation.schema import STAGES
from app.pipeline import stt
from app.services import events, mock

router = APIRouter(prefix="/api", tags=["mock"])


@router.post("/mock/sessions")
async def new_mock(req: NewSession):
    if req.mode not in ("mock", "videocall") or req.lang not in ("es", "en", "mix") or req.stage not in STAGES:
        raise HTTPException(400, "modo, idioma o etapa inválidos")
    try:
        return await run_in_threadpool(mock.start, req.application_id, req.mode, req.lang, req.stage, req.settings)
    except (KeyError, ValueError) as e:
        raise HTTPException(422, str(e)) from None


@router.post("/mock/sessions/{sid}/answer")
async def mock_answer(sid: str, audio: UploadFile | None = File(None), text: str | None = Form(None)):
    if audio is None and not (text or "").strip():
        raise HTTPException(400, "falta el audio o el texto de la respuesta")
    if audio is not None and not stt.available():
        raise HTTPException(
            503,
            "La transcripción de voz no está disponible en esta instalación "
            "(requiere macOS con Apple Silicon). Respondé por escrito.",
        )
    raw = await save_upload(audio) if audio is not None else None
    try:
        return await run_in_threadpool(mock.answer, sid, raw, None if audio is not None else (text or "")[:8000])
    except KeyError as e:
        raise HTTPException(409, str(e)) from None


@router.post("/mock/sessions/{sid}/finish")
def mock_finish(sid: str):
    cid = f"report:{sid}"
    events.open_channel(cid)
    threading.Thread(target=mock.build_report, args=(sid,), daemon=True).start()
    return {"channel": cid}


@router.get("/mock/sessions/{sid}/report/events")
def mock_report_events(sid: str):
    return sse(f"report:{sid}")
