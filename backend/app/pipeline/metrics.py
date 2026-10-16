"""Métricas de forma deterministas.

- Pausas: por VAD sobre el audio, NO por huecos entre palabras de Whisper (Whisper absorbe silencios).
- Inicio: el tramo de voz que coincide con la primera palabra (ignora respiraciones/ruidos previos).
- Muletillas ambiguas ("like", "bueno"): solo cuentan en contexto de relleno.
- Rangos objetivo: backend/config/form_targets.yaml (con fuentes) si existe; si no, valores provisorios.
"""
import re
from functools import lru_cache

import yaml

from app.core.config import CONFIG_DIR, env

# Dos categorías (corpus: knowledge/SOURCES.md K28–K32):
# - pausas llenas: inequívocas, se cuentan siempre;
# - marcadores discursivos: legítimos casi siempre; solo se señalan si se REPITEN (sobreuso) y con reglas de contexto.
DEFAULT_FILLERS = {
    "en": (["um", "uh", "erm", "er", "hmm", "mm", "eh", "em"],     # L2: se cuelan las del español (K28)
           ["like", "you know", "i mean", "so", "basically", "actually", "kind of", "sort of"]),
    "es": (["eh", "em", "ehm", "mmm", "mm"],
           ["este", "o sea", "bueno", "pues", "entonces", "digamos", "tipo", "como que"]),
}
MARKER_OVERUSE_MIN = 3   # ⚠ heurística: un marcador cuenta como muletilla si aparece 3+ veces en una respuesta
NOT_FILLER_BEFORE = {
    "like": {"i", "you", "we", "they", "would", "i'd", "really", "don't", "didn't", "also", "to", "just", "would've",
             "looks", "look", "feel", "feels", "things", "something", "anything"},
    "bueno": {"muy", "un", "una", "lo", "más", "tan", "es", "fue", "era", "sea"},
    "tipo": {"el", "un", "este", "ese", "de", "qué", "que", "mismo"},
}
NOT_FILLER_AFTER = {"like": {"to", "this", "that", "it", "them"}, "tipo": {"de"}}

DEFAULT_DURATION = {"screening": (45, 90), "star": (60, 90), "closing": (20, 90)}   # ⚠ provisorio (notas de preparación de una postulación real)


def _clean_tokens(items) -> list[str]:
    out = []
    for i in items:
        t = str(i["token"] if isinstance(i, dict) else i).lower().strip()
        if t and t == _norm_phrase(t):      # descarta "¿no?" y similares: al normalizar serían "no" (falsos positivos)
            out.append(t)
    return sorted(set(out), key=lambda x: -len(x))


@lru_cache
def fillers(lang: str) -> tuple[list[str], list[str]]:
    """(pausas llenas, marcadores discursivos). Desde backend/config/fillers_<lang>.yaml si existe."""
    path = CONFIG_DIR / f"fillers_{lang}.yaml"
    if path.exists():
        try:
            d = yaml.safe_load(path.read_text()) or {}
            filled = _clean_tokens(d.get("filled_pauses", []))
            markers = [m for m in _clean_tokens(d.get("discourse_markers", [])) if m not in filled]
            if filled:
                return filled, markers
        except Exception:  # noqa: BLE001  (yaml mal formado → defaults, no rompe la práctica)
            pass
    return DEFAULT_FILLERS[lang]


@lru_cache
def targets() -> dict:
    path = CONFIG_DIR / "form_targets.yaml"
    if path.exists():
        try:
            return yaml.safe_load(path.read_text()) or {}
        except Exception:  # noqa: BLE001
            return {}
    return {}


def duration_target(qtype: str, question: dict | None = None) -> tuple[float, float, str | None]:
    """Rango objetivo: el de la pregunta (lo define la postulación), si no form_targets.yaml, si no el default."""
    if question and isinstance(question.get("duration"), list) and len(question["duration"]) == 2:
        lo, hi = question["duration"]
        src = "pregunta" if not question.get("pitch") else (targets().get("duration_s", {}).get("pitch") or {}).get("source")
        return float(lo), float(hi), src
    t = targets().get("duration_s", {})
    key = "pitch" if question and question.get("pitch") else "behavioral" if qtype == "star" else "screening_other"
    d = t.get(key) or {}
    if d.get("min") and d.get("max"):
        return float(d["min"]), float(d["max"]), d.get("source")
    lo, hi = DEFAULT_DURATION.get(qtype, (45, 90))
    return lo, hi, None


def long_pause_s() -> float:
    v = (targets().get("long_pause_s") or {}).get("value")
    return float(v) if v else float(env("LONG_PAUSE_SECONDS", "1.5"))


