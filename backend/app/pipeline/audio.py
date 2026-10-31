"""Audio: conversion to 16 kHz WAV, speech/silence detection with a RELATIVE threshold, and
trailing-silence trimming (prevents Whisper hallucinations)."""

import subprocess
import wave
from pathlib import Path

import numpy as np

FRAME_S = 0.02


def to_wav16k(src: str, dst: str) -> str:
    """Any audio (browser webm/opus, m4a, wav) → mono 16 kHz 16-bit WAV."""
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-ac", "1", "-ar", "16000", "-sample_fmt", "s16", dst],
        check=True,
    )
    return dst


def load_wav(path: str) -> tuple[np.ndarray, int]:
    with wave.open(path, "rb") as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    return x, sr


def frame_db(x: np.ndarray, sr: int) -> np.ndarray:
    n = int(FRAME_S * sr)
    if len(x) < n:
        return np.array([-100.0])
    frames = x[: len(x) // n * n].reshape(-1, n)
    return 20 * np.log10(np.sqrt((frames**2).mean(axis=1) + 1e-12))


def _runs(mask: np.ndarray):
    out, start = [], 0
    for i in range(1, len(mask) + 1):
        if i == len(mask) or mask[i] != mask[start]:
            out.append((bool(mask[start]), start, i))
            start = i
    return out


def _close(mask, k):
    m = mask.copy()
    for val, a, b in _runs(m):
        if not val and 0 < a and b < len(m) and b - a < k:
            m[a:b] = True
    return m


def _open(mask, k):
    m = mask.copy()
    for val, a, b in _runs(m):
        if val and b - a < k:
            m[a:b] = False
    return m


def speech_mask(db: np.ndarray) -> tuple[np.ndarray, float]:
    floor, speech = np.percentile(db, 10), np.percentile(db, 90)
    if speech - floor < 6:  # no contrast: all silence (or all noise)
        return np.zeros_like(db, dtype=bool), float(floor)
    thr = floor + 0.35 * (speech - floor)
    mask = _close(db > thr, int(0.12 / FRAME_S))  # gaps < 120 ms (plosives)
    mask = _open(mask, int(0.25 / FRAME_S))  # noises < 250 ms (clicks, keyboard)
    return mask, float(thr)


def analyze(path: str, min_pause_s: float = 0.5) -> dict:
    x, sr = load_wav(path)
    db = frame_db(x, sr)
    mask, thr = speech_mask(db)
    runs = _runs(mask)
    speech_runs = [(a * FRAME_S, b * FRAME_S) for v, a, b in runs if v]
    duration = round(len(x) / sr, 2)
    if not speech_runs:
        return {"has_speech": False, "duration_s": duration, "level_speech_db": round(float(np.percentile(db, 90)), 1)}
    onset, offset = speech_runs[0][0], speech_runs[-1][1]
    pauses = [
        {"start_s": round(a * FRAME_S, 2), "end_s": round(b * FRAME_S, 2), "dur_s": round((b - a) * FRAME_S, 2)}
        for v, a, b in runs
        if not v and a * FRAME_S > onset and b * FRAME_S < offset and (b - a) * FRAME_S >= min_pause_s
    ]
    return {
        "has_speech": True,
        "duration_s": duration,
        "speech_onset_s": round(onset, 2),
        "speech_offset_s": round(offset, 2),
        "trailing_silence_s": round(duration - offset, 2),
        "pauses": pauses,
        "threshold_db": round(thr, 1),
        "level_mean_db": round(float(np.mean(db)), 1),
        "level_speech_db": round(float(np.percentile(db, 90)), 1),
    }


def trim_trailing(path: str, out_path: str, info: dict, keep_s: float = 0.4) -> str:
    x, sr = load_wav(path)
    if info.get("has_speech"):
        x = x[: min(len(x), int((info["speech_offset_s"] + keep_s) * sr))]
    with wave.open(out_path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())
    return out_path


def delete_quietly(*paths: str | None) -> None:
    """Audio is deleted when the turn finishes."""
    for p in paths:
        if p:
            Path(p).unlink(missing_ok=True)
