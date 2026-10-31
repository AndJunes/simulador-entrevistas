"""Interview blueprint (stage 4, DETERMINISTIC): which competencies each stage assesses, and in how much time.

Stages: recruiter screen, technical, behavioral/client and work sample.
Competencies come from the job analysis (must-haves first). A recruiter screen is not a technical
interview: technical competencies go to their own stage (rule 11 of the base prompt).
"""

from app.generation.schema import STAGES

DUR = {
    "biographical": [60, 90],
    "motivation": [45, 75],
    "logistics": [20, 45],
    "behavioral": [60, 120],
    "situational": [60, 120],
    "technical": [60, 150],
    "design": [90, 180],
    "exercise": [1200, 2400],
}
PRIO_RANK = {"must_have": 0, "important": 1, "nice_to_have": 2}
FOLLOWUP_EST_S = 35  # one follow-up + short answer, estimated average (⚠ heuristic)
INTERVIEWER_S = 15  # how long the interviewer takes to ask


def _slot(
    stage,
    n,
    formats,
    competency,
    label,
    priority,
    purpose,
    req_ids=(),
    evidence_mode=None,
    duration=None,
    evidence_ids=(),
    followups=2,
):
    f0 = formats[0]
    return {
        "slot_id": f"{stage[:3].upper()}{n}",
        "stage": stage,
        "formats": list(formats),
        "competency": competency,
        "competency_label": label,
        "priority": priority,
        "purpose": purpose,
        "requirement_ids": list(req_ids),
        "evidence_mode": evidence_mode,
        "evidence_ids": list(evidence_ids),
        "duration": duration
        or DUR.get(f0, DUR["technical"] if f0 in ("technical_knowledge", "debugging") else [60, 120]),
        "max_followups": 0 if f0 == "exercise" else followups,
    }


def estimate_minutes(slots: list[dict]) -> float:
    total = 0.0
    for s in slots:
        lo, hi = s["duration"]
        if "exercise" in s["formats"]:
            total += (lo + hi) / 2
        else:
            total += (lo + hi) / 2 + INTERVIEWER_S + FOLLOWUP_EST_S * min(1.5, s["max_followups"])
    return round(total / 60, 1)


def _sorted(reqs):
    return sorted(reqs, key=lambda r: (PRIO_RANK.get(r.get("priority"), 3), int(str(r["id"])[1:] or 0)))


def _best_evidence(evidence: list[dict], reqs: list[dict]) -> list[str]:
    """The CV experience sharing the most technologies with the technical requirements (for the project question)."""
    terms = {
        w.lower()
        for r in reqs
        for w in (r.get("text", "") + " " + r.get("competency", "")).replace("_", " ").split()
        if len(w) > 2
    }
    scored = []
    for e in evidence:
        if e.get("kind") not in ("professional", "freelance", "project"):
            continue
        overlap = sum(1 for t in e.get("technologies", []) if t.lower() in terms or any(t.lower() in x for x in terms))
        scored.append((overlap + (1 if e.get("kind") in ("professional", "freelance") else 0), e["id"]))
    return [i for _, i in sorted(scored, reverse=True)[:1]]


