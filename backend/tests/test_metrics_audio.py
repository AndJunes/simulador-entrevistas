"""Tests deterministas: métricas de forma, muletillas, VAD y borrado de audio."""
import wave
from pathlib import Path

import numpy as np
import pytest

from app.pipeline import audio, metrics


def words(text: str, step: float = 0.3) -> list[dict]:
    return [{"word": w, "start_s": round(i * step, 2), "end_s": round(i * step + 0.2, 2), "prob": 0.9}
            for i, w in enumerate(text.split())]


VAD_FLAT = {"speech_onset_s": 0.0, "speech_offset_s": 10.0, "pauses": []}


def test_filled_pauses_always_count_es():
    m = metrics.form_metrics(words("eh trabajé en eh un proyecto mmm grande"), VAD_FLAT, "es", "star", None)
    assert m["filled_pauses"].get("eh") == 2
    assert "mmm" in m["filled_pauses"]


def test_discourse_marker_needs_overuse():
    one = metrics.form_metrics(words("no pasó nada entonces seguí"), VAD_FLAT, "es", "star", None)
    assert "nada" not in one["fillers"] and "entonces" not in one["fillers"]
    many = metrics.form_metrics(words("so I built it so it worked so we shipped"), VAD_FLAT, "en", "star", None)
    assert many["fillers"].get("so") == 3


def test_like_as_verb_is_not_filler():
    m = metrics.form_metrics(words("I like Rust, like, a lot, like, so like hard"), VAD_FLAT, "en", "star", None)
    # "I like" es verbo; los otros 3 "like" sí cuentan como sobreuso
    assert m["markers_seen"].get("like") == 3


def test_muy_bueno_is_not_filler():
    assert metrics.count_filler(" fue muy bueno ", "bueno") == 0
    assert metrics.count_filler(" bueno arranco ", "bueno") == 1


def test_duration_status_and_wpm():
    ws = words(" ".join(["palabra"] * 100), step=0.4)    # ~40 s
    vad = {"speech_onset_s": 0.0, "speech_offset_s": ws[-1]["end_s"], "pauses": []}
    m = metrics.form_metrics(ws, vad, "es", "star", None)
    assert m["duration_status"] == "corta"
    assert 140 <= m["wpm"] <= 160


def test_long_pauses_from_vad_not_word_gaps():
    vad = {"speech_onset_s": 1.0, "speech_offset_s": 30.0,
           "pauses": [{"start_s": 0.2, "end_s": 0.9, "dur_s": 0.7},          # antes de hablar: no cuenta
                      {"start_s": 10.0, "end_s": 13.0, "dur_s": 3.0},        # larga
                      {"start_s": 20.0, "end_s": 20.6, "dur_s": 0.6}]}       # corta
    m = metrics.form_metrics(words("hola esto es una respuesta"), vad, "es", "star", None)
    assert [p["dur_s"] for p in m["long_pauses"]] == [3.0]


def test_onset_ignores_breath_before_first_word():
    vad = {"speech_onset_s": 0.7, "speech_offset_s": 40.0, "pauses": [{"start_s": 1.1, "end_s": 2.4, "dur_s": 1.3}]}
    assert metrics.align_onset(vad, [{"word": "Una", "start_s": 2.32, "end_s": 2.6}]) == 2.4


def _write_wav(path: Path, segments: list[tuple[float, float]], sr: int = 16000):
    """Silencio con ruido de fondo bajo + tonos (habla simulada) en los intervalos dados."""
    rng = np.random.default_rng(0)
    total = max(e for _, e in segments) + 2.0
    x = rng.normal(0, 0.002, int(total * sr))
    for s, e in segments:
        t = np.arange(int((e - s) * sr)) / sr
        x[int(s * sr): int(s * sr) + len(t)] += 0.2 * np.sin(2 * np.pi * 220 * t)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


def test_vad_finds_pause_and_trailing_silence(tmp_path):
    p = tmp_path / "a.wav"
    _write_wav(p, [(1.0, 4.0), (6.0, 9.0)])
    info = audio.analyze(str(p), min_pause_s=1.0)
    assert info["has_speech"]
    assert abs(info["speech_onset_s"] - 1.0) < 0.15
    assert len(info["pauses"]) == 1 and abs(info["pauses"][0]["dur_s"] - 2.0) < 0.2
    assert info["trailing_silence_s"] > 1.5


def test_vad_silence_only(tmp_path):
    p = tmp_path / "s.wav"
    _write_wav(p, [(0.0, 0.0)])
    assert audio.analyze(str(p))["has_speech"] is False


def test_trim_removes_trailing_silence(tmp_path):
    p, out = tmp_path / "a.wav", tmp_path / "t.wav"
    _write_wav(p, [(1.0, 3.0)])
    info = audio.analyze(str(p))
    audio.trim_trailing(str(p), str(out), info)
    x, sr = audio.load_wav(str(out))
    assert len(x) / sr < info["duration_s"] - 1.0


def test_delete_quietly_removes_audio(tmp_path):
    p = tmp_path / "rec.webm"
    p.write_bytes(b"x")
    audio.delete_quietly(str(p), None, str(tmp_path / "missing.wav"))
    assert not p.exists()


@pytest.mark.parametrize("prev,cur", [((2, 3), (4, 3))])
def test_compare_reports_deltas(prev, cur):
    a = {"metrics": {"wpm": 150}, "evaluation": {"criteria": [{"id": "star_result", "score": prev[0]}]}}
    b = {"metrics": {"wpm": 140}, "evaluation": {"criteria": [{"id": "star_result", "score": cur[0]}]}}
    c = metrics.compare(a, b)
    assert c["criteria"]["star_result"] == [2, 4] and c["metrics"]["wpm"] == [150, 140]
