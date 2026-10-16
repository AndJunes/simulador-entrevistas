"""Lógica del evaluador, del modo en blanco, del corpus y del grafo del simulacro (sin red: proveedores falsos)."""
import pytest

from app.interview import graph as g
from app.pipeline import coach, evaluator
from app.rag import corpus
from app.services import context


def test_criteria_es_uses_clarity_not_english():
    ids = evaluator.criteria_for("screening", "es")
    assert "communication_clarity" in ids and "communication_english" not in ids


def _ev(crit, **kw):
    base = dict(feed_up="", criteria=crit, job_requirements_addressed=["R4 (parcial)", "R1"],
                job_requirements_missed=["R4", "R7 (inglés)"], unsupported_claims_vs_cv=[], red_flags=[],
                strengths=["a", ""], model_answer="", spoken_summary="", annotations=[],
                improvements=[evaluator.Improvement(issue="", why="", example="")], confidence="alta",
                competency=evaluator.CompetencyScore(id="x", label="X", score=3, evidence_level="proyecto",
                                                     confidence="media", rationale=""),
                evidence_check=[], experience_claims=[], facts=[], inferences=[],
                not_demonstrated=[], provisional_assessment="", next_practice_followup="", recommended_exercise="",
                uncertainty="")
    return evaluator.Evaluation(**{**base, **kw})


def test_normalize_reorders_cleans_and_requires_all():
    ids = evaluator.criteria_for("star", "es")
    crit = [evaluator.Criterion(id=i, applicable=False, score=3, evidence_quote="", justification="x", missing="", ideal="")
            for i in reversed(ids)]
    out = evaluator.normalize(_ev(crit), ids)
    assert [c.id for c in out.criteria] == ids
    assert out.job_requirements_addressed == ["R1", "R4"] and out.job_requirements_missed == ["R7"]
    assert out.improvements == [] and out.strengths == ["a"]
    # solo los criterios opcionales pueden quedar "no aplica"
    na = {c.id for c in out.criteria if not c.applicable}
    assert na == {"learning", "decisions_tradeoffs"} and "star_action" not in na
    with pytest.raises(ValueError):
        evaluator.normalize(_ev(crit[:2]), ids)


def test_scored_criteria_skips_not_applicable():
    ev = {"criteria": [{"id": "a", "score": 2, "applicable": False}, {"id": "b", "score": 4}]}
    assert [c["id"] for c in evaluator.scored_criteria(ev)] == ["b"]


def test_criteria_sets_per_type():
    assert evaluator.criteria_for("technical", "en")[0] == "technical_correctness"
    assert "written_communication" in evaluator.criteria_for("exercise", "es")
    assert "motivation_company_knowledge" not in evaluator.criteria_for("logistics", "es")
    assert evaluator.RUBRIC_DOC["logistics"] == "screening" and "logistics" in evaluator.NOT_SCORED_TYPES


@pytest.mark.parametrize("text,n,lang,blank", [
    ("", 0, "es", True),
    ("uh I don't know, sorry", 5, "en", True),
    ("no sé, me quedé en blanco", 6, "es", True),
    ("En Turnero construí el backend y tres módulos en Python para el pago de reservas", 15, "es", False),
])
def test_looks_blank(text, n, lang, blank):
    assert bool(coach.looks_blank(text, n, lang)) is blank


def test_rubrics_match_app_criteria():
    for t in ("star", "screening", "logistics", "technical", "exercise"):
        for lang in ("es", "en"):
            r = corpus.rubric_text(evaluator.RUBRIC_DOC[t], lang)
            assert r, f"falta rúbrica {t}/{lang}"
            for cid in evaluator.criteria_for(t, lang):
                assert f"## {cid}" in r, f"{cid} no aparece en {t}/{lang}"
            assert "Junior Backend Engineer (Node.js/Rust)" not in r   # rúbricas genéricas, no de una postulación


def test_corpus_chunks_have_metadata():
    docs = list(corpus.iter_docs())
    assert docs
    for path, meta, body in docs:
        for c in corpus.chunks_of(path, meta, body):
            assert c["interview_type"] in {"star", "screening", "comun", "technical", "work_sample"} and c["language"] in {"es", "en"}


