"""API del simulador. Corre nativa en macOS (Whisper/MLX usa la GPU Metal). Solo escucha en localhost."""
import asyncio
import json
import logging
import statistics
import threading
import uuid
from collections import defaultdict
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sse_starlette.sse import EventSourceResponse

from app.core.config import TMP, env
from app.db.models import Application, Session, Turn
from app.db.session import db
from app.pipeline import evaluator, metrics, stt, tts
from app.rag import store
from app import ingest
from app.generation import blueprint as bp
from app.generation.schema import FORMAT_LABELS, STAGES, normalize_question, public_view
from app.services import applications, context, events, exercise, mock, quality, turns

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("api")
STATUS = {"rag": "pending", "stt": "pending"}


def _bootstrap():
    try:
        STATUS["rag"] = store.ingest()
    except Exception as e:  # noqa: BLE001
        STATUS["rag"] = f"error: {e}"[:200]
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
app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in env("CORS_ORIGINS", "http://localhost:5173").split(",")],
                   allow_methods=["*"], allow_headers=["*"])


# ----------------------------------------------------------------------------- utilidades

async def _save_upload(f: UploadFile) -> str:
    ext = (f.filename or "a.webm").rsplit(".", 1)[-1][:5]
    path = TMP / f"up_{uuid.uuid4().hex}.{ext}"
    path.write_bytes(await f.read())
    return str(path)


def _sse(cid: str):
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


def _turn_dict(t: Turn) -> dict:
    return {"id": t.id, "session_id": t.session_id, "question_id": t.question_id, "question_text": t.question_text,
            "question_type": t.question_type, "lang": t.lang, "kind": t.kind, "is_followup": t.is_followup,
            "attempt_of": t.attempt_of, "status": t.status, "transcript": t.transcript, "metrics": t.metrics,
            "low_conf_words": t.low_conf_words, "evaluation": t.evaluation, "coaching": t.coaching,
            "audio_url": f"/api/audio/{t.tts_key}.wav" if t.tts_key else None, "cost_usd": t.cost_usd,
            "error": t.error, "created_at": t.created_at.isoformat(), "input_mode": t.input_mode,
            "parent_turn_id": t.parent_turn_id, "feedback_rating": t.feedback_rating, "followup_flag": t.followup_flag,
            "extra": t.extra or {}}


# ----------------------------------------------------------------------------- contexto

@app.get("/api/health")
def health():
    return {"ok": True, **STATUS}


# ----------------------------------------------------------------------------- postulaciones

def _app_summary(a: Application, counts: dict | None = None) -> dict:
    return {"id": a.id, "title": a.title, "company": a.company, "status": a.status, "error": a.error,
            "candidate_name": a.candidate_name, "interview": a.interview or {}, "questions": len(a.questions or []),
            "created_at": a.created_at.isoformat(), "updated_at": a.updated_at.isoformat(), "counts": counts or {}}


def _app_full(a: Application) -> dict:
    qs = [normalize_question(q, i) for i, q in enumerate(a.questions or [])]
    return {**_app_summary(a), "cv_md": a.cv_md, "job_md": a.job_md, "cv_source": a.cv_source, "job_source": a.job_source,
            "requirements": a.requirements or [], "questions": qs, "glossary": a.glossary or [],
            "analysis": a.analysis or {}, "evidence": a.evidence or [], "evidence_map": a.evidence_map or [],
            "blueprints": bp.sync(a.blueprints or [], qs), "company_facts": a.company_facts or [],
            "generation_report": a.generation_report or {}, "generator_version": a.generator_version or "v1"}


def _get_app(s, app_id: str) -> Application:
    a = s.get(Application, app_id)
    if not a:
        raise HTTPException(404, "postulación inexistente")
    return a


