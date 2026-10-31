"""Request bodies for the HTTP API."""

from pydantic import BaseModel


class NewApplication(BaseModel):
    cv_md: str
    job_md: str
    cv_source: dict = {}
    job_source: dict = {}


class PatchApplication(BaseModel):
    title: str | None = None
    company: str | None = None
    candidate_name: str | None = None
    cv_md: str | None = None
    job_md: str | None = None
    cv_source: dict | None = None
    job_source: dict | None = None
    interview: dict | None = None
    questions: list[dict] | None = None
    requirements: list[dict] | None = None


class TTSReq(BaseModel):
    text: str
    lang: str = "es"
    role: str = "interviewer"


class NewSession(BaseModel):
    application_id: str
    mode: str = "practice"
    lang: str = "es"
    settings: dict = {}
    stage: str = "recruiter_screen"


class Rating(BaseModel):
    rating: int | None = None  # 1 helpful · -1 not helpful · None clears it


class FollowupFlag(BaseModel):
    flag: str | None = None  # redundant | useful | None


class NewExercise(BaseModel):
    application_id: str
    lang: str = "es"


class ClarifyReq(BaseModel):
    question_id: str
    question: str


class SubmitReq(BaseModel):
    question_id: str
    text: str
    elapsed_s: float | None = None
