"""DB session. The engine is built lazily: importing the app never needs the
POSTGRES_* variables, so tests and tooling can import modules without a database."""

from collections.abc import Iterator
from contextlib import contextmanager
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import database_url


@lru_cache
def engine() -> Engine:
    return create_engine(database_url(), pool_pre_ping=True, future=True)


@lru_cache
def _session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=engine(), expire_on_commit=False)


@contextmanager
def db() -> Iterator[Session]:
    s = _session_factory()()
    try:
        yield s
        s.commit()
    except Exception:
        s.rollback()
        raise
    finally:
        s.close()
