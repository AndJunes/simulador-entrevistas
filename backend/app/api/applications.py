"""Applications: document ingestion, CRUD, generation and the per-application context."""

import logging
from collections import defaultdict

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import func, select

from app import ingest
from app.api.helpers import app_full, app_summary, get_app, sse
from app.api.schemas import NewApplication, PatchApplication
from app.core import jobs
from app.core.status import STATUS
from app.db.models import Application, Session, Turn
from app.db.session import db
from app.generation import blueprint as bp
from app.generation.schema import FORMAT_LABELS, STAGES, public_view
from app.pipeline import evaluator
from app.services import applications, context, events, exercise, mock

log = logging.getLogger("api")
router = APIRouter(prefix="/api", tags=["applications"])


@router.post("/ingest")
async def ingest_doc(
    kind: str = Form(...),
    file: UploadFile | None = File(None),
    text: str | None = Form(None),
    url: str | None = Form(None),
):
    """Converts a CV or a job posting (file, text, or link) to Markdown for review. Saves nothing."""
    # Capped read: extract_file re-checks the limit, but the body must never land
    # whole in memory first.
    data = await file.read(ingest.MAX_FILE_BYTES + 1) if file is not None else None
    try:
        return await run_in_threadpool(
            ingest.ingest, kind, data=data, filename=file.filename if file else None, text=text, url=url
        )
    except ingest.IngestError as e:
        raise HTTPException(422, str(e)) from None
    except Exception as e:  # noqa: BLE001
        log.exception("ingest")
        raise HTTPException(502, f"No pudimos convertir el documento: {str(e)[:120]}") from None


@router.post("/applications")
def create_application(req: NewApplication):
    if len(req.cv_md.strip()) < 50 or len(req.job_md.strip()) < 50:
        raise HTTPException(422, "Falta el CV o el puesto (o quedaron casi vacíos).")
    with db() as s:
        a = Application(
            cv_md=req.cv_md,
            job_md=req.job_md,
            cv_source=req.cv_source,
            job_source=req.job_source,
            title=applications.first_heading(req.job_md)[:200] or "Nueva postulación",
            status="generating",
        )
        s.add(a)
        s.flush()
        app_id = a.id
    events.open_channel(f"app:{app_id}")
    jobs.submit(applications.generate, app_id)
    return {"id": app_id}


@router.get("/applications")
def list_applications():
    with db() as s:
        apps = s.execute(select(Application).order_by(Application.updated_at.desc())).scalars().all()
        counts = defaultdict(dict)
        rows = s.execute(
            select(
                Session.application_id,
                Session.mode,
                func.count(func.distinct(Session.id)),
                func.max(Session.created_at),
            )
            .join(Turn, Turn.session_id == Session.id)
            .group_by(Session.application_id, Session.mode)
        ).all()
        for aid, mode, n, last in rows:
            counts[aid][mode] = n
            prev = counts[aid].get("last")
            counts[aid]["last"] = max(prev, last.isoformat()) if prev else last.isoformat()
        return [app_summary(a, counts.get(a.id)) for a in apps]


@router.get("/applications/{app_id}")
def get_application(app_id: str):
    with db() as s:
        return app_full(get_app(s, app_id))


@router.patch("/applications/{app_id}")
def patch_application(app_id: str, req: PatchApplication):
    with db() as s:
        a = get_app(s, app_id)
        data = req.model_dump(exclude_none=True)
        if "questions" in data:
            data["questions"] = applications.clean_questions(data["questions"])
            if not data["questions"]:
                raise HTTPException(422, "La postulación necesita al menos una pregunta.")
            data["blueprints"] = bp.sync(a.blueprints or [], data["questions"])
        for k, v in data.items():
            setattr(a, k, v)
        s.flush()
        return app_full(a)


@router.post("/applications/{app_id}/regenerate")
def regenerate_application(app_id: str):
    with db() as s:
        get_app(s, app_id).status = "generating"
    events.open_channel(f"app:{app_id}")
    jobs.submit(applications.generate, app_id)
    return {"id": app_id}


@router.get("/applications/{app_id}/events")
def application_events(app_id: str):
    return sse(f"app:{app_id}")


@router.delete("/applications/{app_id}")
def delete_application(app_id: str):
    with db() as s:
        s.delete(get_app(s, app_id))  # cascade-deletes its sessions and turns
    return {"deleted": True}


@router.get("/applications/{app_id}/context")
def get_app_context(app_id: str, view: str = "coach"):
    """view=mock: WITHOUT hints, expected evidence, or follow-up policy (hidden in the mock interview)."""
    try:
        ctx = context.for_app(app_id)
    except KeyError:
        raise HTTPException(404, "postulación inexistente") from None
    qs = ctx.questions() if view != "mock" else [public_view(q) for q in ctx.questions()]
    iv = ctx.interview_info()
    english = bool((ctx.analysis or {}).get("english_required")) or "ingl" in str(iv.get("language") or "").lower()
    return {
        "id": ctx.id,
        "candidate": ctx.candidate_first_name(),
        "interview": iv,
        "company": ctx.company,
        "title": ctx.title,
        "questions": qs,
        "view": view,
        "stages": [
            {k: b[k] for k in ("stage", "label", "minutes", "est_minutes", "question_ids", "english_check")}
            for b in ctx.blueprints
        ],
        "interview_stages": [b["stage"] for b in mock.stages_for(ctx)],
        "exercises": [q["id"] for q in exercise.exercises(ctx)],
        "english_required": english,
        "stage_labels": {k: v[0] for k, v in STAGES.items()},
        "format_labels": FORMAT_LABELS,
        "criteria_labels": evaluator.CRITERIA_LABELS,
        "status": STATUS,
    }