@app.post("/api/ingest")
async def ingest_doc(kind: str = Form(...), file: UploadFile | None = File(None), text: str | None = Form(None),
                     url: str | None = Form(None)):
    """Convierte un CV o un puesto (archivo, texto o link) a Markdown para revisarlo. No guarda nada."""
    data = await file.read() if file is not None else None
    try:
        return await run_in_threadpool(ingest.ingest, kind, data=data, filename=file.filename if file else None,
                                       text=text, url=url)
    except ingest.IngestError as e:
        raise HTTPException(422, str(e))
    except Exception as e:  # noqa: BLE001
        log.exception("ingest")
        raise HTTPException(502, f"No pudimos convertir el documento: {str(e)[:120]}")


class NewApplication(BaseModel):
    cv_md: str
    job_md: str
    cv_source: dict = {}
    job_source: dict = {}


@app.post("/api/applications")
def create_application(req: NewApplication):
    if len(req.cv_md.strip()) < 50 or len(req.job_md.strip()) < 50:
        raise HTTPException(422, "Falta el CV o el puesto (o quedaron casi vacíos).")
    with db() as s:
        a = Application(cv_md=req.cv_md, job_md=req.job_md, cv_source=req.cv_source, job_source=req.job_source,
                        title=applications.first_heading(req.job_md)[:200] or "Nueva postulación", status="generating")
        s.add(a)
        s.flush()
        app_id = a.id
    events.open_channel(f"app:{app_id}")
    threading.Thread(target=applications.generate, args=(app_id,), daemon=True).start()
    return {"id": app_id}


@app.get("/api/applications")
def list_applications():
    with db() as s:
        apps = s.execute(select(Application).order_by(Application.updated_at.desc())).scalars().all()
        counts = defaultdict(dict)
        rows = s.execute(select(Session.application_id, Session.mode, func.count(func.distinct(Session.id)), func.max(Session.created_at))
                         .join(Turn, Turn.session_id == Session.id).group_by(Session.application_id, Session.mode)).all()
        for aid, mode, n, last in rows:
            counts[aid][mode] = n
            prev = counts[aid].get("last")
            counts[aid]["last"] = max(prev, last.isoformat()) if prev else last.isoformat()
        return [_app_summary(a, counts.get(a.id)) for a in apps]


@app.get("/api/applications/{app_id}")
def get_application(app_id: str):
    with db() as s:
        return _app_full(_get_app(s, app_id))


class PatchApplication(BaseModel):
    title: str | None = None
    company: str | None = None
    candidate_name: str | None = None
    cv_md: str | None = None
    job_md: str | None = None
    cv_source: dict | None = None
    job_source: dict | None = None
    interview: dict | None = None
    questions: list[dict] | None = None
    requirements: list[dict] | None = None


@app.patch("/api/applications/{app_id}")
def patch_application(app_id: str, req: PatchApplication):
    with db() as s:
        a = _get_app(s, app_id)
        data = req.model_dump(exclude_none=True)
        if "questions" in data:
            data["questions"] = applications.clean_questions(data["questions"])
            if not data["questions"]:
                raise HTTPException(422, "La postulación necesita al menos una pregunta.")
            data["blueprints"] = bp.sync(a.blueprints or [], data["questions"])
        for k, v in data.items():
            setattr(a, k, v)
        s.flush()
        return _app_full(a)


@app.post("/api/applications/{app_id}/regenerate")
def regenerate_application(app_id: str):
    with db() as s:
        _get_app(s, app_id).status = "generating"
    events.open_channel(f"app:{app_id}")
    threading.Thread(target=applications.generate, args=(app_id,), daemon=True).start()
    return {"id": app_id}


@app.get("/api/applications/{app_id}/events")
def application_events(app_id: str):
    return _sse(f"app:{app_id}")


@app.delete("/api/applications/{app_id}")
def delete_application(app_id: str):
    with db() as s:
        s.delete(_get_app(s, app_id))   # borra en cascada sus sesiones y turnos
    return {"deleted": True}


