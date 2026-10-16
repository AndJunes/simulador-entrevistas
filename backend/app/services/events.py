"""Bus de eventos en memoria para el progreso por etapas (SSE). Un canal por turno o por informe.

El pipeline corre en hilos (STT/LLM son bloqueantes); el SSE lee el canal y reenvía lo nuevo.
Un cliente que se conecta tarde recibe la historia completa del canal (no se pierde ninguna etapa).
"""
import threading
import time
from dataclasses import dataclass, field

TERMINAL = {"done", "error", "cancelled"}


@dataclass
class Channel:
    events: list[dict] = field(default_factory=list)
    cancelled: bool = False
    created: float = field(default_factory=time.time)


_channels: dict[str, Channel] = {}
_lock = threading.Lock()


def open_channel(cid: str) -> None:
    with _lock:
        _channels[cid] = Channel()
        # limpieza simple: canales de más de 2 h
        for k in [k for k, c in _channels.items() if time.time() - c.created > 7200]:
            _channels.pop(k, None)


def emit(cid: str, stage: str, **data) -> None:
    with _lock:
        ch = _channels.setdefault(cid, Channel())
        ch.events.append({"stage": stage, "t": round(time.time(), 2), **data})


def cancel(cid: str) -> bool:
    with _lock:
        ch = _channels.get(cid)
        if ch:
            ch.cancelled = True
        return bool(ch)


def is_cancelled(cid: str) -> bool:
    with _lock:
        ch = _channels.get(cid)
        return bool(ch and ch.cancelled)


def read_from(cid: str, idx: int) -> tuple[list[dict], bool]:
    """Eventos desde idx y si el canal ya terminó."""
    with _lock:
        ch = _channels.get(cid)
        if not ch:
            return [], True
        new = ch.events[idx:]
        finished = any(e["stage"] in TERMINAL for e in ch.events)
        return new, finished
