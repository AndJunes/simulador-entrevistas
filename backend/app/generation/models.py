"""Esquemas estructurados (JSON estricto) de cada etapa del pipeline de generación."""
from typing import Literal

from pydantic import BaseModel

Priority = Literal["must_have", "important", "nice_to_have"]
ReqKind = Literal["technical", "soft", "experience", "language", "education", "logistics"]
EvidenceKind = Literal["professional", "freelance", "project", "academic", "hackathon", "volunteer"]
Format = Literal["biographical", "motivation", "behavioral", "situational", "technical_knowledge", "debugging",
                 "design", "exercise", "logistics"]


# ----------------------------------------------------------------------------- 1. job_analyzer

class JobRequirement(BaseModel):
    text: str                    # el requisito, en español, breve
    kind: ReqKind
    competency: str              # slug en inglés, una competencia (p. ej. async_python, sql_postgres, communication)
    competency_label: str        # etiqueta en español
    priority: Priority
    source_quote: str            # cita textual del aviso que lo respalda


class CompanyFact(BaseModel):
    fact: str                    # en español
    source_quote: str            # cita textual del texto recibido
    confidence: Literal["alta", "media", "baja"]


class InterviewInfo(BaseModel):
    type: str
    interviewer: str
    when: str
    evaluates: str
    language: str


class JobAnalysis(BaseModel):
    title: str
    company: str
    seniority: Literal["intern", "junior", "mid", "senior", "lead", "unknown"]
    role_family: Literal["backend", "frontend", "fullstack", "data", "ai_ml", "devops", "mobile", "qa", "non_technical", "other"]
    is_technical: bool
    responsibilities: list[str]
    requirements: list[JobRequirement]
    conditions: list[str]            # modalidad, contrato, horario, ubicación (logística)
    english_required: bool
    language_notes: str
    interview: InterviewInfo
    company_facts: list[CompanyFact]
    listed_questions: list[str]      # preguntas que las notas de preparación ya listan (textuales)
    ambiguities: list[str]           # datos contradictorios o faltantes del aviso


# ----------------------------------------------------------------------------- 2. resume_evidence_extractor

class EvidenceItem(BaseModel):
    title: str                   # proyecto o puesto
    kind: EvidenceKind
    org: str
    dates: str                   # tal como figuran ("" si no hay)
    technologies: list[str]      # SOLO las que el CV asocia a ESTA experiencia
    responsibilities: list[str]
    achievements: list[str]      # con números solo si el CV los dice
    quote: str                   # cita textual del CV


class ResumeEvidence(BaseModel):
    candidate_name: str
    professional_summary: str    # tiempo profesional por área, tal como surge de las fechas (sin redondear hacia arriba)
    evidence: list[EvidenceItem]
    ambiguities: list[str]       # datos del CV ambiguos → preguntas aclaratorias, no hechos


# ----------------------------------------------------------------------------- 3. evidence_map

class MapItem(BaseModel):
    req_id: str
    coverage: Literal["strong", "partial", "gap"]
    evidence_ids: list[str]
    note: str                    # qué demuestra la evidencia (español)
    gap: str                     # qué falta ("" si nada)


class EvidenceMap(BaseModel):
    items: list[MapItem]
    years_vs_competence: str     # años profesionales verificables vs. competencia demostrada, por separado


# ----------------------------------------------------------------------------- 5. question_generator

class Trigger(BaseModel):
    if_missing: str
    ask: str


class Hints(BaseModel):
    structure: str
    cv_examples: list[str]
    watch_out: str


class ExerciseSpec(BaseModel):
    brief: str
    deliverable: str
    criteria: list[str]
    constraints: list[str]
    reference_facts: list[str]   # datos que el entrevistador puede dar si preguntan
    minutes: int


class GenQuestion(BaseModel):
    slot_id: str
    format: Format
    text_en: str
    text_es: str
    primary_competency: str
    competency_label: str
    secondary_competencies: list[str]
    priority: Priority
    difficulty: Literal["basic", "intermediate", "advanced"]
    evidence_mode: Literal["past_behavior", "explanatory_knowledge", "live_execution", "situational_judgment"]
    objective: str
    relevance: str
    candidate_evidence_ids: list[str]
    known_gaps: list[str]
    source_refs: list[str]
    expected_evidence: list[str]
    weak_indicators: list[str]
    followup_triggers: list[Trigger]
    max_followups: int
    hints: Hints
    duration_min: int
    duration_max: int
    confidence: float
    exercise: ExerciseSpec


class GenBatch(BaseModel):
    candidates: list[GenQuestion]


# ----------------------------------------------------------------------------- 6. question_validator (crítica)

class Critique(BaseModel):
    candidate: int               # índice de la candidata
    clarity: int
    single_focus: int
    non_leading: int
    realism: int
    grounding: int
    level_calibration: int
    issues: list[str]            # en español
    rewrite_en: str              # "" si no hace falta
    rewrite_es: str


class CritiqueBatch(BaseModel):
    critiques: list[Critique]
