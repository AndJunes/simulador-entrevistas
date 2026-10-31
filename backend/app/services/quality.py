"""System quality metrics: from the product (database) and from the evals (evals/results).

Not a grade for the person: it measures whether the GENERATOR, the INTERVIEWER and the EVALUATOR do their job well.
"""

import json
import statistics
from collections import Counter

from sqlalchemy import select

from app.core.config import ROOT
from app.db.models import Application, Session, Turn
from app.db.session import db
from app.generation.schema import normalize_question

RESULTS = ROOT / "evals" / "results"


def _pct(n: int, d: int) -> float | None:
    return round(100 * n / d, 1) if d else None


def _latest(prefix: str) -> dict | None:
    files = sorted(RESULTS.glob(f"{prefix}*.summary.json")) if RESULTS.exists() else []
    if not files:
        return None
    try:
        return {"file": files[-1].name, **json.loads(files[-1].read_text())}
    except (OSError, json.JSONDecodeError):
        return None


def summary(application_id: str | None = None) -> dict:
    with db() as s:
        aq = select(Application)
        if application_id:
            aq = aq.where(Application.id == application_id)
        apps = s.execute(aq).scalars().all()
        sq = select(Session)
        if application_id:
            sq = sq.where(Session.application_id == application_id)
        sessions = s.execute(sq).scalars().all()
        sids = [x.id for x in sessions]
        turns = s.execute(select(Turn).where(Turn.session_id.in_(sids))).scalars().all() if sids else []
        mode_of = {x.id: x.mode for x in sessions}
        stage_of = {x.id: (x.settings or {}).get("stage") for x in sessions}

        # --- generator
        qs = [normalize_question(q, i) for a in apps for i, q in enumerate(a.questions or [])]
        issues = [i for q in qs for i in q["validation"]["issues"]]
        reports = [a.generation_report or {} for a in apps if (a.generation_report or {}).get("version") == "v2"]
        cov = [r["coverage"] for r in reports if r.get("coverage")]
        generator = {
            "questions": len(qs),
            "approved_pct": _pct(sum(q["approved"] for q in qs), len(qs)),
            "with_issues_pct": _pct(sum(bool(q["validation"]["issues"]) for q in qs), len(qs)),
            "unsupported_premises": sum(i.startswith("premisa") for i in issues),
            "multi_part": sum(i.startswith("pregunta múltiple") for i in issues),
            "leading": sum(i.startswith("inductiva") for i in issues),
            "duplicates_removed": sum(len(r.get("duplicates_removed", [])) for r in reports),
            "must_have_coverage_pct": _pct(sum(len(c["covered"]) for c in cov), sum(c["must_have_total"] for c in cov)),
            "uncovered": sorted({u for c in cov for u in c["uncovered"]}),
            "apps_v2": len(reports),
            "apps_total": len(apps),
            "cost_usd": round(sum(r.get("cost_usd", 0) for r in reports), 3),
        }

        # --- interviewer (follow-ups)
        mock_main = [
            t
            for t in turns
            if mode_of.get(t.session_id) in ("mock", "videocall") and not t.is_followup and t.question_type != "closing"
        ]
        decisions = [d for t in mock_main for d in (t.extra or {}).get("decisions", [])]
        fus = [t for t in turns if t.is_followup and mode_of.get(t.session_id) in ("mock", "videocall")]
        flagged = [t for t in fus if t.followup_flag]
        per_q = Counter(t.parent_turn_id for t in fus)
        interviewer = {
            "main_questions": len(mock_main),
            "followups": len(fus),
            "followups_per_question": round(len(fus) / len(mock_main), 2) if mock_main else None,
            "decisions": len(decisions),
            "justified_skips": sum(not d.get("ask") for d in decisions),
            "redundant_pct": _pct(sum(t.followup_flag == "redundant" for t in flagged), len(flagged)),
            "flagged": len(flagged),
            "max_per_question": max(per_q.values()) if per_q else 0,
        }

        # --- evaluator and feedback
        evald = [t for t in turns if t.evaluation and t.evaluation.get("ok")]
        evs = [t.evaluation["evaluation"] for t in evald]
        rated = [t for t in turns if t.feedback_rating in (1, -1)]
        deltas = []
        by_id = {t.id: t for t in turns}
        for t in evald:
            prev = by_id.get(t.attempt_of) if t.attempt_of else None
            pc = (
                ((prev.evaluation or {}).get("evaluation") or {}).get("competency")
                if prev and prev.evaluation
                else None
            )
            cc = t.evaluation["evaluation"].get("competency")
            if pc and cc and pc.get("score") and cc.get("score"):
                deltas.append(cc["score"] - pc["score"])
        evaluator = {
            "evaluations": len(evs),
            "unsupported_claims_pct": _pct(sum(bool(e.get("unsupported_claims_vs_cv")) for e in evs), len(evs)),
            "confidence": dict(Counter(e.get("confidence") for e in evs)),
            "evidence_levels": dict(
                Counter((e.get("competency") or {}).get("evidence_level") for e in evs if e.get("competency"))
            ),
            "feedback_rated": len(rated),
            "feedback_useful_pct": _pct(sum(t.feedback_rating == 1 for t in rated), len(rated)),
            "retry_competency_delta": round(statistics.mean(deltas), 2) if deltas else None,
            "retries": len(deltas),
        }

        # --- per-session competency coverage (mock interviews)
        cover = []
        app_q = {
            a.id: {q["id"]: q for q in (normalize_question(x, i) for i, x in enumerate(a.questions or []))}
            for a in apps
        }
        for x in sessions:
            if x.mode not in ("mock", "videocall"):
                continue
            plan = [p["qid"] if isinstance(p, dict) else p for p in (x.settings or {}).get("plan", [])]
            asked = {t.question_id for t in turns if t.session_id == x.id and not t.is_followup}
            bank = app_q.get(x.application_id, {})
            must = [qid for qid in plan if bank.get(qid, {}).get("priority") == "must_have"]
            if plan and asked:  # sessions with no answers (opened and abandoned) don't count
                cover.append(
                    {
                        "session_id": x.id,
                        "stage": stage_of.get(x.id),
                        "planned": len(plan),
                        "answered_pct": _pct(len([p for p in plan if p in asked]), len(plan)),
                        "must_have_answered_pct": _pct(len([p for p in must if p in asked]), len(must)),
                    }
                )
    return {
        "generator": generator,
        "interviewer": interviewer,
        "evaluator": evaluator,
        "session_coverage": cover[-20:],
        "evals": {"generator": _latest("gen_"), "consistency": _latest("consistency_")},
    }
