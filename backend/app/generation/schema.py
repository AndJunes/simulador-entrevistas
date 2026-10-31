"""Question vocabulary and normalization compatible with the old format.

A question is not just `text + guidance`: it carries stage, format, competency, priority, (private) expected
evidence, follow-up policy and coach-mode hints. `type` (screening | star | technical | logistics | exercise)
is DERIVED from the format and picks the evaluator's rubric.
"""

import re

STAGES = {  # stage: (label, min minutes, max minutes)
    "recruiter_screen": ("Recruiter screen", 15, 20),
    "technical_screen": ("Entrevista técnica", 35, 45),
    "behavioral_client": ("Conductual y cliente", 25, 30),
    "work_sample": ("Ejercicio práctico", 45, 90),
}
STAGE_ORDER = list(STAGES)

FORMATS = [
    "biographical",
    "motivation",
    "behavioral",
    "situational",
    "technical_knowledge",
    "debugging",
    "design",
    "exercise",
    "logistics",
]
FORMAT_LABELS = {
    "biographical": "Trayectoria",
    "motivation": "Motivación",
    "behavioral": "Conductual",
    "situational": "Situacional",
    "technical_knowledge": "Conocimiento técnico",
    "debugging": "Debugging",
    "design": "Diseño",
    "exercise": "Ejercicio",
    "logistics": "Logística",
}
FORMAT_TYPE = {
    "biographical": "screening",
    "motivation": "screening",
    "logistics": "logistics",
    "behavioral": "star",
    "situational": "technical",
    "technical_knowledge": "technical",
    "debugging": "technical",
    "design": "technical",
    "exercise": "exercise",
}
PRIORITIES = ["must_have", "important", "nice_to_have"]
DIFFICULTIES = ["basic", "intermediate", "advanced"]
EVIDENCE_MODES = ["past_behavior", "explanatory_knowledge", "live_execution", "situational_judgment"]
EVIDENCE_LEVELS = ["profesional", "proyecto", "academico_hackathon", "teorico", "ninguna"]

DEFAULT_DURATION = {
    "screening": [45, 90],
    "star": [60, 90],
    "technical": [60, 150],
    "logistics": [20, 45],
    "exercise": [900, 2700],
}
DEFAULT_COMPETENCY = {
    "biographical": ("career_narrative", "Trayectoria y síntesis"),
    "motivation": ("motivation_fit", "Motivación y encaje con el rol"),
    "behavioral": ("behavioral_general", "Conducta en el trabajo"),
    "logistics": ("logistics", "Logística"),
    "situational": ("situational_judgment", "Criterio en situaciones"),
    "technical_knowledge": ("technical_general", "Conocimiento técnico"),
    "debugging": ("debugging", "Debugging"),
    "design": ("system_design", "Diseño"),
    "exercise": ("work_sample", "Ejercicio práctico"),
}

# What the interviewer knows and you don't: never exposed in mock mode.
PRIVATE_FIELDS = (
    "guidance",
    "hints",
    "objective",
    "relevance",
    "expected_evidence",
    "weak_indicators",
    "followup_policy",
    "candidate_evidence_ids",
    "known_gaps",
    "source_refs",
    "validation",
    "confidence",
    "approved",
    "secondary_competencies",
)


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9_]+", "_", (s or "").strip().lower()).strip("_")[:48]


def _list(v) -> list:
    return [x for x in v if (x.strip() if isinstance(x, str) else x)] if isinstance(v, list) else []


def _legacy_format(q: dict) -> str:
    if q.get("pitch"):
        return "biographical"
    if q.get("type") == "star":
        return "behavioral"
    if q.get("type") == "screening" and q.get("followup", True) is False:
        return "logistics"
    return "motivation"


def _stage_for(fmt: str) -> str:
    if fmt in ("biographical", "motivation", "logistics"):
        return "recruiter_screen"
    if fmt in ("behavioral", "situational"):
        return "behavioral_client"
    if fmt == "exercise":
        return "work_sample"
    return "technical_screen"


