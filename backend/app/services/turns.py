"""Practice-turn processing with per-stage events (the wait exceeds 10 s).

received → transcribing → transcribed(transcript+metrics) → evaluating → evaluated → tts_ready → done
                                   └→ coaching (blank mode) → tts_ready → done
"""

import logging
import time
import traceback

from app.core.config import TMP
from app.db.models import Turn
from app.db.session import db
from app.pipeline import audio, coach, evaluator, metrics, stt, tts
from app.services import context, events

log = logging.getLogger("turns")


class Cancelled(Exception):
    pass


def _check(cid: str):
    if events.is_cancelled(cid):
        raise Cancelled()


def analyze_audio(
    turn_id: str, raw_path: str, lang: str, qtype: str, question: dict | None, glossary: list[str]
) -> dict:
    """Audio → VAD → trim → Whisper → metrics. Always deletes the audio."""
    wav = str(TMP / f"{turn_id}_16k.wav")
    trimmed = str(TMP / f"{turn_id}_trim.wav")
    try:
        audio.to_wav16k(raw_path, wav)
        vad = audio.analyze(wav, min_pause_s=0.5)
        if not vad.get("has_speech"):
            return {"has_speech": False, "vad": vad}
        audio.trim_trailing(wav, trimmed, vad)
        t0 = time.perf_counter()
        tr = stt.transcribe(trimmed, lang, glossary)
        stt_s = round(time.perf_counter() - t0, 1)
        m = metrics.form_metrics(tr["words"], vad, lang, qtype, question) if tr["words"] else {}
        low = [tr["words"][i]["word"] for i in m.get("low_confidence_idx", [])]
        return {"has_speech": True, "vad": vad, "transcript": tr, "metrics": m, "low_conf_words": low, "stt_s": stt_s}
    finally:
        audio.delete_quietly(raw_path, wav, trimmed)


def written_answer(text: str) -> dict:
    """Written answer (alternative to voice, W3C: don't require speech). No STT or voice metrics."""
    text = (text or "").strip()
    return {
        "has_speech": bool(text),
        "vad": {},
        "transcript": {"text": text, "words": []},
        "metrics": None,
        "low_conf_words": [],
        "stt_s": 0,
        "written": True,
    }


