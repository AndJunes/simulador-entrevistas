"""Generation pipeline v2: schema, blueprint, validator and selection (no network: all deterministic)."""

from app.generation import blueprint as bp
from app.generation import validator as val
from app.generation.pipeline import select
from app.generation.schema import PRIVATE_FIELDS, normalize_question, public_view

KV_LITE = {
    "id": "E5",
    "title": "KvLite",
    "kind": "project",
    "technologies": ["Python", "pytest"],
    "quote": "race condition con 8 threads × 2.000 operaciones",
    "responsibilities": [],
    "achievements": [],
}
FREELANCE = {
    "id": "E1",
    "title": "Backend freelance",
    "kind": "freelance",
    "technologies": ["Python", "FastAPI", "PostgreSQL"],
    "quote": "",
    "responsibilities": [],
    "achievements": [],
}


def q(**kw):
    base = {
        "format": "technical_knowledge",
        "stage": "technical_screen",
        "text_en": "How would you design it?",
        "text_es": "¿Cómo lo diseñarías?",
        "expected_evidence": ["a"],
        "duration": [60, 120],
        "max_followups": 2,
    }
    return {**base, **kw}


# ----------------------------------------------------------------------------- schema


def test_normalize_legacy_question_gets_defaults():
    n = normalize_question(
        {
            "id": "Q1",
            "type": "screening",
            "text_en": "Tell me about yourself",
            "pitch": True,
            "guidance": "pitch de 60 s",
        },
        0,
    )
    assert n["format"] == "biographical" and n["stage"] == "recruiter_screen" and n["type"] == "screening"
    assert (
        n["pitch"] and n["followup"] and n["followup_policy"]["max_followups"] == 2 and n["guidance"] == "pitch de 60 s"
    )
    logi = normalize_question({"id": "Q8", "type": "screening", "text_en": "Rate?", "followup": False}, 1)
    assert (
        logi["format"] == "logistics" and logi["type"] == "logistics" and logi["followup_policy"]["max_followups"] == 0
    )
    star = normalize_question({"id": "Q4", "type": "star", "text_en": "A bug"}, 2)
    assert star["stage"] == "recruiter_screen", "un banco viejo era UN screening con STAR adentro"


def test_normalize_new_question_clamps_and_derives():
    n = normalize_question(
        {
            "id": "Q3",
            "format": "debugging",
            "text_en": "p95 doubled",
            "primary_competency": "RAG Ops!",
            "followup_policy": {"max_followups": 9, "triggers": [{"if_missing": "x", "ask": "Why?"}, {"ask": ""}]},
            "source_refs": ["R1", "bad"],
            "candidate_evidence_ids": ["E2", "x"],
            "hints": {"structure": "s", "cv_examples": ["Turnero"]},
        },
        0,
    )
    assert n["type"] == "technical" and n["stage"] == "technical_screen" and n["primary_competency"] == "rag_ops"
    assert n["followup_policy"]["max_followups"] == 3 and len(n["followup_policy"]["triggers"]) == 1
    assert n["source_refs"] == ["R1"] and n["candidate_evidence_ids"] == ["E2"] and "Turnero" in n["guidance"]
    ex = normalize_question(
        {
            "id": "Q9",
            "format": "exercise",
            "text_en": "Build it",
            "exercise": {"brief": "b", "minutes": 30},
            "followup_policy": {"max_followups": 2},
        },
        1,
    )
    assert ex["type"] == "exercise" and ex["followup_policy"]["max_followups"] == 0 and ex["exercise"]["minutes"] == 30


def test_public_view_hides_private_fields():
    n = normalize_question(q(id="Q1", expected_evidence=["secreto"], hints={"structure": "pista"}), 0)
    pub = public_view(n)
    assert not set(PRIVATE_FIELDS) & set(pub) and "exercise" not in pub
    assert "secreto" not in str(pub) and "pista" not in str(pub) and pub["text_en"]


# ----------------------------------------------------------------------------- validator