@app.get("/api/applications/{app_id}/context")
def get_app_context(app_id: str, view: str = "coach"):
    """view=mock: SIN pistas, evidencia esperada ni política de repreguntas (se ocultan en el simulacro)."""
    try:
        ctx = context.for_app(app_id)
    except KeyError:
        raise HTTPException(404, "postulación inexistente")
    qs = ctx.questions() if view != "mock" else [public_view(q) for q in ctx.questions()]
    iv = ctx.interview_info()
    english = bool((ctx.analysis or {}).get("english_required")) or "ingl" in str(iv.get("language") or "").lower()
    return {"id": ctx.id, "candidate": ctx.candidate_first_name(), "interview": iv, "company": ctx.company,
            "title": ctx.title, "questions": qs, "view": view,
            "stages": [{k: b[k] for k in ("stage", "label", "minutes", "est_minutes", "question_ids", "english_check")}
                       for b in ctx.blueprints],
            "interview_stages": [b["stage"] for b in mock.stages_for(ctx)],
            "exercises": [q["id"] for q in exercise.exercises(ctx)],
            "english_required": english, "stage_labels": {k: v[0] for k, v in STAGES.items()},
            "format_labels": FORMAT_LABELS, "criteria_labels": evaluator.CRITERIA_LABELS, "status": STATUS}


class TTSReq(BaseModel):
    text: str
    lang: str = "es"
    role: str = "interviewer"


@app.post("/api/tts")
async def post_tts(req: TTSReq):
    if req.lang not in ("es", "en") or req.role not in ("interviewer", "coach") or len(req.text) > 1500:
        raise HTTPException(400, "parámetros inválidos")
    try:
        key = await run_in_threadpool(tts.synthesize, req.text, req.lang, req.role)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"TTS no disponible: {str(e)[:120]}")
    return {"audio_url": f"/api/audio/{key}.wav"}


@app.get("/api/audio/{key}.wav")
def get_audio(key: str):
    if not key.isalnum():
        raise HTTPException(400)
    path = tts.cache_path(key)
    if not path.exists():
        raise HTTPException(404)
    return FileResponse(path, media_type="audio/wav")


# ----------------------------------------------------------------------------- práctica por pregunta

class NewSession(BaseModel):
    application_id: str
    mode: str = "practice"
    lang: str = "es"
    settings: dict = {}
    stage: str = "recruiter_screen"


@app.post("/api/practice/sessions")
def new_practice_session(req: NewSession):
    with db() as s:
        _get_app(s, req.application_id)
        sess = Session(application_id=req.application_id, mode="practice", lang=req.lang, settings=req.settings)
        s.add(sess)
        s.flush()
        return {"session_id": sess.id}


@app.post("/api/practice/turns")
async def new_turn(audio: UploadFile | None = File(None), session_id: str = Form(...), question_id: str = Form(...),
                   lang: str = Form("es"), help_requested: bool = Form(False), attempt_of: str | None = Form(None),
                   followup_of: str | None = Form(None), followup_text: str | None = Form(None),
                   text: str | None = Form(None)):
    """followup_of + followup_text: responder la repregunta de práctica que sugirió la devolución anterior.
    text: respuesta ESCRITA en lugar de audio (alternativa a la voz)."""
    if audio is None and not (text or "").strip():
        raise HTTPException(400, "falta el audio o el texto de la respuesta")
    if text is not None and len(text) > 8000:
        raise HTTPException(400, "la respuesta escrita supera 8000 caracteres")
    if lang not in ("es", "en"):
        raise HTTPException(400, "idioma inválido")
    try:
        q = context.in_lang(context.for_session(session_id).question(question_id), lang)
    except KeyError:
        raise HTTPException(404, "sesión o pregunta inexistente")
    if followup_of and not (followup_text or "").strip():
        raise HTTPException(400, "falta el texto de la repregunta")
    raw = await _save_upload(audio) if audio is not None else None
    with db() as s:
        if not s.get(Session, session_id):
            raise HTTPException(404, "sesión inexistente")
        if followup_of and not s.get(Turn, followup_of):
            raise HTTPException(404, "turno anterior inexistente")
        t = Turn(session_id=session_id, question_id=f"{q['id']}-F" if followup_of else q["id"],
                 question_text=followup_text.strip()[:500] if followup_of else q["text"], question_type=q["type"],
                 lang=lang, attempt_of=attempt_of or None, is_followup=bool(followup_of), parent_turn_id=followup_of,
                 input_mode="voice" if audio is not None else "written")
        s.add(t)
        s.flush()
        tid = t.id
    events.open_channel(tid)
    threading.Thread(target=turns.run_practice_turn, args=(tid, raw, help_requested, None if audio is not None else text),
                     daemon=True).start()
    return {"turn_id": tid}


