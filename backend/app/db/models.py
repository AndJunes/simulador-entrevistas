"""Modelo de datos. Se guarda TEXTO: transcripción, métricas, evaluación. Nunca audio."""
import uuid
from datetime import datetime, timezone

from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

EMBED_DIMS = 1024


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _id() -> str:
    return uuid.uuid4().hex


class Base(DeclarativeBase):
    pass


class Application(Base):
    """Una postulación: CV (adaptado) + puesto + lo que la IA generó a partir de ellos. Todo cuelga de acá."""
    __tablename__ = "applications"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_id)
    title: Mapped[str] = mapped_column(String(200), default="Nueva postulación")
    company: Mapped[str] = mapped_column(String(120), default="")
    status: Mapped[str] = mapped_column(String(16), default="draft")   # draft | generating | ready | error
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    cv_md: Mapped[str] = mapped_column(Text, default="")
    cv_source: Mapped[dict] = mapped_column(JSON, default=dict)        # {kind: file|text|url, name}
    job_md: Mapped[str] = mapped_column(Text, default="")
    job_source: Mapped[dict] = mapped_column(JSON, default=dict)
    candidate_name: Mapped[str] = mapped_column(String(120), default="")
    interview: Mapped[dict] = mapped_column(JSON, default=dict)        # type, with, when, evaluates, language
    requirements: Mapped[list] = mapped_column(JSON, default=list)     # [{id: R1, text, cv_evidence, gap}]
    questions: Mapped[list] = mapped_column(JSON, default=list)        # [{id, type, text_es, text_en, guidance, pitch, followup, duration}]
    glossary: Mapped[list] = mapped_column(JSON, default=list)
    # pipeline por etapas
    analysis: Mapped[dict] = mapped_column(JSON, default=dict)          # job_analyzer: nivel, responsabilidades, condiciones…
    evidence: Mapped[list] = mapped_column(JSON, default=list)          # [{id: E1, kind, org, dates, technologies, claims, quote}]
    evidence_map: Mapped[list] = mapped_column(JSON, default=list)      # [{req: R1, coverage, evidence_ids, note, gap}]
    blueprints: Mapped[list] = mapped_column(JSON, default=list)        # [{stage, label, minutes, question_ids, …}]
    company_facts: Mapped[list] = mapped_column(JSON, default=list)     # [{fact, source_quote, confidence}]
    generation_report: Mapped[dict] = mapped_column(JSON, default=dict)
    generator_version: Mapped[str] = mapped_column(String(16), default="v1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class Session(Base):
    """Una sesión: práctica por pregunta, simulacro o videollamada."""
    __tablename__ = "sessions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_id)
    application_id: Mapped[str | None] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=True)
    mode: Mapped[str] = mapped_column(String(16))              # practice | mock | videocall
    lang: Mapped[str] = mapped_column(String(4))
    job: Mapped[str] = mapped_column(String(64), default="")   # legado: la relación vigente es application_id
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(16), default="active")   # active | finished | abandoned
    report: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    turns: Mapped[list["Turn"]] = relationship(back_populates="session", order_by="Turn.created_at")


class Turn(Base):
    """Una respuesta (o un pedido de ayuda) a una pregunta."""
    __tablename__ = "turns"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_id)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), index=True)
    question_id: Mapped[str] = mapped_column(String(16))
    question_text: Mapped[str] = mapped_column(Text)
    question_type: Mapped[str] = mapped_column(String(16))     # star | screening | closing
    lang: Mapped[str] = mapped_column(String(4))
    kind: Mapped[str] = mapped_column(String(16), default="evaluation")   # evaluation | coaching
    is_followup: Mapped[bool] = mapped_column(Boolean, default=False)
    attempt_of: Mapped[str | None] = mapped_column(String(32), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="processing")  # processing | done | error | cancelled
    transcript: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    metrics: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    low_conf_words: Mapped[list | None] = mapped_column(JSON, nullable=True)
    evaluation: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    coaching: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    tts_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    timings: Mapped[dict] = mapped_column(JSON, default=dict)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    input_mode: Mapped[str] = mapped_column(String(8), default="voice")          # voice | written (ejercicio)
    parent_turn_id: Mapped[str | None] = mapped_column(String(32), nullable=True)  # repregunta → turno principal
    feedback_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)    # 1 me sirvió · -1 no me sirvió
    followup_flag: Mapped[str | None] = mapped_column(String(16), nullable=True)   # redundant | useful
    extra: Mapped[dict] = mapped_column(JSON, default=dict)                        # hilo, decisión de repregunta, aclaraciones
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)
    session: Mapped[Session] = relationship(back_populates="turns")


class KnowledgeChunk(Base):
    """Chunk del corpus (knowledge/**/*.md troceado en ##) con su embedding."""
    __tablename__ = "knowledge_chunks"
    id: Mapped[str] = mapped_column(String(300), primary_key=True)   # path#heading
    doc_path: Mapped[str] = mapped_column(String(255), index=True)
    heading: Mapped[str] = mapped_column(String(255))
    interview_type: Mapped[str] = mapped_column(String(16), index=True)
    language: Mapped[str] = mapped_column(String(4), index=True)
    doc_kind: Mapped[str] = mapped_column(String(32))
    sources: Mapped[list] = mapped_column(JSON, default=list)
    text: Mapped[str] = mapped_column(Text)
    content_hash: Mapped[str] = mapped_column(String(64))
    position: Mapped[int] = mapped_column(Integer, default=0)
    embedding = mapped_column(Vector(EMBED_DIMS))
