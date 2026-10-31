"""Structured schemas (strict JSON) for each stage of the generation pipeline."""

from typing import Literal

from pydantic import BaseModel

Priority = Literal["must_have", "important", "nice_to_have"]
ReqKind = Literal["technical", "soft", "experience", "language", "education", "logistics"]
EvidenceKind = Literal["professional", "freelance", "project", "academic", "hackathon", "volunteer"]
Format = Literal[
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


# ----------------------------------------------------------------------------- 1. job_analyzer


class JobRequirement(BaseModel):
    text: str  # the requirement, in Spanish, brief
    kind: ReqKind
    competency: str  # English slug, one competency (e.g. async_python, sql_postgres, communication)
    competency_label: str  # Spanish label
    priority: Priority
    source_quote: str  # verbatim quote from the posting that backs it


class CompanyFact(BaseModel):
    fact: str  # in Spanish
    source_quote: str  # verbatim quote from the received text
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
    role_family: Literal[
        "backend", "frontend", "fullstack", "data", "ai_ml", "devops", "mobile", "qa", "non_technical", "other"
    ]
    is_technical: bool
    responsibilities: list[str]
    requirements: list[JobRequirement]
    conditions: list[str]  # modality, contract, schedule, location (logistics)
    english_required: bool
    language_notes: str
    interview: InterviewInfo
    company_facts: list[CompanyFact]
    listed_questions: list[str]  # questions the prep notes already list (verbatim)
    ambiguities: list[str]  # contradictory or missing data in the posting


# ----------------------------------------------------------------------------- 2. resume_evidence_extractor


class EvidenceItem(BaseModel):
    title: str  # project or position
    kind: EvidenceKind
    org: str
    dates: str  # as stated ("" if absent)
    technologies: list[str]  # ONLY those the CV ties to THIS experience
    responsibilities: list[str]
    achievements: list[str]  # with numbers only if the CV states them
    quote: str  # verbatim quote from the CV


class ResumeEvidence(BaseModel):
    candidate_name: str
    professional_summary: str  # professional time by area, as the dates show it (no rounding up)
    evidence: list[EvidenceItem]
    ambiguities: list[str]  # ambiguous CV data → clarifying questions, not facts


# ----------------------------------------------------------------------------- 3. evidence_map


class MapItem(BaseModel):
    req_id: str
    coverage: Literal["strong", "partial", "gap"]
    evidence_ids: list[str]
    note: str  # what the evidence demonstrates (Spanish)
    gap: str  # what's missing ("" if nothing)


class EvidenceMap(BaseModel):
    items: list[MapItem]
    years_vs_competence: str  # verifiable professional years vs. demonstrated competence, separately


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
    reference_facts: list[str]  # details the interviewer may disclose if asked
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


# ----------------------------------------------------------------------------- 6. question_validator (critique)


class Critique(BaseModel):
    candidate: int  # candidate index
    clarity: int
    single_focus: int
    non_leading: int
    realism: int
    grounding: int
    level_calibration: int
    issues: list[str]  # in Spanish
    rewrite_en: str  # "" if not needed
    rewrite_es: str


class CritiqueBatch(BaseModel):
    critiques: list[Critique]
