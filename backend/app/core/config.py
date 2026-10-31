"""Central configuration. Reads the .env at the project root. Never logs secrets."""
import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[3]          # simulador-entrevistas/
BACKEND = ROOT / "backend"
KNOWLEDGE = ROOT / "knowledge"
CONFIG_DIR = BACKEND / "config"
DATA_PRIVATE = ROOT / "data" / "private"
CACHE = BACKEND / ".cache"
TTS_CACHE = CACHE / "tts"
TMP = CACHE / "tmp"

for _d in (TTS_CACHE, TMP):
    _d.mkdir(parents=True, exist_ok=True)

load_dotenv(ROOT / ".env")
os.environ.setdefault("LANGSMITH_TRACING", "false")   # telemetry off (langsmith ships with LangGraph)


def env(name: str, default: str | None = None) -> str:
    """Config value with any inline comment stripped. Fails clearly if missing and no default."""
    value = os.getenv(name, default)
    if value is None or str(value).strip() == "":
        if default is not None:
            return default
        raise RuntimeError(f"Falta la variable {name} en .env")
    return str(value).split(" #")[0].split("\t#")[0].strip()


@lru_cache
def database_url() -> str:
    return (f"postgresql+psycopg://{env('POSTGRES_USER')}:{env('POSTGRES_PASSWORD')}"
            f"@{env('POSTGRES_HOST', 'localhost')}:{env('POSTGRES_PORT', '5432')}/{env('POSTGRES_DB')}")


