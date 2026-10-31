"""Voice utilities: interviewer/coach TTS and the audio cache."""

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse

from app.api.schemas import TTSReq
from app.pipeline import tts

router = APIRouter(prefix="/api", tags=["media"])


@router.post("/tts")
async def post_tts(req: TTSReq):
    if req.lang not in ("es", "en") or req.role not in ("interviewer", "coach") or len(req.text) > 1500:
        raise HTTPException(400, "parámetros inválidos")
    try:
        key = await run_in_threadpool(tts.synthesize, req.text, req.lang, req.role)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"TTS no disponible: {str(e)[:120]}") from None
    return {"audio_url": f"/api/audio/{key}.wav"}


@router.get("/audio/{key}.wav")
def get_audio(key: str):
    if not key.isalnum():
        raise HTTPException(400)
    path = tts.cache_path(key)
    if not path.exists():
        raise HTTPException(404)
    return FileResponse(path, media_type="audio/wav")
