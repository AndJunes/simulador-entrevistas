"""System health, quality metrics, history and progress."""

import statistics
from collections import defaultdict
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select

from app.api.helpers import turn_dict
from app.core.status import STATUS
from app.db.models import Session, Turn
from app.db.session import db
from app.pipeline import evaluator
from app.services import quality

router = APIRouter(prefix="/api", tags=["quality"])


@router.get("/health")
def health():
    return {"ok": True, **STATUS}


@router.get("/quality")
def get_quality(application_id: str | None = None):
    return quality.summary(application_id)


@router.get("/sessions")
def list_sessions(application_id: str | None = None, mode: str | None = None):
    with db() as s:
        q = select(Session, func.count(Turn.id)).outerjoin(Turn).group_by(Session.id)
        if application_id:
            q = q.where(Session.application_id == application_id)
        if mode:
            q = q.where(Session.mode == mode)
        rows = s.execute(q.order_by(Session.created_at.desc()).limit(200)).all()
        return [
            {
                "id": se.id,
                "application_id": se.application_id,
                "mode": se.mode,
                "lang": se.lang,
                "status": se.status,
                "turns": n,
                "created_at": se.created_at.isoformat(),
                "has_report": se.report is not None,
            }
            for se, n in rows
        ]


@router.get("/sessions/{sid}")
def get_session(sid: str):
    with db() as s:
        se = s.get(Session, sid)
        if not se:
            raise HTTPException(404)
        return {
            "id": se.id,
            "application_id": se.application_id,
            "mode": se.mode,
            "lang": se.lang,
            "status": se.status,
            "settings": se.settings,
            "report": se.report,
            "created_at": se.created_at.isoformat(),
            "turns": [turn_dict(t) for t in se.turns],
        }


@router.get("/progress")
def progress(application_id: str | None = None):
    """Per-day evolution: delivery metrics and per-criterion averages. No overall grade."""
    with db() as s:
        q = (
            select(Turn)
            .join(Session, Session.id == Turn.session_id)
            .where(Turn.kind == "evaluation", Turn.status == "done")
        )
        if application_id:
            q = q.where(Session.application_id == application_id)
        rows = s.execute(q.order_by(Turn.created_at)).scalars().all()
        by_day = defaultdict(list)
        for t in rows:
            by_day[t.created_at.date().isoformat()].append(t)

    def avg(xs):
        return round(statistics.mean(xs), 2) if xs else None

    out, comp_labels = [], {}
    c: Any
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
        out.append(
            {
                "day": day,
                "answers": len(ts),
                "competencies": {
                    k: {"avg": avg([x[0] for x in v]), "levels": [x[1] for x in v]} for k, v in comp.items()
                },
                "first_word_latency_s": avg([m["first_word_latency_s"] for m in ms]),
                "wpm": avg([m["wpm"] for m in ms]),
                "fillers_per_min": avg([m["fillers_per_min"] for m in ms]),
                "in_range_pct": round(100 * sum(m["duration_status"] == "en rango" for m in ms) / len(ms))
                if ms
                else None,
                "criteria": {k: avg(v) for k, v in crit.items()},
            }
        )
    return {"days": out, "labels": evaluator.CRITERIA_LABELS, "competency_labels": comp_labels}
