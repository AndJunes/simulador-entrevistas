"""TTS: Magpie TTS Multilingual (NVIDIA hosted, HTTP). On-disk cache keyed by hash (voice+text+processing).

Mandatory post-processing: Magpie delivers audio peaking at 0 dBFS (no headroom), which clips
the speakers. Each audio is normalized with ffmpeg loudnorm to a moderate speech level with a true-peak
ceiling of -3 dBTP, and stored mono 24 kHz (enough for voice, lighter files).
"""

import hashlib
import subprocess
from pathlib import Path

import httpx

from app.core.config import TMP, TTS_CACHE, env

POSTPROCESS = "loudnorm=I=-20:TP=-3:LRA=11"  # target speech LUFS, max true peak -3 dB
PROCESS_VERSION = "v2-loudnorm"  # changes the cache key: old (clipped) audio isn't reused

VOICES = {
    ("interviewer", "es"): "Magpie-Multilingual.ES-US.Isabela.Neutral",
    ("interviewer", "en"): "Magpie-Multilingual.EN-US.Ray.Neutral",
    ("coach", "es"): "Magpie-Multilingual.ES-US.Diego.Calm",
    ("coach", "en"): "Magpie-Multilingual.EN-US.Aria.Calm",
}


def cache_key(text: str, voice: str) -> str:
    return hashlib.sha256(f"{PROCESS_VERSION}|{voice}|{text}".encode()).hexdigest()[:24]


def _normalize(raw: bytes, dst: Path) -> None:
    src = TMP / f"tts_raw_{dst.stem}.wav"
    src.write_bytes(raw)
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-loglevel",
                "error",
                "-i",
                str(src),
                "-af",
                POSTPROCESS,
                "-ar",
                "24000",
                "-ac",
                "1",
                "-c:a",
                "pcm_s16le",
                str(dst),
            ],
            check=True,
        )
    finally:
        src.unlink(missing_ok=True)


def cache_path(key: str) -> Path:
    return TTS_CACHE / f"{key}.wav"


def synthesize(text: str, lang: str, role: str = "interviewer") -> str:
    """Returns the WAV cache key. Synthesizes only if missing."""
    voice = VOICES[(role, lang)]
    key = cache_key(text, voice)
    path = cache_path(key)
    if path.exists():
        return key
    base = env("TTS_HTTP_URL").rsplit("/v1/", 1)[0]
    r = httpx.post(
        f"{base}/v1/audio/synthesize",
        headers={"Authorization": f"Bearer {env('NVIDIA_API_KEY')}"},
        data={
            "text": text,
            "language": env(f"TTS_LANGUAGE_{lang.upper()}"),
            "voice": voice,
            "encoding": "LINEAR_PCM",
            "sample_rate_hz": env("TTS_SAMPLE_RATE_HZ", "44100"),
        },
        timeout=120,
    )
    if r.status_code != 200:
        raise RuntimeError(f"TTS HTTP {r.status_code}: {r.text[:200]}")
    tmp = path.with_suffix(".part.wav")
    _normalize(r.content, tmp)
    tmp.rename(path)
    return key
