"""Preguntas por competencia: análisis del puesto, evidencia del CV, blueprints por etapa,
reporte de generación; en turnos, utilidad del feedback, repregunta redundante y datos extra (hilos, ejercicio).

Revision ID: 0003
Revises: 0002
"""
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

APP_JSON = ["analysis", "evidence", "evidence_map", "blueprints", "company_facts", "generation_report"]


def upgrade():
    for col in APP_JSON:
        default = "[]" if col in ("evidence", "evidence_map", "blueprints", "company_facts") else "{}"
        op.add_column("applications", sa.Column(col, sa.JSON, nullable=False, server_default=default))
    op.add_column("applications", sa.Column("generator_version", sa.String(16), nullable=False, server_default="v1"))
    op.add_column("turns", sa.Column("input_mode", sa.String(8), nullable=False, server_default="voice"))
    op.add_column("turns", sa.Column("parent_turn_id", sa.String(32), nullable=True))
    op.add_column("turns", sa.Column("feedback_rating", sa.Integer, nullable=True))       # 1 me sirvió · -1 no
    op.add_column("turns", sa.Column("followup_flag", sa.String(16), nullable=True))      # redundant | useful
    op.add_column("turns", sa.Column("extra", sa.JSON, nullable=False, server_default="{}"))


def downgrade():
    for col in ("extra", "followup_flag", "feedback_rating", "parent_turn_id", "input_mode"):
        op.drop_column("turns", col)
    for col in APP_JSON + ["generator_version"]:
        op.drop_column("applications", col)
