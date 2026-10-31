# Text-mode backend image: everything except local voice transcription, which
# needs Apple Silicon (MLX) and therefore never runs inside a Linux container.
# Build from the repository root so the RAG corpus ships with the image:
#   docker build -f backend/Dockerfile -t simulador-api .

FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /usr/local/bin/uv

# pdftotext (poppler) covers PDF ingestion; DOCX/RTF/ODT degrade with a clear
# message (textutil is macOS-only) and voice answers return 503 in text mode.
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

# Dependencies first, so source edits don't bust this layer's cache.
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --locked --compile-bytecode

COPY backend/alembic.ini ./
COPY backend/migrations ./migrations
COPY backend/config ./config
COPY backend/app ./app
COPY knowledge /app/knowledge

ENV PATH="/app/backend/.venv/bin:$PATH"

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