@app.get("/api/turns/{tid}/events")
def turn_events(tid: str):
    return _sse(tid)


@app.post("/api/turns/{tid}/cancel")
def cancel_turn(tid: str):
    return {"cancelled": events.cancel(tid)}


class Rating(BaseModel):
    rating: int | None = None     # 1 me sirvió · -1 no me sirvió · None borra


@app.post("/api/turns/{tid}/rating")
def rate_turn(tid: str, req: Rating):
    if req.rating not in (1, -1, None):
        raise HTTPException(400, "rating inválido")
    with db() as s:
        t = s.get(Turn, tid)
        if not t:
            raise HTTPException(404)
        t.feedback_rating = req.rating
    return {"ok": True}


class FollowupFlag(BaseModel):
    flag: str | None = None       # redundant | useful | None


@app.post("/api/turns/{tid}/followup-flag")
def flag_followup(tid: str, req: FollowupFlag):
    if req.flag not in ("redundant", "useful", None):
        raise HTTPException(400, "marca inválida")
    with db() as s:
        t = s.get(Turn, tid)
        if not t or not t.is_followup:
            raise HTTPException(404, "repregunta inexistente")
        t.followup_flag = req.flag
    return {"ok": True}


@app.get("/api/turns/{tid}")
def get_turn(tid: str):
    with db() as s:
        t = s.get(Turn, tid)
        if not t:
            raise HTTPException(404)
        return _turn_dict(t)


# ----------------------------------------------------------------------------- simulacro / videollamada

@app.post("/api/mock/sessions")
async def new_mock(req: NewSession):
    if req.mode not in ("mock", "videocall") or req.lang not in ("es", "en", "mix") or req.stage not in STAGES:
        raise HTTPException(400, "modo, idioma o etapa inválidos")
    try:
        return await run_in_threadpool(mock.start, req.application_id, req.mode, req.lang, req.stage, req.settings)
    except (KeyError, ValueError) as e:
        raise HTTPException(422, str(e))


@app.post("/api/mock/sessions/{sid}/answer")
async def mock_answer(sid: str, audio: UploadFile | None = File(None), text: str | None = Form(None)):
    if audio is None and not (text or "").strip():
        raise HTTPException(400, "falta el audio o el texto de la respuesta")
    raw = await _save_upload(audio) if audio is not None else None
    try:
        return await run_in_threadpool(mock.answer, sid, raw, None if audio is not None else (text or "")[:8000])
    except KeyError as e:
        raise HTTPException(409, str(e))


@app.post("/api/mock/sessions/{sid}/finish")
def mock_finish(sid: str):
    cid = f"report:{sid}"
    events.open_channel(cid)
    threading.Thread(target=mock.build_report, args=(sid,), daemon=True).start()
    return {"channel": cid}


@app.get("/api/mock/sessions/{sid}/report/events")
def mock_report_events(sid: str):
    return _sse(f"report:{sid}")


# ----------------------------------------------------------------------------- ejercicio (work sample)

class NewExercise(BaseModel):
    application_id: str
    lang: str = "es"


@app.post("/api/exercise/sessions")
def new_exercise_session(req: NewExercise):
    if req.lang not in ("es", "en"):
        raise HTTPException(400, "idioma inválido")
    with db() as s:
        _get_app(s, req.application_id)
    return exercise.start(req.application_id, req.lang)


class ClarifyReq(BaseModel):
    question_id: str
    question: str


@app.post("/api/exercise/sessions/{sid}/clarify")
async def exercise_clarify(sid: str, req: ClarifyReq):
    try:
        return await run_in_threadpool(exercise.clarify, sid, req.question_id, req.question)
    except KeyError:
        raise HTTPException(404, "sesión o ejercicio inexistente")
    except ValueError as e:
        raise HTTPException(422, str(e))