def run_practice_turn(turn_id: str, raw_path: str | None, help_requested: bool, text: str | None = None) -> None:
    cid = turn_id
    timings: dict = {}
    try:
        with db() as s:
            t = s.get(Turn, turn_id)
            assert t is not None
            lang, attempt_of, qid, sid = t.lang, t.attempt_of, t.question_id, t.session_id
            asked, parent_tid = t.question_text, t.parent_turn_id
            parent = s.get(Turn, parent_tid) if parent_tid else None
            thread = (
                [
                    {"role": "interviewer", "text": parent.question_text},
                    {"role": "candidate", "text": (parent.transcript or {}).get("text", "")},
                ]
                if parent
                else None
            )
        ctx = context.for_session(sid)
        q = context.in_lang(ctx.question(qid.split("-")[0]), lang)
        if thread:  # practice follow-up: a different question is asked, but the whole thread is evaluated
            q = {**q, "text": asked}
        events.emit(cid, "received")
        if text is not None:
            a = written_answer(text)
        else:
            events.emit(cid, "transcribing", eta_s=6)
            _check(cid)
            assert raw_path is not None  # the API requires audio when there is no written answer
            a = analyze_audio(turn_id, raw_path, lang, q["type"], None if thread else q, ctx.glossary())
        timings["stt"] = a.get("stt_s")
        _check(cid)

        reason = None
        if not a["has_speech"]:
            if a["vad"].get("duration_s", 0) >= 4 or help_requested:
                reason = "silencio: no empezaste a responder"
            else:
                events.emit(
                    cid,
                    "error",
                    message="No se detectó voz. ¿El micrófono está silenciado?",
                    code="no_speech",
                    mic_level_db=a["vad"].get("level_speech_db"),
                )
                _save(turn_id, status="error", error="no_speech")
                return
        else:
            events.emit(
                cid, "transcribed", transcript=a["transcript"], metrics=a["metrics"], low_conf_words=a["low_conf_words"]
            )
            reason = (
                "pediste ayuda"
                if help_requested
                else coach.looks_blank(
                    a["transcript"]["text"], len(a["transcript"]["words"]) or len(a["transcript"]["text"].split()), lang
                )
            )

        if reason:
            events.emit(cid, "coaching_started", reason=reason, eta_s=15)
            res = coach.coach(
                question=q,
                language=lang,
                cv=ctx.cv(),
                job=ctx.job(),
                partial_transcript=(a.get("transcript") or {}).get("text", ""),
                reason=reason,
            )
            _check(cid)
            _save(
                turn_id,
                kind="coaching",
                status="done",
                transcript=a.get("transcript"),
                metrics=a.get("metrics"),
                coaching=res,
                cost_usd=res["cost_usd"],
                timings=timings,
            )
            events.emit(cid, "coaching", coaching=res)
            _speak(cid, turn_id, res["coaching"]["spoken_summary"])
            events.emit(cid, "done")
            return

        events.emit(cid, "evaluating", eta_s=40)
        t0 = time.perf_counter()
        ev = evaluator.evaluate(
            interview_type=q["type"],
            language=lang,
            question=q["text"],
            question_guidance=q["guidance"],
            transcript=a["transcript"]["text"],
            delivery={
                k: v for k, v in (a["metrics"] or {}).items() if k not in ("filler_word_idx", "low_confidence_idx")
            },
            low_conf_words=a["low_conf_words"],
            cv=ctx.cv(),
            job=ctx.job(),
            question_meta=q,
            thread=thread,
            evidence=ctx.evidence_digest(),
        )
        timings["eval"] = round(time.perf_counter() - t0, 1)
        _check(cid)
        if not ev["ok"]:
            _save(turn_id, status="error", error=ev["error"], transcript=a["transcript"], metrics=a["metrics"])
            events.emit(
                cid,
                "error",
                message="La evaluación no está disponible ahora. Tus métricas de forma sí.",
                code="eval_failed",
            )
            return
        comparison = None
        if attempt_of:
            with db() as s:
                prev = s.get(Turn, attempt_of)
                if prev and prev.evaluation:
                    comparison = metrics.compare(
                        {"metrics": prev.metrics, "evaluation": prev.evaluation["evaluation"]},
                        {"metrics": a["metrics"] or {}, "evaluation": ev["evaluation"]},
                    )
        _save(
            turn_id,
            status="done",
            transcript=a["transcript"],
            metrics=a["metrics"],
            low_conf_words=a["low_conf_words"],
            evaluation=ev,
            cost_usd=ev["cost_usd"],
            timings=timings,
        )
        events.emit(cid, "evaluated", evaluation=ev, comparison=comparison)
        _speak(cid, turn_id, ev["evaluation"]["spoken_summary"])
        events.emit(cid, "done")
    except Cancelled:
        _save(turn_id, status="cancelled")
        events.emit(cid, "cancelled")
    except Exception as e:  # noqa: BLE001
        log.error("turn %s failed: %s", turn_id, traceback.format_exc())
        _save(turn_id, status="error", error=str(e)[:500])
        events.emit(cid, "error", message="Algo falló procesando tu respuesta. Probá de nuevo.", code="internal")
    finally:
        audio.delete_quietly(raw_path)


def _speak(cid: str, turn_id: str, text: str) -> None:
    try:
        key = tts.synthesize(text, "es", "coach")
        _save(turn_id, tts_key=key)
        events.emit(cid, "tts_ready", audio_url=f"/api/audio/{key}.wav")
    except Exception as e:  # noqa: BLE001  (written feedback doesn't depend on TTS)
        events.emit(cid, "tts_failed", message=str(e)[:200])


def _save(turn_id: str, **fields) -> None:
    with db() as s:
        t = s.get(Turn, turn_id)
        if not t:
            return
        for k, v in fields.items():
            setattr(t, k, v)
