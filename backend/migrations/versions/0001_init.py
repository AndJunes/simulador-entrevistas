"""Esquema inicial: sesiones, turnos y chunks del corpus con pgvector.

Revision ID: 0001
"""
import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.create_table(
        "sessions",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("mode", sa.String(16), nullable=False),
        sa.Column("lang", sa.String(4), nullable=False),
        sa.Column("job", sa.String(64), nullable=False),
        sa.Column("settings", sa.JSON, nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("report", sa.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "turns",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("session_id", sa.String(32), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_id", sa.String(16), nullable=False),
        sa.Column("question_text", sa.Text, nullable=False),
        sa.Column("question_type", sa.String(16), nullable=False),
        sa.Column("lang", sa.String(4), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("is_followup", sa.Boolean, nullable=False),
        sa.Column("attempt_of", sa.String(32), nullable=True),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("transcript", sa.JSON, nullable=True),
        sa.Column("metrics", sa.JSON, nullable=True),
        sa.Column("low_conf_words", sa.JSON, nullable=True),
        sa.Column("evaluation", sa.JSON, nullable=True),
        sa.Column("coaching", sa.JSON, nullable=True),
        sa.Column("tts_key", sa.String(64), nullable=True),
        sa.Column("timings", sa.JSON, nullable=False),
        sa.Column("cost_usd", sa.Float, nullable=False),
        sa.Column("error", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_turns_session_id", "turns", ["session_id"])
    op.create_index("ix_turns_created_at", "turns", ["created_at"])
    op.create_table(
        "knowledge_chunks",
        sa.Column("id", sa.String(300), primary_key=True),
        sa.Column("doc_path", sa.String(255), nullable=False),
        sa.Column("heading", sa.String(255), nullable=False),
        sa.Column("interview_type", sa.String(16), nullable=False),
        sa.Column("language", sa.String(4), nullable=False),
        sa.Column("doc_kind", sa.String(32), nullable=False),
        sa.Column("sources", sa.JSON, nullable=False),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("position", sa.Integer, nullable=False),
        sa.Column("embedding", Vector(1024)),
    )
    op.create_index("ix_kc_doc_path", "knowledge_chunks", ["doc_path"])
    op.create_index("ix_kc_type_lang", "knowledge_chunks", ["interview_type", "language"])
    op.execute("CREATE INDEX ix_kc_embedding_hnsw ON knowledge_chunks USING hnsw (embedding vector_cosine_ops)")


def downgrade():
    op.drop_table("knowledge_chunks")
    op.drop_table("turns")
    op.drop_table("sessions")