# ----------------------------------------------------------------------------- postulación de prueba (sin DB)

BANK = [
    {"id": "Q1", "type": "screening", "text_es": "Contame un poco sobre vos.", "text_en": "Tell me about yourself",
     "guidance": "pitch", "pitch": True, "followup": True, "duration": [60, 90]},
    {"id": "Q2", "type": "screening", "text_es": "¿Por qué Acme?", "text_en": "Why Acme?", "guidance": "", "pitch": False, "followup": True},
    {"id": "Q4", "type": "star", "text_es": "Contame de un proyecto de backend.", "text_en": "Walk me through a backend project",
     "guidance": "", "pitch": False, "followup": True},
    {"id": "Q5", "type": "star", "text_es": "Un bug que resolviste.", "text_en": "A bug you solved", "guidance": "", "pitch": False, "followup": True},
    {"id": "Q8", "type": "screening", "text_es": "¿Disponibilidad?", "text_en": "Availability?", "guidance": "", "pitch": False, "followup": False},
]


def fake_ctx():
    return context.AppContext(id="app1", title="Backend Engineer", company="Acme", candidate="Ana Pérez", cv_md="# Ana\nPython, Rust",
                              job_md="Backend role", interview={}, requirements=[{"id": "R1", "text": "Rust", "cv_evidence": ""}],
                              bank=[context.normalize_question(q, i) for i, q in enumerate(BANK)])


def test_app_context_api():
    c = fake_ctx()
    assert c.candidate_first_name() == "Ana" and c.question("Q8")["followup"] is False
    assert "| R1 |" in c.job() and "Rust" in c.glossary() and "Acme" in c.glossary()
    assert context.in_lang(c.question("Q4"), "es")["text"].startswith("Contame")


def test_glossary_uses_word_boundaries():
    c = fake_ctx()
    c.cv_md = "Trabajé con Google Cloud"   # "Go" no debe aparecer por estar dentro de "Google"
    assert "Go" not in c.glossary()


def test_legacy_job_parser():
    md = "# Puesto — X\n**Cuándo:** martes\n| Q1 | Tell me | pitch | screening | Contame |\n| Q8 | Rate? | logística | screening | ¿Tarifa? |\n| R1 | Python | FastAPI |"
    d = context.parse_legacy_job(md)
    assert [q["id"] for q in d["questions"]] == ["Q1", "Q8"] and d["questions"][0]["pitch"] and not d["questions"][1]["followup"]
    assert d["requirements"][0]["id"] == "R1" and d["interview"]["when"] == "martes"


def _decision(ask: bool, q="¿Y el número?"):
    return g.FollowupDecision(covered_evidence=["rol propio"], missing_evidence=["resultado"] if ask else [],
                              ask_followup=ask, reason="", followup_question=q if ask else "", skip_reason="" if ask else "ya está")


def _run(monkeypatch, decide, plan=None, lang="es"):
    monkeypatch.setattr(g, "decide_followup", decide)
    monkeypatch.setattr(context, "for_app", lambda app_id: fake_ctx())
    from langgraph.types import Command
    app = g.build()
    cfg = {"configurable": {"thread_id": f"t-{id(decide)}-{lang}"}}
    plan = plan or [{"qid": "Q1", "lang": lang}, {"qid": "Q4", "lang": lang}, {"qid": "Q8", "lang": lang}]
    r = app.invoke({"session_id": "s", "application_id": "app1", "lang": lang, "stage": "recruiter_screen", "minutes": 15,
                    "plan": plan, "idx": 0, "threads": {}, "log": []}, cfg)
    said = [r["__interrupt__"][0].value["say"]]
    while "__interrupt__" in r:
        r = app.invoke(Command(resume={"text": "respuesta", "turn_id": f"t{len(said)}"}), cfg)
        if "__interrupt__" in r:
            said.append(r["__interrupt__"][0].value["say"])
    return said, r, app.get_state(cfg).values


def test_mock_graph_without_followups(monkeypatch):
    said, final, st = _run(monkeypatch, lambda q, th, lang: _decision(False))
    assert said[0].startswith("Hola Ana") and "Acme" in said[0] and "Contame un poco sobre vos" in said[0]
    assert "proyecto de backend" in said[1]
    assert said[-1] == g.T["es"]["closing"]
    assert final["finished"] and len(said) == 4
    # se registró que no hacía falta repreguntar (salto justificado)
    assert st["threads"]["Q1"]["decisions"][0]["ask"] is False and st["threads"]["Q1"]["closed"]


