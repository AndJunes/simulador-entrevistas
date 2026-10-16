"""Consistencia del EVALUADOR ("evaluation reliability"): ¿dos evaluaciones de la MISMA respuesta
llegan a resultados parecidos?

Toma N respuestas reales ya guardadas (transcripciones de tus prácticas, nunca audio), las vuelve a evaluar R veces con
el evaluador actual y mide el acuerdo por criterio y por competencia:
- exacto (%), a ±1 punto (%) y diferencia absoluta media;
- acuerdo en "aplica / no aplica" y en el nivel de evidencia.

Uso (desde la raíz del proyecto):
  backend/.venv/bin/python evals/run_evaluator_consistency.py --n 5 --repeats 2
Los resultados agregados (sin transcripciones) van a evals/results/consistency_<fecha>.summary.json; el detalle con
texto va a data/private/evals/results/ porque contiene tus respuestas.
"""
import argparse
import json
import statistics
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from itertools import combinations
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from sqlalchemy import select  # noqa: E402

from app.db.models import Session, Turn  # noqa: E402
from app.db.session import db  # noqa: E402
from app.pipeline import evaluator  # noqa: E402
from app.services import context  # noqa: E402


def sample(n: int) -> list[dict]:
    """Las N respuestas evaluadas más recientes con transcripción larga (variadas por pregunta)."""
    with db() as s:
        rows = s.execute(select(Turn, Session).join(Session, Session.id == Turn.session_id)
                         .where(Turn.kind == "evaluation", Turn.status == "done", Turn.evaluation.is_not(None),
                                Turn.is_followup.is_(False), Session.application_id.is_not(None))
                         .order_by(Turn.created_at.desc()).limit(200)).all()
        out, seen = [], set()
        for t, se in rows:
            text = (t.transcript or {}).get("text", "")
            if len(text.split()) < 40 or (se.application_id, t.question_id) in seen or t.question_type == "closing":
                continue
            seen.add((se.application_id, t.question_id))
            out.append({"turn_id": t.id, "app_id": se.application_id, "qid": t.question_id.split("-")[0], "lang": t.lang,
                        "type": t.question_type, "question": t.question_text, "transcript": text,
                        "metrics": {k: v for k, v in (t.metrics or {}).items() if k not in ("filler_word_idx", "low_confidence_idx")},
                        "low": t.low_conf_words or []})
            if len(out) >= n:
                break
    return out


def evaluate(item: dict) -> dict:
    ctx = context.for_app(item["app_id"])
    try:
        q = context.in_lang(ctx.question(item["qid"]), item["lang"])
    except KeyError:   # la pregunta ya no está en el banco (se regeneró): se evalúa con el texto guardado
        q = {"text": item["question"], "guidance": "", "type": item["type"]}
    qtype = q.get("type") or item["type"]
    return evaluator.evaluate(interview_type=qtype, language=item["lang"], question=item["question"],
                              question_guidance=q.get("guidance", ""), transcript=item["transcript"], delivery=item["metrics"],
                              low_conf_words=item["low"], cv=ctx.cv(), job=ctx.job(), question_meta=q if "id" in q else None,
                              evidence=ctx.evidence_digest())


