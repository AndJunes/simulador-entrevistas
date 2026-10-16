#!/usr/bin/env bash
# Levanta todo el simulador: base de datos (Docker), backend (nativo, usa la GPU de la Mac) y front.
# Uso: ./dev.sh        → abrí http://127.0.0.1:5173
#      Ctrl+C          → apaga backend y front (la base queda corriendo; `docker compose down` para apagarla)
set -euo pipefail
cd "$(dirname "$0")"

echo "▸ Base de datos (Postgres + pgvector)…"
docker info >/dev/null 2>&1 || { command -v orb >/dev/null && orb start; }
docker compose --env-file .env up -d db >/dev/null
until [ "$(docker inspect -f '{{.State.Health.Status}}' simulador-db 2>/dev/null)" = "healthy" ]; do sleep 1; done

echo "▸ Migraciones…"
(cd backend && .venv/bin/alembic upgrade head >/dev/null)

echo "▸ Backend en http://127.0.0.1:8000 …"
(cd backend && .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000) &
BACK=$!

echo "▸ Front en http://127.0.0.1:5173 …"
(cd frontend && npm run dev -- --host 127.0.0.1) &
FRONT=$!

trap 'kill $BACK $FRONT 2>/dev/null' EXIT INT TERM
wait
