"""Subsystem readiness (RAG index, local STT), reported by /api/health and /context."""

from typing import Any

# "pending" | "ready" | "unavailable" | "error: …"; the RAG entry becomes the
# ingestion summary dict once the index is ready.
STATUS: dict[str, Any] = {"rag": "pending", "stt": "pending"}
