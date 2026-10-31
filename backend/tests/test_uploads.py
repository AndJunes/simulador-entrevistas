"""Audio uploads: size cap and extension allowlist (the filename is client-controlled)."""

import asyncio
import io

import pytest
from fastapi import HTTPException, UploadFile

from app.api.helpers import MAX_AUDIO_BYTES, save_upload


def _upload(name: str, payload: bytes) -> UploadFile:
    return UploadFile(file=io.BytesIO(payload), filename=name)


def test_accepts_a_normal_audio_file(tmp_path):
    path = asyncio.run(save_upload(_upload("answer.webm", b"x" * 1024)))
    assert path.endswith(".webm")


def test_rejects_non_audio_extensions():
    with pytest.raises(HTTPException) as err:
        asyncio.run(save_upload(_upload("payload.html", b"<svg onload=...>")))
    assert err.value.status_code == 400


def test_rejects_oversized_audio():
    with pytest.raises(HTTPException) as err:
        asyncio.run(save_upload(_upload("big.webm", b"x" * (MAX_AUDIO_BYTES + 1))))
    assert err.value.status_code == 413
