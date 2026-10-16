"""Contexto de UNA postulación: CV, puesto y banco de preguntas (vienen de la tabla `applications`).

API: cv(), job(), questions(), question(), glossary(), candidate_first_name(), interview_info(), por postulación
vía `for_app(app_id)`. Caché por (id, updated_at): si editás la postulación, se recarga sola.
"""
import re
import threading
from dataclasses import dataclass, field

from app.db.models import Application, Session
from app.db.session import db
from app.generation import blueprint as bp
from app.generation.schema import DEFAULT_DURATION, normalize_question  # noqa: F401  (re-export)

# Términos técnicos frecuentes: si aparecen en el CV o el puesto, se le pasan a Whisper como pista.
COMMON_TERMS = ["Python", "FastAPI", "PostgreSQL", "SQLAlchemy", "Alembic", "Redis", "Rust", "Go", "Node.js",
                "NestJS", "TypeScript", "JavaScript", "React", "Angular", "Next.js", "Docker", "Kubernetes", "AWS",
                "GCP", "Azure", "Cloud Run", "Pub/Sub", "Kafka", "gRPC", "GraphQL", "REST", "JWT", "OAuth", "RBAC",
                "pytest", "CI/CD", "LLM", "RAG", "Terraform", "MongoDB", "Prisma", "Solidity", "EVM", "Tokio"]


@dataclass
class AppContext:
    id: str
    title: str
    company: str
    candidate: str
    cv_md: str
    job_md: str
    interview: dict
    requirements: list
    bank: list
    extra_terms: list = field(default_factory=list)
    evidence: list = field(default_factory=list)
    evidence_map: list = field(default_factory=list)
    blueprints: list = field(default_factory=list)
    analysis: dict = field(default_factory=dict)
    company_facts: list = field(default_factory=list)

    # --- API pública del contexto
    def cv(self) -> str:
        return self.cv_md

    def job(self) -> str:
        """El puesto tal como lo ve el evaluador: el aviso + los requisitos con ID (R1…)."""
        reqs = "\n".join(f"| {r['id']} | {r.get('text', '')} | {r.get('priority', '')} | {r.get('coverage', '')} | {r.get('cv_evidence', '')} |"
                         for r in self.requirements)
        head = f"# Puesto — {self.title}{f' · {self.company}' if self.company else ''}\n\n"
        return head + self.job_md + (f"\n\n## Requisitos (IDs para trazabilidad)\n| ID | Requisito | Prioridad | Cobertura en el CV | Evidencia en el CV |\n|---|---|---|---|---|\n{reqs}\n" if reqs else "")

    def evidence_digest(self) -> str:
        """Evidencias del CV con su tipo (profesional, proyecto…): el evaluador separa experiencia de conocimiento."""
        return "\n".join(f"- {e['id']} [{e.get('kind', '')}] {e.get('title', '')} ({e.get('org', '')}, {e.get('dates', '')}): "
                         f"tecnologías {', '.join(e.get('technologies', []))}" for e in self.evidence)

    def stage(self, stage: str) -> dict | None:
        return next((b for b in self.blueprints if b.get("stage") == stage), None)

    def questions(self) -> list[dict]:
        return self.bank

    def question(self, qid: str) -> dict:
        q = next((x for x in self.bank if x["id"] == qid), None)
        if not q:
            raise KeyError(qid)
        return q

    def glossary(self) -> list[str]:
        blob = self.cv_md + "\n" + self.job_md
        terms = [t for t in COMMON_TERMS if re.search(rf"(?<![\w]){re.escape(t)}(?![\w])", blob, re.I)] + list(self.extra_terms)
        if self.company:
            terms.append(self.company)
        return list(dict.fromkeys(terms))[:60]

    def candidate_first_name(self) -> str:
        return (self.candidate or "").split(" ")[0]

    def interview_info(self) -> dict:
        return {"title": self.title, "company": self.company, **(self.interview or {})}


def in_lang(q: dict, lang: str) -> dict:
    return dict(q, text=q.get(f"text_{lang}") or q.get("text_en") or q.get("text_es", ""))


_cache: dict[str, tuple] = {}
_lock = threading.Lock()


def for_app(app_id: str) -> AppContext:
    with db() as s:
        a = s.get(Application, app_id)
        if not a:
            raise KeyError(f"postulación {app_id} inexistente")
        stamp = a.updated_at
        with _lock:
            hit = _cache.get(app_id)
            if hit and hit[0] == stamp:
                return hit[1]
        ctx = AppContext(id=a.id, title=a.title, company=a.company, candidate=a.candidate_name, cv_md=a.cv_md,
                         job_md=a.job_md, interview=a.interview or {}, requirements=a.requirements or [],
                         bank=(bank := [normalize_question(q, i) for i, q in enumerate(a.questions or [])]),
                         extra_terms=a.glossary or [], evidence=a.evidence or [], evidence_map=a.evidence_map or [],
                         blueprints=bp.sync(a.blueprints or [], bank), analysis=a.analysis or {},
                         company_facts=a.company_facts or [])
    with _lock:
        _cache[app_id] = (stamp, ctx)
    return ctx


def for_session(session_id: str) -> AppContext:
    with db() as s:
        sess = s.get(Session, session_id)
        if not sess or not sess.application_id:
            raise KeyError(f"la sesión {session_id} no tiene postulación")
        app_id = sess.application_id
    return for_app(app_id)


# ----------------------------------------------------------------------------- migración del formato viejo

def parse_legacy_job(md: str) -> dict:
    """Lee el formato legado en Markdown (tabla de preguntas y requisitos) para migrarlo sin gastar LLM."""
    qs = []
    for line in md.splitlines():
        m = re.match(r"^\|\s*(Q\d+)\s*\|(.+?)\|(.+?)\|\s*(screening|star)\s*\|(?:(.+?)\|)?", line)
        if m:
            qs.append({"id": m.group(1), "text_en": m.group(2).strip(), "guidance": m.group(3).strip(),
                       "type": m.group(4), "text_es": (m.group(5) or m.group(2)).strip()})
    for q in qs:   # en el formato legado: Q1 es el pitch; Q8/Q9 (logística, otros procesos) no llevan repregunta
        q["pitch"] = q["id"] == "Q1"
        q["followup"] = q["id"] not in ("Q8", "Q9")
        q["duration"] = [60, 90] if q["pitch"] else DEFAULT_DURATION[q["type"]]
    reqs = []
    for line in md.splitlines():
        m = re.match(r"^\|\s*(R\d+)\s*\|(.+?)\|(.+?)\|", line)
        if m:
            reqs.append({"id": m.group(1), "text": m.group(2).strip(), "cv_evidence": m.group(3).strip()})
    def line(label):
        m = re.search(rf"\*\*{label}:\*\*\s*(.+)", md)
        return m.group(1).strip() if m else None
    title = (re.search(r"^# Puesto — (.+)$", md, re.M) or [None, "Puesto"])[1]
    return {"title": title, "questions": qs, "requirements": reqs,
            "interview": {"type": line("Tipo"), "with": line("Con"), "when": line("Cuándo"),
                          "evaluates": line("Qué evalúa"), "language": line("Idioma probable")}}