def test_premise_asyncio_on_threads_project_is_flagged():
    bad = q(
        format="behavioral",
        text_en="How did you solve the asyncio race condition in KvLite?",
        candidate_evidence_ids=["E5"],
    )
    good = q(
        format="behavioral",
        text_en="In KvLite you reported losing increments with threads. How did you reproduce it?",
        candidate_evidence_ids=["E5"],
    )
    assert any(i.startswith("premisa") and "asyncio" in i for i in val.deterministic_issues(bad, [KV_LITE]))
    assert not any(i.startswith("premisa") for i in val.deterministic_issues(good, [KV_LITE]))


def test_premise_equivalences_and_unreferenced_questions():
    fl = q(
        format="behavioral",
        text_en="In your freelance work with Postgres, what did you index?",
        candidate_evidence_ids=["E1"],
    )
    assert not any(i.startswith("premisa") for i in val.deterministic_issues(fl, [FREELANCE]))
    generic = q(text_en="An endpoint calls three APIs. How would you use asyncio here?")
    assert not any(i.startswith("premisa") for i in val.deterministic_issues(generic, [KV_LITE]))


def test_multi_part_only_for_distinct_tasks():
    rag = q(text_en="Could you explain how you would build a RAG pipeline and how you would evaluate its quality?")
    assert "pregunta múltiple: pide más de una cosa a la vez" in val.deterministic_issues(rag, [])
    star = q(
        format="behavioral",
        text_en="Tell me about a feature you delivered. What did you personally build, and how did you verify it?",
    )
    assert not any("múltiple" in i for i in val.deterministic_issues(star, []))
    logi = q(
        format="logistics",
        text_en="What is your earliest realistic start date, and are there any constraints, such as other processes?",
    )
    issues = val.deterministic_issues(logi, [])
    assert not any("múltiple" in i or "inductiva" in i for i in issues)


def test_leading_and_gendered_and_missing_evidence():
    lead = q(format="behavioral", text_en="Tell me about a hard bug, such as a concurrency or async issue.")
    assert any(i.startswith("inductiva") for i in val.deterministic_issues(lead, []))
    gendered = q(expected_evidence=["Distingue lo que hizo él de lo que hizo el equipo"])
    assert any("género" in i for i in val.deterministic_issues(gendered, []))
    assert any("sin evidencia esperada" in i for i in val.deterministic_issues(q(expected_evidence=[]), []))


def test_similarity_and_dedupe():
    a = {"text_en": "Tell me about a hard bug you fixed and how you found it", "id": "Q1"}
    b = {"text_en": "Tell me about a hard bug you fixed and how you found the cause", "id": "Q2"}
    c = {"text_en": "Why are you interested in this role?", "id": "Q3"}
    kept, dropped = val.dedupe([a, b, c])
    assert [k["id"] for k in kept] == ["Q1", "Q3"] and dropped[0]["_dup_of"] == "Q1"


# ----------------------------------------------------------------------------- blueprint

REQS = [
    {
        "id": "R1",
        "text": "2+ años de Python",
        "kind": "experience",
        "competency": "python_experience",
        "priority": "must_have",
        "coverage": "partial",
    },
    {
        "id": "R2",
        "text": "asyncio",
        "kind": "technical",
        "competency": "async_python",
        "priority": "must_have",
        "coverage": "gap",
    },
    {
        "id": "R3",
        "text": "FastAPI",
        "kind": "technical",
        "competency": "rest_api",
        "priority": "must_have",
        "coverage": "strong",
    },
    {
        "id": "R4",
        "text": "Comunicación con el cliente",
        "kind": "soft",
        "competency": "client_communication",
        "priority": "must_have",
        "coverage": "partial",
    },
    {
        "id": "R5",
        "text": "Inglés fluido",
        "kind": "language",
        "competency": "english",
        "priority": "must_have",
        "coverage": "gap",
    },
    {
        "id": "R6",
        "text": "RAG",
        "kind": "technical",
        "competency": "llm_rag",
        "priority": "nice_to_have",
        "coverage": "partial",
    },
]