def build(analysis: dict, requirements: list[dict], evidence: list[dict]) -> list[dict]:
    """Returns the stages with their slots. `requirements` already carry id (R1…), kind, competency, priority and coverage."""
    reqs = _sorted(requirements)
    tech = [r for r in reqs if r.get("kind") == "technical"]
    soft = [r for r in reqs if r.get("kind") == "soft"]
    exp = [r for r in reqs if r.get("kind") == "experience"]
    if analysis.get("is_technical") and not tech:
        # Postings that only say "N years of React/Node" (no separate technical requirements): the technology in
        # those experience requirements is also assessed in the technical stage (case c13 of the evals dataset).
        tech = [
            {**r, "kind": "technical", "competency": r["competency"].removesuffix("_experience") or r["competency"]}
            for r in exp
        ]
    technical = bool(analysis.get("is_technical")) and bool(tech)
    stages: list[dict] = []

    # --- A. Recruiter screen (15–20 min): background, motivation, experience vs. requirement, one delivery example,
    #        logistics at the end. English is checked naturally throughout the stage if the role requires it.
    st = "recruiter_screen"
    rs = [
        _slot(
            st,
            1,
            ["biographical"],
            "career_narrative",
            "Trayectoria relevante y síntesis",
            "must_have",
            "Recorrido relevante para ESTE rol, contribución propia y concisión",
            evidence_mode="past_behavior",
        ),
        _slot(
            st,
            2,
            ["motivation"],
            "motivation_fit",
            "Motivación y encaje con el rol",
            "must_have",
            "Por qué este rol: conectar el trabajo del aviso con la dirección en la que quiere crecer",
            evidence_mode="situational_judgment",
        ),
    ]
    gap_req = next((r for r in exp if r.get("priority") == "must_have"), None) or next(
        (r for r in tech if r.get("priority") == "must_have" and r.get("coverage") in ("partial", "gap")), None
    )
    if gap_req:
        rs.append(
            _slot(
                st,
                3,
                ["biographical"],
                gap_req["competency"],
                gap_req.get("competency_label", ""),
                "must_have",
                f"Experiencia relevante frente a «{gap_req['text']}», con tono neutral y sin presuponer",
                req_ids=[gap_req["id"]],
                evidence_mode="past_behavior",
            )
        )
    rs.append(
        _slot(
            st,
            4,
            ["behavioral"],
            "ownership_delivery",
            "Ownership y entrega",
            "important",
            "Un ejemplo concreto y breve de algo que entregó de punta a punta",
            evidence_mode="past_behavior",
            duration=[60, 90],
            followups=1,
        )
    )
    if len([f for f in analysis.get("company_facts", []) if f.get("confidence") != "baja"]) >= 2:
        rs.append(
            _slot(
                st,
                5,
                ["motivation"],
                "company_research",
                "Conocimiento de la empresa y del rol",
                "nice_to_have",
                "Qué sabe del rol y de la empresa SOLO desde lo que dicen las fuentes; sin exigir memorizar artículos",
                evidence_mode="situational_judgment",
                followups=1,
            )
        )
    rs.append(
        _slot(
            st,
            9,
            ["logistics"],
            "logistics",
            "Logística",
            "important",
            "Disponibilidad real y restricciones; después, según la respuesta: modalidad/contrato, "
            "compensación (rango y moneda) y superposición horaria. No puntúa",
            followups=2,
        )
    )
    stages.append({"stage": st, "slots": rs, "english_check": bool(analysis.get("english_required"))})

    # --- B. Technical (35–45 min): one technical must-have per question + a deep dive into a CV project.
    if technical:
        st = "technical_screen"
        ts: list[dict] = []
        seen: set[str] = set()
        for r in tech:
            if r["competency"] in seen:
                continue
            seen.add(r["competency"])
            ts.append(
                _slot(
                    st,
                    len(ts) + 1,
                    ["technical_knowledge", "situational", "debugging", "design"],
                    r["competency"],
                    r.get("competency_label", ""),
                    r.get("priority", "important"),
                    f"Comprobar «{r['text']}» con una situación de trabajo realista",
                    req_ids=[r["id"]],
                    evidence_mode="explanatory_knowledge",
                    followups=3,
                )
            )
            if len(ts) >= 8:
                break
        best = _best_evidence(evidence, tech)
        if best:
            ts.append(
                _slot(
                    st,
                    len(ts) + 1,
                    ["design"],
                    "project_deep_dive",
                    "Profundidad en un proyecto propio",
                    "important",
                    "Revisión de un proyecto del CV: arquitectura, decisiones y qué cambiaría",
                    evidence_mode="past_behavior",
                    evidence_ids=best,
                    followups=3,
                )
            )
        stages.append({"stage": st, "slots": ts, "english_check": bool(analysis.get("english_required"))})

    # --- C. Behavioral / client (25–30 min): delivery, hard bug, data-driven decision, ambiguity and communication.
    st = "behavioral_client"
    bs = [
        _slot(
            st,
            1,
            ["behavioral"],
            "ownership_delivery",
            "Ownership y entrega de punta a punta",
            "must_have",
            "Algo que llevó de requisitos a producción: qué construyó en persona, decisiones y cómo verificó",
            evidence_mode="past_behavior",
            followups=3,
        )
    ]
    if technical:
        bs.append(
            _slot(
                st,
                2,
                ["behavioral"],
                "debugging",
                "Debugging y rigor técnico",
                "must_have",
                "Un bug difícil: cómo lo reprodujo, aisló la causa, probó el arreglo y evitó regresiones",
                evidence_mode="past_behavior",
                followups=3,
            )
        )
        bs.append(
            _slot(
                st,
                3,
                ["behavioral"],
                "evidence_based_decision",
                "Decisiones basadas en evidencia",
                "important",
                "Una decisión técnica tomada con datos o evaluaciones: qué midió, criterio y decisión",
                evidence_mode="past_behavior",
                followups=3,
            )
        )
    for r in soft:
        if len(bs) >= 5:
            break
        if r["competency"] in {s["competency"] for s in bs}:
            continue
        fmt = ["situational"] if "client" in r["competency"] or "cliente" in r["text"].lower() else ["behavioral"]
        bs.append(
            _slot(
                st,
                len(bs) + 1,
                fmt,
                r["competency"],
                r.get("competency_label", ""),
                r.get("priority", "important"),
                f"Comprobar «{r['text']}» con un ejemplo real",
                req_ids=[r["id"]],
                evidence_mode="past_behavior" if fmt == ["behavioral"] else "situational_judgment",
                followups=2,
            )
        )
    if len(bs) < 5:
        bs.append(
            _slot(
                st,
                len(bs) + 1,
                ["behavioral"],
                "ambiguity_communication",
                "Ambigüedad, priorización y comunicación",
                "important",
                "Requisitos poco claros o que cambiaron: cómo aclaró, priorizó y comunicó riesgos",
                evidence_mode="past_behavior",
                followups=2,
            )
        )
    stages.append({"stage": st, "slots": bs, "english_check": bool(analysis.get("english_required"))})

    # --- D. Work sample: tasks resembling the real job (OPM, work samples).
    if technical:
        st = "work_sample"
        ws: list[dict] = []
        for r in [r for r in tech if r.get("priority") == "must_have"][:2]:
            ws.append(
                _slot(
                    st,
                    len(ws) + 1,
                    ["exercise"],
                    r["competency"],
                    r.get("competency_label", ""),
                    "must_have",
                    f"Tarea escrita parecida al trabajo real sobre «{r['text']}»",
                    req_ids=[r["id"]],
                    evidence_mode="live_execution",
                    duration=[1200, 2400],
                )
            )
        comm = next(
            (
                r
                for r in soft
                if any(k in (r["competency"] + r["text"]).lower() for k in ("comunic", "client", "commun"))
            ),
            None,
        )
        ws.append(
            _slot(
                st,
                len(ws) + 1,
                ["exercise"],
                comm["competency"] if comm else "client_communication",
                comm.get("competency_label", "") if comm else "Comunicación con el cliente",
                "important",
                "Mensaje escrito al cliente sobre una demora o un riesgo (claridad, opciones, próximo paso)",
                req_ids=[comm["id"]] if comm else [],
                evidence_mode="live_execution",
                duration=[600, 900],
            )
        )
        stages.append({"stage": st, "slots": ws, "english_check": bool(analysis.get("english_required"))})

    for s in stages:
        label, lo, hi = STAGES[s["stage"]]
        s.update(label=label, minutes=[lo, hi], est_minutes=estimate_minutes(s["slots"]))
        # trim the lowest priority when over time (never logistics)
        while s["stage"] != "work_sample" and s["est_minutes"] > hi and len(s["slots"]) > 3:
            drop = max(
                (x for x in s["slots"] if "logistics" not in x["formats"]),
                key=lambda x: (PRIO_RANK[x["priority"]], x["slot_id"]),
            )
            s["slots"].remove(drop)
            s["est_minutes"] = estimate_minutes(s["slots"])
    return stages


