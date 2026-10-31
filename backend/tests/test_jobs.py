"""Bounded background jobs: the slot cap, and the restart sweep that turns
orphaned in-flight rows into retryable errors."""

import threading

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session as OrmSession

from app.core import jobs
from app.db.models import Application, Session, Turn


def test_submit_runs_the_job_and_releases_the_slot():
    done = threading.Event()
    jobs.submit(done.set)
    assert done.wait(2)


def test_overflow_answers_busy_instead_of_stacking_threads():
    gate = threading.Event()
    started = []

    def hold():
        started.append(1)
        gate.wait(5)

    try:
        for _ in range(jobs.MAX_CONCURRENT_JOBS):
            jobs.submit(hold)
        with pytest.raises(jobs.BusyError):
            jobs.submit(hold)
    finally:
        gate.set()


def test_sweep_marks_interrupted_rows_as_retryable_errors():
    engine = create_engine("sqlite://")
    for table in (Application.__table__, Session.__table__, Turn.__table__):
        table.create(engine)
    with OrmSession(engine) as s:
        s.add(Application(id="a" * 32, status="generating"))
        s.add(Application(id="b" * 32, status="ready"))
        s.add(Session(id="s" * 32, mode="practice", lang="es"))
        s.add(
            Turn(
                id="t" * 32,
                session_id="s" * 32,
                question_id="q1",
                question_text="x",
                question_type="star",
                lang="es",
                status="processing",
            )
        )
        s.flush()

        assert jobs.sweep_interrupted(s) == 2
        assert s.get(Application, "a" * 32).status == "error"
        assert s.get(Application, "b" * 32).status == "ready"
        assert s.get(Turn, "t" * 32).status == "error"