def normalize_question(q: dict, i: int) -> dict:
    """Fills in and validates a question. Accepts the old format (type/pitch/followup/guidance) and the new one."""
    fmt = q.get("format") if q.get("format") in FORMATS else _legacy_format(q)
    qtype = FORMAT_TYPE[fmt]
    # old format (no `format`): the bank was ONE screening with STAR stories inside → a single stage
    stage = (
        q.get("stage") if q.get("stage") in STAGES else ("recruiter_screen" if "format" not in q else _stage_for(fmt))
    )
    dur = (
        q.get("duration")
        if isinstance(q.get("duration"), list) and len(q["duration"]) == 2
        else DEFAULT_DURATION[qtype]
    )
    text_en = (q.get("text_en") or q.get("text_es") or "").strip()
    comp_id, comp_label = DEFAULT_COMPETENCY[fmt]
    comp_id = _slug(q.get("primary_competency") or "") or comp_id
    comp_label = (q.get("competency_label") or "").strip() or (
        comp_label if comp_id == DEFAULT_COMPETENCY[fmt][0] else comp_id.replace("_", " ")
    )

    pol = q.get("followup_policy") if isinstance(q.get("followup_policy"), dict) else None
    if pol is None:  # old format: followup bool
        legacy_ok = q.get("followup", True) is not False
        pol = {"triggers": [], "max_followups": 2 if legacy_ok else 0, "skip_if_covered": True}
    max_f = 0 if fmt == "exercise" else max(0, min(3, int(pol.get("max_followups") or 0)))
    triggers = [
        {"if_missing": str(t.get("if_missing", "")).strip(), "ask": str(t.get("ask", "")).strip()}
        for t in pol.get("triggers") or []
        if isinstance(t, dict) and str(t.get("ask", "")).strip()
    ][:6]

    hints = q.get("hints") if isinstance(q.get("hints"), dict) else {}
    hints = {
        "structure": (hints.get("structure") or "").strip(),
        "cv_examples": _list(hints.get("cv_examples")),
        "watch_out": (hints.get("watch_out") or "").strip(),
    }
    guidance = (q.get("guidance") or "").strip() or " ".join(
        x
        for x in [
            hints["structure"],
            ("Historias: " + "; ".join(hints["cv_examples"])) if hints["cv_examples"] else "",
            hints["watch_out"],
        ]
        if x
    )

    ex = q.get("exercise") if fmt == "exercise" and isinstance(q.get("exercise"), dict) else None
    if ex is not None:
        ex = {
            "brief": (ex.get("brief") or "").strip(),
            "deliverable": (ex.get("deliverable") or "").strip(),
            "criteria": _list(ex.get("criteria")),
            "constraints": _list(ex.get("constraints")),
            "reference_facts": _list(ex.get("reference_facts")),
            "minutes": int(ex.get("minutes") or 30),
        }

    val = q.get("validation") if isinstance(q.get("validation"), dict) else {}
    priority = (
        q.get("priority") if q.get("priority") in PRIORITIES else ("must_have" if fmt != "logistics" else "important")
    )
    return {
        "id": q.get("id") or f"Q{i + 1}",
        "type": qtype,
        "stage": stage,
        "format": fmt,
        "text_en": text_en,
        "text_es": (q.get("text_es") or text_en).strip(),
        "primary_competency": comp_id,
        "competency_label": comp_label,
        "secondary_competencies": [_slug(x) for x in _list(q.get("secondary_competencies"))][:3],
        "priority": priority,
        "difficulty": q.get("difficulty") if q.get("difficulty") in DIFFICULTIES else "intermediate",
        "evidence_mode": q.get("evidence_mode")
        if q.get("evidence_mode") in EVIDENCE_MODES
        else (
            "past_behavior"
            if fmt in ("biographical", "behavioral")
            else "live_execution"
            if fmt == "exercise"
            else "situational_judgment"
            if fmt in ("situational", "logistics", "motivation")
            else "explanatory_knowledge"
        ),
        "objective": (q.get("objective") or "").strip(),
        "relevance": (q.get("relevance") or "").strip(),
        "candidate_evidence_ids": [x for x in _list(q.get("candidate_evidence_ids")) if re.fullmatch(r"E\d+", str(x))],
        "known_gaps": _list(q.get("known_gaps")),
        "source_refs": [x for x in _list(q.get("source_refs")) if re.fullmatch(r"R\d+", str(x))],
        "expected_evidence": _list(q.get("expected_evidence"))[:6],
        "weak_indicators": _list(q.get("weak_indicators"))[:5],
        "followup_policy": {
            "triggers": triggers,
            "max_followups": max_f,
            "skip_if_covered": pol.get("skip_if_covered", True) is not False,
        },
        "hints": hints,
        "guidance": guidance,
        "exercise": ex,
        "duration": [int(dur[0]), int(dur[1])],
        "confidence": float(q["confidence"]) if isinstance(q.get("confidence"), (int, float)) else None,
        "validation": {"score": val.get("score"), "issues": _list(val.get("issues")), "critic": val.get("critic")},
        "approved": bool(q.get("approved")),
        # compatibility with the previous code and frontend
        "pitch": fmt == "biographical",
        "followup": max_f > 0,
    }


def public_view(q: dict) -> dict:
    """The question as the candidate sees it in the mock interview: no hints or expected evidence."""
    return {k: v for k, v in q.items() if k not in PRIVATE_FIELDS and k != "exercise"}
