"""Helpers shared by the routers: uploads, SSE streaming and serializers."""

import asyncio
import json
import uuid

from fastapi import HTTPException, UploadFile
from sse_starlette.sse import EventSourceResponse

from app.core.config import TMP
from app.db.models import Application, Turn
from app.generation import blueprint as bp
from app.generation.schema import normalize_question
from app.services import events


async def save_upload(f: UploadFile) -> str:
    ext = (f.filename or "a.webm").rsplit(".", 1)[-1][:5]
    path = TMP / f"up_{uuid.uuid4().hex}.{ext}"
    path.write_bytes(await f.read())
    return str(path)


def sse(cid: str):
    async def gen():
        idx = 0
        while True:
            new, finished = events.read_from(cid, idx)
            for e in new:
                yield {"event": "stage", "data": json.dumps(e, ensure_ascii=False)}
            idx += len(new)
            if finished and not new:
                return
            await asyncio.sleep(0.25)

    return EventSourceResponse(gen(), ping=10)


def turn_dict(t: Turn) -> dict:
    return {
        "id": t.id,
        "session_id": t.session_id,
        "question_id": t.question_id,
        "question_text": t.question_text,
        "question_type": t.question_type,
        "lang": t.lang,
        "kind": t.kind,
        "is_followup": t.is_followup,
        "attempt_of": t.attempt_of,
        "status": t.status,
        "transcript": t.transcript,
        "metrics": t.metrics,
        "low_conf_words": t.low_conf_words,
        "evaluation": t.evaluation,
        "coaching": t.coaching,
        "audio_url": f"/api/audio/{t.tts_key}.wav" if t.tts_key else None,
        "cost_usd": t.cost_usd,
        "error": t.error,
        "created_at": t.created_at.isoformat(),
        "input_mode": t.input_mode,
        "parent_turn_id": t.parent_turn_id,
        "feedback_rating": t.feedback_rating,
        "followup_flag": t.followup_flag,
        "extra": t.extra or {},
    }


def app_summary(a: Application, counts: dict | None = None) -> dict:
    return {
        "id": a.id,
        "title": a.title,
        "company": a.company,
        "status": a.status,
        "error": a.error,
        "candidate_name": a.candidate_name,
        "interview": a.interview or {},
        "questions": len(a.questions or []),
        "created_at": a.created_at.isoformat(),
        "updated_at": a.updated_at.isoformat(),
        "counts": counts or {},
    }


def app_full(a: Application) -> dict:
    qs = [normalize_question(q, i) for i, q in enumerate(a.questions or [])]
    return {
        **app_summary(a),
        "cv_md": a.cv_md,
        "job_md": a.job_md,
        "cv_source": a.cv_source,
        "job_source": a.job_source,
        "requirements": a.requirements or [],
        "questions": qs,
        "glossary": a.glossary or [],
        "analysis": a.analysis or {},
        "evidence": a.evidence or [],
        "evidence_map": a.evidence_map or [],
        "blueprints": bp.sync(a.blueprints or [], qs),
        "company_facts": a.company_facts or [],
        "generation_report": a.generation_report or {},
        "generator_version": a.generator_version or "v1",
    }


def get_app(s, app_id: str) -> Application:
    a = s.get(Application, app_id)
    if not a:
        raise HTTPException(404, "postulación inexistente")
    return a
