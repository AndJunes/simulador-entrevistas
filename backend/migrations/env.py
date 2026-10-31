"""Alembic: toma la URL de la base desde .env (nunca hardcodeada)."""

from alembic import context
from sqlalchemy import create_engine

from app.core.config import database_url
from app.db.models import Base

target_metadata = Base.metadata


def run_migrations_online():
    engine = create_engine(database_url())
    with engine.connect() as conn:
        context.configure(connection=conn, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


run_migrations_online()