def test_mock_graph_up_to_max_followups(monkeypatch):
    said, final, st = _run(monkeypatch, lambda q, th, lang: _decision(True))
    # Q1, Q4 y Q8 (formato viejo → máx. 2 c/u, la logística vieja sin repregunta = 0): 1+2 + 1+2 + 1 + cierre
    assert said.count("¿Y el número?") == 4 and len(said) == 8 and final["finished"]
    assert st["threads"]["Q4"]["followups"] == 2 and len(st["threads"]["Q4"]["answers"]) == 3


def test_mock_graph_followup_stops_when_covered(monkeypatch):
    calls = []

    def decide(q, th, lang):
        calls.append(len(th["answers"]))
        return _decision(len(th["answers"]) == 1)   # repregunta una vez y después ya está cubierto
    said, final, st = _run(monkeypatch, decide)
    assert said.count("¿Y el número?") == 2 and st["threads"]["Q4"]["decisions"][-1]["ask"] is False


def test_mock_graph_mixed_language_switches(monkeypatch):
    plan = [{"qid": "Q1", "lang": "es"}, {"qid": "Q4", "lang": "en"}]
    said, final, st = _run(monkeypatch, lambda q, th, lang: _decision(False), plan=plan, lang="mix")
    assert said[0].startswith("Hola") and g.SWITCH_EN in said[1] and "Walk me through a backend project" in said[1]
    assert said[-1] == g.T["en"]["closing"]


def test_build_plan_by_stage_and_mixed():
    from app.services.mock import build_plan
    c = fake_ctx()
    c.blueprints = context.bp.sync([], c.questions())
    plan = build_plan(c, "recruiter_screen", "es")
    assert [p["qid"] for p in plan] == ["Q1", "Q2", "Q4", "Q5", "Q8"]
    mixed = build_plan(c, "recruiter_screen", "mix")
    assert [p["lang"] for p in mixed] == ["es", "es", "es", "en", "en"]


def test_thread_inputs_joins_answers():
    from app.services.mock import thread_inputs
    tr, convo = thread_inputs({"answers": [{"question": "Q", "text": "uno", "is_followup": False},
                                           {"question": "F", "text": "(silencio)", "is_followup": True},
                                           {"question": "F2", "text": "dos", "is_followup": True}]})
    assert tr == "uno\n\ndos" and [m["role"] for m in convo] == ["interviewer", "candidate"] * 2


def test_report_aggregates_exclude_logistics_and_not_applicable():
    from app.services.mock import aggregates
    comp = lambda i, s: {"id": i, "label": i, "score": s, "evidence_level": "proyecto", "scored": True}  # noqa: E731
    rows = [{"type": "star", "evaluation": {"criteria": [{"id": "a", "score": 4}, {"id": "b", "score": 1, "applicable": False}],
                                             "competency": comp("debugging", 4)}},
            {"type": "logistics", "evaluation": {"criteria": [{"id": "a", "score": 1}], "competency": comp("logistics", 1)}}]
    agg = aggregates(rows, [])
    assert agg["criteria"] == {"a": {"avg": 4, "label": "a"}} and list(agg["competencies"]) == ["debugging"]


def test_clean_questions_keeps_ids_and_assigns_new():
    from app.services.applications import clean_questions
    out = clean_questions([{"id": "Q4", "text_es": "a", "type": "star"}, {"text_es": "nueva"}, {"text_es": "  "},
                           {"id": "Q4", "text_es": "duplicada"}])
    assert [q["id"] for q in out] == ["Q4", "Q5", "Q6"] and out[1]["type"] == "screening"


def test_written_answer_skips_voice_metrics():
    from app.services.turns import written_answer
    a = written_answer("  Usaría asyncio.gather con un semáforo.  ")
    assert a["has_speech"] and a["metrics"] is None and a["transcript"] == {"text": "Usaría asyncio.gather con un semáforo.", "words": []}
    assert written_answer("   ")["has_speech"] is False
