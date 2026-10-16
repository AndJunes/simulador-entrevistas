"""Postulaciones: CV + puesto por postulación; las sesiones cuelgan de una postulación.

Revision ID: 0002
Revises: 0001
"""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "applications",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("company", sa.String(120), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("error", sa.Text, nullable=True),
        sa.Column("cv_md", sa.Text, nullable=False),
        sa.Column("cv_source", sa.JSON, nullable=False),
        sa.Column("job_md", sa.Text, nullable=False),
        sa.Column("job_source", sa.JSON, nullable=False),
        sa.Column("candidate_name", sa.String(120), nullable=False),
        sa.Column("interview", sa.JSON, nullable=False),
        sa.Column("requirements", sa.JSON, nullable=False),
        sa.Column("questions", sa.JSON, nullable=False),
        sa.Column("glossary", sa.JSON, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.add_column("sessions", sa.Column("application_id", sa.String(32), nullable=True))
    op.create_index("ix_sessions_application_id", "sessions", ["application_id"])
    op.create_foreign_key("fk_sessions_application", "sessions", "applications", ["application_id"], ["id"],
                          ondelete="CASCADE")
    op.alter_column("sessions", "job", server_default="", existing_type=sa.String(64))


def downgrade():
    op.drop_constraint("fk_sessions_application", "sessions", type_="foreignkey")
    op.drop_index("ix_sessions_application_id", "sessions")
    op.drop_column("sessions", "application_id")
    op.drop_table("applications")
