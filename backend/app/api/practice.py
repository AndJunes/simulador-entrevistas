"""Per-question practice: sessions, turns and turn feedback."""

import threading

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.api.helpers import get_app, save_upload, sse, turn_dict
from app.api.schemas import FollowupFlag, NewSession, Rating
from app.db.models import Session, Turn
from app.db.session import db
from app.pipeline import stt
from app.services import context, events, turns

router = APIRouter(prefix="/api", tags=["practice"])


@router.post("/practice/sessions")
def new_practice_session(req: NewSession):
    with db() as s:
        get_app(s, req.application_id)
        sess = Session(application_id=req.application_id, mode="practice", lang=req.lang, settings=req.settings)
        s.add(sess)
        s.flush()
        return {"session_id": sess.id}


@router.post("/practice/turns")
async def new_turn(
    audio: UploadFile | None = File(None),
    session_id: str = Form(...),
    question_id: str = Form(...),
    lang: str = Form("es"),
    help_requested: bool = Form(False),
    attempt_of: str | None = Form(None),
    followup_of: str | None = Form(None),
    followup_text: str | None = Form(None),
    text: str | None = Form(None),
):
    """followup_of + followup_text: answer the practice follow-up suggested by the previous feedback.
    text: WRITTEN answer instead of audio (alternative to voice)."""
    if audio is None and not (text or "").strip():
        raise HTTPException(400, "falta el audio o el texto de la respuesta")
    if audio is not None and not stt.available():
        raise HTTPException(
            503,
            "La transcripción de voz no está disponible en esta instalación "
            "(requiere macOS con Apple Silicon). Respondé por escrito.",
        )
    if text is not None and len(text) > 8000:
        raise HTTPException(400, "la respuesta escrita supera 8000 caracteres")
    if lang not in ("es", "en"):
        raise HTTPException(400, "idioma inválido")
    try:
        q = context.in_lang(context.for_session(session_id).question(question_id), lang)
    except KeyError:
        raise HTTPException(404, "sesión o pregunta inexistente") from None
    if followup_of and not (followup_text or "").strip():
        raise HTTPException(400, "falta el texto de la repregunta")
    raw = await save_upload(audio) if audio is not None else None
    with db() as s:
        if not s.get(Session, session_id):
            raise HTTPException(404, "sesión inexistente")
        if followup_of and not s.get(Turn, followup_of):
            raise HTTPException(404, "turno anterior inexistente")
        t = Turn(
            session_id=session_id,
            question_id=f"{q['id']}-F" if followup_of else q["id"],
            question_text=followup_text.strip()[:500] if followup_of else q["text"],
            question_type=q["type"],
            lang=lang,
            attempt_of=attempt_of or None,
            is_followup=bool(followup_of),
            parent_turn_id=followup_of,
            input_mode="voice" if audio is not None else "written",
        )
        s.add(t)
        s.flush()
        tid = t.id
    events.open_channel(tid)
    threading.Thread(
        target=turns.run_practice_turn,
        args=(tid, raw, help_requested, None if audio is not None else text),
        daemon=True,
    ).start()
    return {"turn_id": tid}


@router.get("/turns/{tid}/events")
def turn_events(tid: str):
    return sse(tid)


@router.post("/turns/{tid}/cancel")
def cancel_turn(tid: str):
    return {"cancelled": events.cancel(tid)}


@router.post("/turns/{tid}/rating")
def rate_turn(tid: str, req: Rating):
    if req.rating not in (1, -1, None):
        raise HTTPException(400, "rating inválido")
    with db() as s:
        t = s.get(Turn, tid)
        if not t:
            raise HTTPException(404)
        t.feedback_rating = req.rating
    return {"ok": True}


@router.post("/turns/{tid}/followup-flag")
def flag_followup(tid: str, req: FollowupFlag):
    if req.flag not in ("redundant", "useful", None):
        raise HTTPException(400, "marca inválida")
    with db() as s:
        t = s.get(Turn, tid)
        if not t or not t.is_followup:
            raise HTTPException(404, "repregunta inexistente")
        t.followup_flag = req.flag
    return {"ok": True}


@router.get("/turns/{tid}")
def get_turn(tid: str):
    with db() as s:
        t = s.get(Turn, tid)
        if not t:
            raise HTTPException(404)
        return turn_dict(t)
