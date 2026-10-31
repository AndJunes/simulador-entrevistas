"""Local STT: Whisper large-v3-turbo with MLX. Audio never leaves the machine.

- Model pinned to the audited commit and hash-verified on first load.
- Filler hint + CV glossary: without it Whisper "cleans up" the "eh"/"um".
- A lock serializes GPU (MLX) usage.
"""
import hashlib
import threading
from functools import lru_cache

from app.core.config import env

_LOCK = threading.Lock()

FILLER_PROMPT = {
    "en": "Um, so, uh... like, you know, I, uh, I worked with",
    "es": "Eh, bueno, este... mmm, o sea, trabajé, eh, trabajé con",
}


@lru_cache
def model_path() -> str:
    from huggingface_hub import snapshot_download
    path = snapshot_download(repo_id=env("STT_LOCAL_MODEL", "mlx-community/whisper-large-v3-turbo"),
                             revision=env("STT_LOCAL_REVISION", "a4aaeec0636e6fef84abdcbe3544cb2bf7e9f6fb"),
                             allow_patterns=["config.json", "weights.safetensors"])
    expected = env("STT_LOCAL_WEIGHTS_SHA256_PREFIX", "951ed3fc1203e6a6")
    h = hashlib.sha256()
    with open(f"{path}/weights.safetensors", "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    if not h.hexdigest().startswith(expected):
        raise RuntimeError("El hash de los pesos de Whisper no coincide con el auditado. No se carga el modelo.")
    return path


def transcribe(wav: str, lang: str, glossary: list[str]) -> dict:
    import mlx_whisper
    prompt = FILLER_PROMPT[lang] + " " + ", ".join(glossary) + "."
    with _LOCK:
        res = mlx_whisper.transcribe(wav, path_or_hf_repo=model_path(), language=lang, word_timestamps=True,
                                     condition_on_previous_text=False, initial_prompt=prompt, verbose=None)
    words = [{"word": w["word"].strip(), "start_s": round(w["start"], 2), "end_s": round(w["end"], 2),
              "prob": round(w.get("probability", 0), 2)}
             for seg in res["segments"] for w in seg.get("words", [])]
    return {"text": res["text"].strip(), "words": words, "language": res.get("language")}


def warmup() -> None:
    """Loads and verifies the model at startup so the first answer doesn't wait."""
    model_path()
