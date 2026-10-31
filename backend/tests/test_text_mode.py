"""Text mode: without the optional STT stack the API refuses audio clearly and
reports the state in /api/health, instead of failing mid-request."""

import os

os.environ["APP_BOOTSTRAP"] = "0"  # don't sweep or index a real database from tests

from fastapi.testclient import TestClient

from app import main
from app.pipeline import stt


def test_health_reports_stt_state():
    with TestClient(main.app) as client:
        body = client.get("/api/health").json()
    assert "stt" in body


def test_practice_audio_is_rejected_without_stt(monkeypatch):
    monkeypatch.setattr(stt, "available", lambda: False)
    with TestClient(main.app) as client:
        resp = client.post(
            "/api/practice/turns",
            data={"session_id": "s1", "question_id": "q1"},
            files={"audio": ("a.webm", b"fake-audio", "audio/webm")},
        )
    assert resp.status_code == 503
    assert "escrito" in resp.json()["detail"]


def test_mock_audio_is_rejected_without_stt(monkeypatch):
    monkeypatch.setattr(stt, "available", lambda: False)
    with TestClient(main.app) as client:
        resp = client.post(
            "/api/mock/sessions/s1/answer",
            files={"audio": ("a.webm", b"fake-audio", "audio/webm")},
        )
    assert resp.status_code == 503