def count_filler(tokens: str, f: str) -> int:
    hits = [m.start() for m in re.finditer(rf"(?<= ){re.escape(f)}(?= )", tokens)]
    if f not in NOT_FILLER_BEFORE:
        return len(hits)
    n = 0
    for pos in hits:
        before = (tokens[:pos].split()[-1:] or [""])[0]
        after = (tokens[pos + len(f):].split()[:1] or [""])[0]
        if before in NOT_FILLER_BEFORE[f] or after in NOT_FILLER_AFTER.get(f, set()):
            continue
        n += 1
    return n


def align_onset(vad: dict, words: list[dict]) -> float:
    if not words:
        return vad.get("speech_onset_s", 0.0)
    first = words[0]["start_s"]
    gaps = [p for p in vad.get("pauses", []) if p["start_s"] <= first]
    candidate = max((p["end_s"] for p in gaps), default=vad.get("speech_onset_s", first))
    return round(candidate if abs(candidate - first) < 1.0 else first, 2)


def _norm(w: str) -> str:
    return re.sub(r"[^\wáéíóúñü'/-]", "", w.lower())


def _norm_phrase(p: str) -> str:
    return " ".join(_norm(w) for w in p.split())


def form_metrics(words: list[dict], vad: dict, lang: str, qtype: str, question: dict | None = None) -> dict:
    onset = align_onset(vad, words)
    offset = max(vad.get("speech_offset_s", 0), words[-1]["end_s"] if words else 0)
    speech = max(offset - onset, 1e-6)
    tokens = " " + " ".join(_norm(w["word"]) for w in words) + " "
    filled, markers = fillers(lang)
    found_filled = {f: n for f in filled if (n := count_filler(tokens, f))}
    found_markers = {f: n for f in markers if (n := count_filler(tokens, f))}
    overused = {f: n for f, n in found_markers.items() if n >= MARKER_OVERUSE_MIN}
    found = {**found_filled, **overused}
    # posiciones de muletillas (índices de palabra) para resaltarlas en la transcripción
    filler_idx = []
    single = {f for f in found if " " not in f}
    for i, w in enumerate(words):
        if _norm(w["word"]) in single:
            ctx = " " + " ".join(_norm(x["word"]) for x in words[max(0, i - 1): i + 2]) + " "
            if count_filler(ctx, _norm(w["word"])):
                filler_idx.append(i)
    reps = re.findall(r"\b(\w+ \w+)\b,? \1\b", " ".join(_norm(w["word"]) for w in words))
    thr = long_pause_s()
    pauses = [{"at_s": p["start_s"], "dur_s": p["dur_s"]} for p in vad.get("pauses", [])
              if p["start_s"] >= onset and p["dur_s"] >= thr]
    lo, hi, src = duration_target(qtype, question)
    low_thr = float(env("STT_LOW_CONFIDENCE_THRESHOLD", "0.5"))
    return {
        "first_word_latency_s": onset,
        "speech_duration_s": round(speech, 1),
        "duration_target_s": [lo, hi],
        "duration_target_source": src,
        "duration_status": "corta" if speech < lo else "larga" if speech > hi else "en rango",
        "words": len(words),
        "wpm": round(len(words) / (speech / 60)),
        "long_pause_threshold_s": thr,
        "long_pauses": pauses,
        "fillers": found,
        "filled_pauses": found_filled,
        "markers_overused": overused,
        "markers_seen": found_markers,
        "filler_word_idx": filler_idx,
        "fillers_per_min": round(sum(found.values()) / (speech / 60), 1),
        "repetitions": reps,
        "stretched_words": [w["word"] for w in words if w["end_s"] - w["start_s"] > 1.2],
        "low_confidence_idx": [i for i, w in enumerate(words) if w.get("prob", 1) < low_thr],
        "mic_level_db": vad.get("level_speech_db"),
    }


def compare(prev: dict, cur: dict) -> dict:
    """Antes/después al reintentar (Hattie & Timperley: feedback sobre el cambio)."""
    keys = ("first_word_latency_s", "speech_duration_s", "wpm", "fillers_per_min")
    pm, cm = prev.get("metrics") or {}, cur.get("metrics") or {}
    ok = lambda c: c.get("applicable", True)   # noqa: E731  (los no aplicables no se comparan)
    ps = {c["id"]: c["score"] for c in (prev.get("evaluation") or {}).get("criteria", []) if ok(c)}
    cs = {c["id"]: c["score"] for c in (cur.get("evaluation") or {}).get("criteria", []) if ok(c)}
    pc = ((prev.get("evaluation") or {}).get("competency") or {})
    cc = ((cur.get("evaluation") or {}).get("competency") or {})
    out = {"metrics": {k: [pm.get(k), cm.get(k)] for k in keys}, "criteria": {k: [ps.get(k), cs[k]] for k in cs}}
    if cc.get("score"):
        out["competency"] = {"id": cc.get("id"), "label": cc.get("label"), "scores": [pc.get("score"), cc["score"]],
                             "levels": [pc.get("evidence_level"), cc.get("evidence_level")]}
    return out