def agreement(runs: list[dict]) -> dict:
    evs = [r["evaluation"] for r in runs if r.get("ok")]
    if len(evs) < 2:
        return {"error": "menos de 2 evaluaciones válidas"}
    exact, within1, diffs, appl = [], [], [], []
    for a, b in combinations(evs, 2):
        ca = {c["id"]: c for c in a["criteria"]}
        cb = {c["id"]: c for c in b["criteria"]}
        for k in ca.keys() & cb.keys():
            appl.append(ca[k].get("applicable", True) == cb[k].get("applicable", True))
            if ca[k].get("applicable", True) and cb[k].get("applicable", True):
                d = abs(ca[k]["score"] - cb[k]["score"])
                diffs.append(d)
                exact.append(d == 0)
                within1.append(d <= 1)
    comp = [(e.get("competency") or {}) for e in evs]
    cs = [c.get("score") for c in comp if c.get("score")]
    lv = [c.get("evidence_level") for c in comp if c.get("evidence_level")]
    pct = lambda xs: round(100 * sum(xs) / len(xs), 1) if xs else None  # noqa: E731
    return {"criteria_exact_pct": pct(exact), "criteria_within1_pct": pct(within1),
            "criteria_mean_abs_diff": round(statistics.mean(diffs), 2) if diffs else None,
            "applicability_agree_pct": pct(appl), "competency_scores": cs,
            "competency_max_diff": (max(cs) - min(cs)) if len(cs) > 1 else None,
            "evidence_level_agree": len(set(lv)) == 1 if lv else None, "evidence_levels": lv}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=5)
    ap.add_argument("--repeats", type=int, default=2)
    ap.add_argument("--workers", type=int, default=4)
    a = ap.parse_args()
    items = sample(a.n)
    if not items:
        sys.exit("No hay respuestas evaluadas con transcripción suficiente.")
    t0 = time.time()
    jobs = [(i, r) for i in range(len(items)) for r in range(a.repeats)]
    with ThreadPoolExecutor(a.workers) as ex:
        outs = list(ex.map(lambda j: evaluate(items[j[0]]), jobs))
    per = []
    for i, it in enumerate(items):
        runs = [o for (k, _), o in zip(jobs, outs) if k == i]
        per.append({"turn_id": it["turn_id"], "qid": it["qid"], "type": it["type"], "lang": it["lang"],
                    "agreement": agreement(runs), "cost_usd": round(sum(r.get("cost_usd", 0) for r in runs), 4)})
    ok = [p["agreement"] for p in per if "error" not in p["agreement"]]
    avg = lambda k: round(statistics.mean(x[k] for x in ok if x.get(k) is not None), 1) if ok else None  # noqa: E731
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")
    summary = {
        "created_at": datetime.now(timezone.utc).isoformat(), "answers": len(items), "repeats": a.repeats,
        "criteria_exact_pct": avg("criteria_exact_pct"), "criteria_within1_pct": avg("criteria_within1_pct"),
        "criteria_mean_abs_diff": avg("criteria_mean_abs_diff"), "applicability_agree_pct": avg("applicability_agree_pct"),
        "competency_max_diff_avg": avg("competency_max_diff"),
        "evidence_level_agree_pct": round(100 * sum(bool(x["evidence_level_agree"]) for x in ok) / len(ok), 1) if ok else None,
        "cost_usd": round(sum(p["cost_usd"] for p in per), 3), "minutes": round((time.time() - t0) / 60, 1),
        "per_answer": [{k: p[k] for k in ("qid", "type", "lang")} | {k: p["agreement"].get(k) for k in (
            "criteria_exact_pct", "criteria_within1_pct", "competency_scores", "evidence_levels")} for p in per],
        "note": "Mismo evaluador y misma respuesta, evaluada varias veces: mide estabilidad, no exactitud. La exactitud "
                "se valida contra tu revisión humana (evals/make_case.py).",
    }
    summary["headline"] = [["Respuestas × repeticiones", f"{len(items)} × {a.repeats}"],
                           ["Criterios: acuerdo exacto", f"{summary['criteria_exact_pct']}%"],
                           ["Criterios: acuerdo ±1", f"{summary['criteria_within1_pct']}%"],
                           ["Diferencia media", str(summary["criteria_mean_abs_diff"])],
                           ["Competencia: diferencia máx. promedio", str(summary["competency_max_diff_avg"])],
                           ["Mismo nivel de evidencia", f"{summary['evidence_level_agree_pct']}%"],
                           ["Costo", f"US${summary['cost_usd']}"]]
    pub = ROOT / "evals" / "results"
    priv = ROOT / "data" / "private" / "evals" / "results"
    pub.mkdir(parents=True, exist_ok=True)
    priv.mkdir(parents=True, exist_ok=True)
    (pub / f"consistency_{stamp}.summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=1))
    (priv / f"consistency_{stamp}.json").write_text(json.dumps({"summary": summary, "items": items, "per": per,
                                                                "raw": outs}, ensure_ascii=False, indent=1))
    print(json.dumps({k: v for k, v in summary.items() if k not in ("per_answer", "headline")}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