def coverage(stages: list[dict], requirements: list[dict], questions: list[dict]) -> dict:
    """Is every must-have assessed by at least one question? (coverage matrix)."""
    by_stage: dict[str, set] = {}
    for q in questions:
        for r in q.get("source_refs", []):
            by_stage.setdefault(r, set()).add(q.get("stage"))
    # language isn't asked about: it's checked naturally in the stages marked english_check
    english_stages = sorted(s["stage"] for s in stages if s.get("english_check"))
    for r in requirements:
        if r.get("kind") == "language" and english_stages:
            by_stage.setdefault(r["id"], set()).update(english_stages)
    must = [r for r in requirements if r.get("priority") == "must_have"]
    return {
        "must_have_total": len(must),
        "covered": [r["id"] for r in must if r["id"] in by_stage],
        "uncovered": [r["id"] for r in must if r["id"] not in by_stage],
        "matrix": {r["id"]: sorted(by_stage.get(r["id"], [])) for r in requirements},
    }


def sync(blueprints: list[dict], questions: list[dict]) -> list[dict]:
    """Stages from the current bank (after editing questions, or for old applications without a blueprint)."""
    by = {b["stage"]: b for b in blueprints or []}
    out = []
    for stage, (label, lo, hi) in STAGES.items():
        qs = [q for q in questions if q["stage"] == stage]
        if not qs:
            continue
        b = dict(by.get(stage) or {"stage": stage, "label": label, "minutes": [lo, hi], "english_check": False})
        b["question_ids"] = [q["id"] for q in qs]
        b["competencies"] = [
            {"id": q["primary_competency"], "label": q["competency_label"], "priority": q["priority"]} for q in qs
        ]
        b["est_minutes"] = estimate_minutes(
            [
                {
                    "duration": q["duration"],
                    "max_followups": q["followup_policy"]["max_followups"],
                    "formats": [q["format"]],
                }
                for q in qs
            ]
        )
        out.append(b)
    return out