def test_blueprint_stages_order_and_content():
    stages = bp.build({"is_technical": True, "english_required": True, "company_facts": []}, REQS, [FREELANCE, KV_LITE])
    assert [s["stage"] for s in stages] == ["recruiter_screen", "technical_screen", "behavioral_client", "work_sample"]
    rec = stages[0]["slots"]
    assert rec[0]["formats"] == ["biographical"] and rec[-1]["formats"] == ["logistics"]
    assert any(s["requirement_ids"] == ["R1"] for s in rec), "la brecha de años se pregunta en el screening, neutral"
    tech = {s["competency"] for s in stages[1]["slots"]}
    assert {"async_python", "rest_api", "llm_rag", "project_deep_dive"} <= tech
    assert not any("technical_knowledge" in s["formats"] for s in rec), "el recruiter screen no es un examen técnico"
    assert all(s["formats"] == ["exercise"] and s["max_followups"] == 0 for s in stages[3]["slots"])
    assert any(s["competency"] == "client_communication" for s in stages[3]["slots"])
    for s in stages[:3]:
        assert s["est_minutes"] <= s["minutes"][1]


def test_blueprint_non_technical_role_has_no_technical_stage():
    soft = [r for r in REQS if r["kind"] != "technical"]
    stages = bp.build({"is_technical": False, "english_required": False, "company_facts": []}, soft, [])
    assert [s["stage"] for s in stages] == ["recruiter_screen", "behavioral_client"]


def test_blueprint_experience_only_posting_still_gets_technical_stage():
    reqs = [
        {
            "id": "R1",
            "text": "5+ años de React",
            "kind": "experience",
            "competency": "react_experience",
            "priority": "must_have",
        },
        {
            "id": "R2",
            "text": "Liderar un equipo",
            "kind": "soft",
            "competency": "team_leadership",
            "priority": "must_have",
        },
    ]
    stages = bp.build({"is_technical": True, "english_required": False, "company_facts": []}, reqs, [])
    tech = next(s for s in stages if s["stage"] == "technical_screen")
    assert [x["competency"] for x in tech["slots"]] == ["react"] and tech["slots"][0]["requirement_ids"] == ["R1"]


def test_coverage_counts_language_via_english_check():
    stages = [{"stage": "recruiter_screen", "english_check": True}]
    qs = [
        {"id": "Q1", "stage": "recruiter_screen", "source_refs": ["R1"]},
        {"id": "Q2", "stage": "technical_screen", "source_refs": ["R2"]},
    ]
    cov = bp.coverage(stages, REQS, qs)
    assert (
        "R5" in cov["covered"] and set(cov["uncovered"]) == {"R3", "R4"} and cov["matrix"]["R2"] == ["technical_screen"]
    )


def test_sync_rebuilds_stages_from_bank():
    bank = [
        normalize_question(x, i)
        for i, x in enumerate([q(id="Q1"), q(id="Q2", format="logistics", stage="recruiter_screen")])
    ]
    out = bp.sync([], bank)
    assert [(b["stage"], b["question_ids"]) for b in out] == [
        ("recruiter_screen", ["Q2"]),
        ("technical_screen", ["Q1"]),
    ]


# ----------------------------------------------------------------------------- selection


def test_select_prefers_clean_candidate_and_adopts_rewrites():
    c1 = q(
        slot_id="TEC1", text_en="How did you solve the asyncio race condition in KvLite?", candidate_evidence_ids=["E5"]
    )
    c2 = q(
        slot_id="TEC1", text_en="In KvLite, how did you reproduce the lost increments?", candidate_evidence_ids=["E5"]
    )
    c3 = q(slot_id="TEC2", text_en="Explain how you would build a RAG pipeline and how you would evaluate it?")
    crit = {
        i: {
            "clarity": 4,
            "single_focus": 4,
            "non_leading": 4,
            "realism": 4,
            "grounding": 4,
            "level_calibration": 4,
            "issues": [],
            "rewrite_en": "",
            "rewrite_es": "",
        }
        for i in range(3)
    }
    crit[2] = {
        **crit[2],
        "issues": ["doble"],
        "rewrite_en": "Suppose you need document Q&A in a Python service. How would you approach the design?",
        "rewrite_es": "Supongamos…",
    }
    chosen, discarded = select([c1, c2, c3], crit, [KV_LITE])
    by = {c["slot_id"]: c for c in chosen}
    assert by["TEC1"]["text_en"].startswith("In KvLite") and discarded[0]["slot_id"] == "TEC1"
    assert (
        by["TEC2"].get("rewritten")
        and by["TEC2"]["text_en"].startswith("Suppose")
        and not by["TEC2"]["validation"]["issues"]
    )
