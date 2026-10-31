"""Bounded background jobs (generation, evaluations, reports).

A deliberate middle ground for a single-user local tool: entity state lives in
the database (applications and turns carry their own status), SSE progress
stays in memory, and this cap keeps a burst of requests from stacking unbounded
threads on the GPU/LLM path. When every slot is busy the API answers 429
instead of queueing silently; after a restart, sweep_interrupted() turns
orphaned in-flight rows into retryable errors.
"""

import threading

from sqlalchemy import select

MAX_CONCURRENT_JOBS = 6
_slots = threading.BoundedSemaphore(MAX_CONCURRENT_JOBS)


class BusyError(RuntimeError):
    """Every job slot is taken."""


def submit(fn, /, *args) -> None:
    """Runs fn(*args) on a daemon thread, holding one of the bounded slots."""
    if not _slots.acquire(blocking=False):
        raise BusyError("Hay demasiados trabajos en curso. Esperá a que termine alguno.")

    def run():
        try:
            fn(*args)
        finally:
            _slots.release()

    threading.Thread(target=run, daemon=True).start()


def sweep_interrupted(session) -> int:
    """Marks rows left 'in progress' by a dead process as retryable errors."""
    from app.db.models import Application, Turn

    fixed = 0
    for a in session.execute(select(Application).where(Application.status == "generating")).scalars():
        a.status = "error"
        a.error = "La generación se interrumpió por un reinicio. Volvé a generar la postulación."
        fixed += 1
    for t in session.execute(select(Turn).where(Turn.status == "processing")).scalars():
        t.status = "error"
        t.error = "La evaluación se interrumpió por un reinicio. Volvé a intentar."
        fixed += 1
    return fixed
