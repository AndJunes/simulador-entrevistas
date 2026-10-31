"""Application generation from the CV and the job (staged v2 pipeline: app/generation/).

Runs in a background thread and emits progress on the `app:<id>` SSE channel.
"""

import logging
import re
import traceback

from app.db.models import Application
from app.db.session import db
from app.generation import pipeline
from app.generation.blueprint import sync as sync_blueprints  # noqa: F401  (re-export)
from app.generation.schema import normalize_question
from app.services import events

log = logging.getLogger("applications")

FIELDS = (
    "company",
    "candidate_name",
    "interview",
    "requirements",
    "questions",
    "glossary",
    "analysis",
    "evidence",
    "evidence_map",
    "blueprints",
    "company_facts",
    "generation_report",
)


def generate(app_id: str) -> None:
    cid = f"app:{app_id}"
    try:
        with db() as s:
            a = s.get(Application, app_id)
            cv, job = a.cv_md, a.job_md
            a.status, a.error = "generating", None
        events.emit(cid, "reading")
        out = pipeline.run(cv, job, progress=lambda stage, **kw: events.emit(cid, stage, **kw))
        events.emit(cid, "saving")
        with db() as s:
            a = s.get(Application, app_id)
            a.title = (out["title"] or "").strip()[:200] or a.title
            for f in FIELDS:
                setattr(a, f, out[f])
            a.company = (a.company or "").strip()[:120]
            a.candidate_name = (a.candidate_name or "").strip()[:120]
            a.generator_version = pipeline.VERSION
            a.status = "ready"
        rep = out["generation_report"]
        events.emit(
            cid,
            "done",
            cost_usd=rep["cost_usd"],
            questions=len(out["questions"]),
            requirements=len(out["requirements"]),
            uncovered=rep["coverage"]["uncovered"],
        )
    except Exception as e:  # noqa: BLE001
        log.error("generación %s falló: %s", app_id, traceback.format_exc())
        with db() as s:
            a = s.get(Application, app_id)
            if a:
                a.status, a.error = "error", str(e)[:500]
        events.emit(cid, "error", message="No pudimos generar las preguntas. Probá de nuevo en un momento.")


def clean_questions(raw: list[dict]) -> list[dict]:
    """Normalizes hand-edited questions. Keeps existing IDs (history references them);
    new questions get the next free ID. Drops empty ones."""
    kept = [q for q in raw if (q.get("text_es") or "").strip() or (q.get("text_en") or "").strip()]
    used, out = set(), []
    for q in kept:
        qid = q.get("id") if re.fullmatch(r"Q\d+", str(q.get("id") or "")) and q.get("id") not in used else None
        if qid:
            used.add(qid)
        out.append((qid, q))
    nxt = max([int(i[1:]) for i in used] + [0]) + 1
    result = []
    for i, (qid, q) in enumerate(out):
        if not qid:
            qid, nxt = f"Q{nxt}", nxt + 1
        result.append(normalize_question({**q, "id": qid}, i))
    return result


def first_heading(md: str) -> str:
    m = re.search(r"^#\s+(.+)$", md or "", re.M)
    return m.group(1).strip() if m else ""
