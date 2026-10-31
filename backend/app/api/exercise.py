"""Written exercise (work sample): clarifying questions and submission."""

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from app.api.helpers import get_app
from app.api.schemas import ClarifyReq, NewExercise, SubmitReq
from app.db.session import db
from app.services import exercise

router = APIRouter(prefix="/api", tags=["exercise"])


@router.post("/exercise/sessions")
def new_exercise_session(req: NewExercise):
    if req.lang not in ("es", "en"):
        raise HTTPException(400, "idioma inválido")
    with db() as s:
        get_app(s, req.application_id)
    return exercise.start(req.application_id, req.lang)


@router.post("/exercise/sessions/{sid}/clarify")
async def exercise_clarify(sid: str, req: ClarifyReq):
    try:
        return await run_in_threadpool(exercise.clarify, sid, req.question_id, req.question)
    except KeyError:
        raise HTTPException(404, "sesión o ejercicio inexistente") from None
    except ValueError as e:
        raise HTTPException(422, str(e)) from None


@router.post("/exercise/sessions/{sid}/submit")
def exercise_submit(sid: str, req: SubmitReq):
    try:
        return {"turn_id": exercise.submit(sid, req.question_id, req.text, req.elapsed_s)}
    except KeyError:
        raise HTTPException(404, "sesión o ejercicio inexistente") from None
    except ValueError as e:
        raise HTTPException(422, str(e)) from None