class SubmitReq(BaseModel):
    question_id: str
    text: str
    elapsed_s: float | None = None


@app.post("/api/exercise/sessions/{sid}/submit")
def exercise_submit(sid: str, req: SubmitReq):
    try:
        return {"turn_id": exercise.submit(sid, req.question_id, req.text, req.elapsed_s)}
    except KeyError:
        raise HTTPException(404, "sesión o ejercicio inexistente")
    except ValueError as e:
        raise HTTPException(422, str(e))


# ----------------------------------------------------------------------------- calidad del sistema

@app.get("/api/quality")
def get_quality(application_id: str | None = None):
    return quality.summary(application_id)


# ----------------------------------------------------------------------------- historial y progreso

@app.get("/api/sessions")
def list_sessions(application_id: str | None = None, mode: str | None = None):
    with db() as s:
        q = select(Session, func.count(Turn.id)).outerjoin(Turn).group_by(Session.id)
        if application_id:
            q = q.where(Session.application_id == application_id)
        if mode:
            q = q.where(Session.mode == mode)
        rows = s.execute(q.order_by(Session.created_at.desc()).limit(200)).all()
        return [{"id": se.id, "application_id": se.application_id, "mode": se.mode, "lang": se.lang, "status": se.status, "turns": n,
                 "created_at": se.created_at.isoformat(), "has_report": se.report is not None} for se, n in rows]


@app.get("/api/sessions/{sid}")
def get_session(sid: str):
    with db() as s:
        se = s.get(Session, sid)
        if not se:
            raise HTTPException(404)
        return {"id": se.id, "application_id": se.application_id, "mode": se.mode, "lang": se.lang, "status": se.status, "settings": se.settings,
                "report": se.report, "created_at": se.created_at.isoformat(),
                "turns": [_turn_dict(t) for t in se.turns]}


@app.get("/api/progress")
def progress(application_id: str | None = None):
    """Evolución por día: métricas de forma y promedio por criterio. Sin nota global."""
    with db() as s:
        q = select(Turn).join(Session, Session.id == Turn.session_id).where(Turn.kind == "evaluation", Turn.status == "done")
        if application_id:
            q = q.where(Session.application_id == application_id)
        rows = s.execute(q.order_by(Turn.created_at)).scalars().all()
        by_day = defaultdict(list)
        for t in rows:
            by_day[t.created_at.date().isoformat()].append(t)
    avg = lambda xs: round(statistics.mean(xs), 2) if xs else None
    out, comp_labels = [], {}
    for day, ts in sorted(by_day.items()):
        ms = [t.metrics for t in ts if t.metrics]
        crit, comp = defaultdict(list), defaultdict(list)
        for t in ts:
            ev = (t.evaluation or {}).get("evaluation") or {}
            if t.question_type in evaluator.NOT_SCORED_TYPES:
                continue
            for c in evaluator.scored_criteria(ev):
                crit[c["id"]].append(c["score"])
            c = ev.get("competency")
            if c and c.get("scored", True):
                comp[c["id"]].append((c["score"], c.get("evidence_level"), c.get("label", c["id"])))
                comp_labels[c["id"]] = c.get("label", c["id"])
        out.append({"day": day, "answers": len(ts),
                    "competencies": {k: {"avg": avg([x[0] for x in v]), "levels": [x[1] for x in v]} for k, v in comp.items()},
                    "first_word_latency_s": avg([m["first_word_latency_s"] for m in ms]),
                    "wpm": avg([m["wpm"] for m in ms]), "fillers_per_min": avg([m["fillers_per_min"] for m in ms]),
                    "in_range_pct": round(100 * sum(m["duration_status"] == "en rango" for m in ms) / len(ms)) if ms else None,
                    "criteria": {k: avg(v) for k, v in crit.items()}})
    return {"days": out, "labels": evaluator.CRITERIA_LABELS, "competency_labels": comp_labels}
