"""Clientes de OpenRouter (LLM) y NVIDIA (embeddings). Lecciones aprendidas:
- Los Claude 5.5 NO aceptan temperature: se controla con reasoning.effort.
- data_collection=deny para no enrutar a proveedores que guardan datos (CV, respuestas).
"""
import math
from functools import lru_cache

from openai import OpenAI
from pydantic import BaseModel

from app.core.config import env


@lru_cache
def openrouter() -> OpenAI:
    return OpenAI(base_url=env("OPENROUTER_BASE_URL"), api_key=env("OPENROUTER_API_KEY"),
                  default_headers={"HTTP-Referer": env("OPENROUTER_APP_URL", "http://localhost"),
                                   "X-Title": env("OPENROUTER_APP_TITLE", "Simulador de Entrevistas")})


@lru_cache
def nvidia_embeddings() -> OpenAI:
    return OpenAI(base_url=env("EMBEDDINGS_BASE_URL"), api_key=env("NVIDIA_API_KEY"))


def strict_schema(model: type[BaseModel]) -> dict:
    """JSON schema estricto para structured outputs: additionalProperties=false y todo requerido."""
    schema = model.model_json_schema()

    def fix(node):
        if isinstance(node, dict):
            if node.get("type") == "object" and "properties" in node:
                node["additionalProperties"] = False
                node["required"] = list(node["properties"].keys())
            for v in node.values():
                fix(v)
        elif isinstance(node, list):
            for v in node:
                fix(v)

    fix(schema)
    return schema


def structured(model: str, messages: list[dict], schema: type[BaseModel], effort: str = "medium"):
    """Llamada con salida estructurada. Devuelve (objeto validado, costo_usd)."""
    resp = openrouter().chat.completions.create(
        model=model,
        messages=messages,
        response_format={"type": "json_schema",
                         "json_schema": {"name": schema.__name__.lower(), "strict": True,
                                         "schema": strict_schema(schema)}},
        extra_body={"provider": {"data_collection": env("OPENROUTER_DATA_COLLECTION", "deny"),
                                 "require_parameters": True},
                    "usage": {"include": True},
                    "reasoning": {"effort": effort}},
    )
    usage = resp.usage.model_dump() if resp.usage else {}
    return schema.model_validate_json(resp.choices[0].message.content), (usage.get("cost") or 0.0)


def embed(texts: list[str], input_type: str) -> list[list[float]]:
    """Embeddings nemotron-3-embed-1b recortados a EMBEDDINGS_DIMENSIONS y renormalizados."""
    dims = int(env("EMBEDDINGS_DIMENSIONS", "1024"))
    out: list[list[float]] = []
    for i in range(0, len(texts), 16):
        resp = nvidia_embeddings().embeddings.create(
            model=env("EMBEDDINGS_MODEL"), input=texts[i:i + 16], encoding_format="float",
            extra_body={"input_type": input_type, "truncate": env("EMBEDDINGS_TRUNCATE", "END")})
        for d in resp.data:
            v = d.embedding[:dims]
            n = math.sqrt(sum(x * x for x in v)) or 1.0
            out.append([x / n for x in v])
    return out


def text(model: str, messages: list[dict], effort: str = "low") -> tuple[str, float]:
    """Llamada de texto libre (sin esquema). Devuelve (texto, costo_usd)."""
    resp = openrouter().chat.completions.create(
        model=model,
        messages=messages,
        extra_body={"provider": {"data_collection": env("OPENROUTER_DATA_COLLECTION", "deny")},
                    "usage": {"include": True},
                    "reasoning": {"effort": effort}},
    )
    usage = resp.usage.model_dump() if resp.usage else {}
    return (resp.choices[0].message.content or "").strip(), (usage.get("cost") or 0.0)
