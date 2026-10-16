# Simulador de Entrevistas

Simulador de entrevistas laborales con IA, de uso personal y local. Cargás **el aviso del puesto y tu CV**; la app
analiza qué pide el puesto y qué evidencia muestra tu CV, arma un banco de preguntas por etapa y te entrevista por voz
(o por escrito). Después te devuelve feedback sobre **qué decís** (competencias y criterios con escala anclada) y
**cómo sonás** (latencia, ritmo, pausas, muletillas).

## Problema que resuelve

Preparar una entrevista suele hacerse con preguntas genéricas y sin feedback. Este proyecto:

- deriva las preguntas del **puesto real** y de **tu CV**, diferenciando experiencia laboral de proyectos propios;
- marca qué requisitos tienen evidencia fuerte, parcial o ninguna **en el CV** (no en la persona);
- simula la entrevista por etapas (recruiter, técnica, conductual/cliente) con repreguntas solo cuando falta evidencia;
- evalúa cada respuesta con citas de lo que dijiste, separando lo demostrado de lo que falta.

## Funcionalidades

| Área | Qué hace |
|---|---|
| Postulaciones | Cada una con su CV, aviso, preguntas y resultados. Carga de PDF, Word, RTF, ODT, TXT, Markdown, HTML, imagen escaneada, texto o link; todo se convierte a Markdown editable |
| Generación de preguntas | Pipeline en etapas: análisis del puesto → evidencia del CV → mapa de cobertura → blueprint por etapa → candidatas → validador (premisas no fundamentadas, preguntas dobles o inductivas, duplicados, cobertura de obligatorios) |
| Práctica por pregunta | Modo coach con pistas que aparecen de a una, reintento con comparación y cambio de idioma |
| Simulacro | Por etapa, con 0–3 repreguntas adaptativas (LangGraph) e informe final por competencia |
| Videollamada | El simulacro con la pregunta solo hablada, controles de voz y reloj ocultable |
| Ejercicio | Tarea escrita (work sample) con preguntas aclaratorias; el código **no se ejecuta**, se evalúa leyéndolo |
| Progreso | Evolución por competencia y criterio contra tus propios intentos |
| Calidad del sistema | Métricas del generador, el entrevistador y el evaluador, alimentadas por tus marcas |

Todas las respuestas se pueden dar **por voz o por escrito**.

## Stack

| Capa | Tecnologías |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS v4, shadcn/ui (Radix), TanStack Query, React Router, Motion |
| Backend | Python 3.12, FastAPI, SSE, LangGraph, SQLAlchemy 2 + Alembic |
| Base de datos | Postgres 17 + pgvector 0.8.7 (Docker) |
| IA | OpenRouter (Claude Sonnet 5.5 evalúa, Haiku 5.5 para tareas rápidas), NVIDIA (TTS Magpie, embeddings nemotron), Whisper large-v3-turbo **local** (MLX) |
| Pruebas | pytest, Vitest, Playwright + axe-core |

## Arquitectura

```
navegador (React)
   │  REST + SSE (progreso de generación, evaluación y reportes)
   ▼
FastAPI ── LangGraph (simulacro) ── servicios (prácticas, simulacro, ejercicio, calidad)
   │            ├─ OpenRouter: análisis, preguntas, evaluación, repreguntas (solo texto)
   │            ├─ NVIDIA: voz del entrevistador (TTS) y embeddings del corpus público
   │            └─ Whisper local (MLX): transcripción; el audio no sale de la máquina
   ▼
Postgres + pgvector: postulaciones, sesiones, turnos, evaluaciones y RAG del corpus
```

```
backend/
  app/
    core/ db/             configuración, modelos SQLAlchemy y sesión
    ingest/               conversión de documentos a Markdown y descarga de links (anti-SSRF)
    generation/           pipeline de preguntas: análisis, evidencia, blueprint, validador
    interview/            grafo del simulacro (LangGraph)
    pipeline/             STT, TTS, métricas de voz, evaluador, coach, cliente LLM
    rag/                  ingestión incremental y recuperación sobre pgvector
    services/             casos de uso (práctica, simulacro, ejercicio, calidad)
    main.py               endpoints HTTP
  config/                 muletillas y rangos objetivo (con fuente)
  migrations/             Alembic
  tests/
frontend/src/
  pages/                  pantallas (postulaciones, espacio de la postulación, sesiones)
  components/             componentes propios + ui/ (shadcn)
  lib/                    cliente API, audio, tema, regla del "próximo paso"
knowledge/                corpus del RAG (rúbricas, preguntas, errores) con 45 fuentes en SOURCES.md
evals/                    evaluación del generador (A/B sobre 30 casos ficticios) y consistencia del evaluador
examples/                 CV y avisos ficticios para probar el flujo completo
```

## Requisitos previos

- **macOS con Apple Silicon**: la transcripción usa MLX (GPU Metal). Por eso el backend corre nativo y solo la base va en Docker.
- Python 3.12, Node.js 20.19+ o 22.12+, Docker (o OrbStack).
- Claves de [OpenRouter](https://openrouter.ai/settings/keys) y [NVIDIA](https://build.nvidia.com).

## Instalación

```bash
cp .env.example .env                 # completá POSTGRES_PASSWORD, OPENROUTER_API_KEY y NVIDIA_API_KEY
python3.12 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.lock.txt
(cd frontend && npm ci)
```

La primera transcripción descarga los pesos de Whisper en la revisión fijada en `.env` y verifica su hash
(`STT_LOCAL_WEIGHTS_SHA256_PREFIX`).

## Ejecución

```bash
./dev.sh
```

Levanta Postgres (Docker), aplica las migraciones, inicia el backend en `127.0.0.1:8000` y el front en
`http://127.0.0.1:5173`. Al arrancar, el backend indexa el corpus de `knowledge/` (solo re-embebe lo que cambió).
`Ctrl+C` apaga backend y front; la base sigue corriendo (`docker compose down` para apagarla).

## Probalo con datos de ejemplo

En [`examples/`](examples/) hay un CV y tres avisos **ficticios** (backend Python, AI engineer y full stack).
En la app: **Nueva postulación** → subí `examples/cv-ejemplo.md` como CV y uno de los avisos como puesto. La
generación tarda ~2–3 minutos y cuesta ~US$0,60 en OpenRouter.

## Variables de entorno

Todas están documentadas en [`.env.example`](.env.example). Las principales:

| Variable | Uso |
|---|---|
| `POSTGRES_PASSWORD` | Contraseña de la base local |
| `OPENROUTER_API_KEY` | LLM: análisis, preguntas, evaluación |
| `NVIDIA_API_KEY` | Voz del entrevistador y embeddings |
| `LLM_EVALUATOR_MODEL`, `LLM_FAST_MODEL` | Modelos de OpenRouter |
| `OPENROUTER_DATA_COLLECTION` | `deny`: solo proveedores que no guardan datos |

## Pruebas y verificaciones

```bash
cd backend && .venv/bin/python -m pytest          # 63 tests
cd frontend && npm test                           # Vitest: contraste de tokens y regla del próximo paso
cd frontend && npm run lint                       # oxlint
cd frontend && npm run build                      # tsc + build de producción
cd frontend && npm run test:e2e                   # Playwright + axe (requiere ./dev.sh corriendo)
```

Los tests de backend cubren métricas de voz, VAD, muletillas, evaluador (aplicabilidad de criterios, competencias),
rúbricas, grafo del simulacro (repreguntas, salto justificado, idioma mixto), blueprint, validador de premisas,
selección de candidatas, contexto por postulación, conversores de documentos, bloqueo SSRF y respuesta escrita.
Los e2e corren axe-core (WCAG 2.2 AA) en 11 pantallas en tema claro y oscuro, reflow a 320 px, teclado, filtros,
búsqueda y movimiento reducido.

Evals con costo (llaman al LLM):

```bash
backend/.venv/bin/python evals/run_generator.py --limit 3                       # ~US$0,58 por caso
backend/.venv/bin/python evals/run_evaluator_consistency.py --n 5 --repeats 2   # ~US$0,90
```

## API principal

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/api/ingest` | Convierte un archivo, texto o link a Markdown |
| `POST` / `GET` | `/api/applications` | Crea (y genera preguntas) / lista postulaciones |
| `GET` / `PATCH` / `DELETE` | `/api/applications/{id}` | Detalle, edición y borrado |
| `GET` | `/api/applications/{id}/events` | SSE con el progreso de la generación |
| `GET` | `/api/applications/{id}/context?view=coach\|mock` | Preguntas; `mock` no envía pistas ni evidencia esperada |
| `POST` | `/api/practice/turns` | Respuesta (audio o texto) de una práctica |
| `GET` | `/api/turns/{id}/events` | SSE con la evaluación por etapas |
| `POST` | `/api/mock/sessions`, `…/{id}/answer`, `…/{id}/finish` | Simulacro |
| `POST` | `/api/exercise/sessions`, `…/{id}/clarify`, `…/{id}/submit` | Ejercicio escrito |
| `GET` | `/api/progress`, `/api/sessions`, `/api/quality` | Progreso, historial y métricas del sistema |
| `GET` | `/api/health` | Estado de STT y RAG |

## Privacidad y seguridad

- El audio se transcribe localmente y se borra apenas se procesa; solo se guarda texto.
- A OpenRouter va texto, con `data_collection: deny`. El CV nunca se manda a NVIDIA.
- La carga por link solo acepta http/https y bloquea direcciones internas y locales (anti-SSRF), con límites de tamaño.
- En los prompts de generación, coach y evaluación, CV, aviso y respuestas van delimitados como datos, no como instrucciones.
- El simulacro pide `view=mock`: la evidencia esperada, las pistas y la política de repreguntas no llegan al navegador.
- La API y la base solo escuchan en `127.0.0.1`. **No hay autenticación**: está pensada para una sola persona en local.
- `data/private/` (CV, avisos, resultados con respuestas) y los audios de prueba no se versionan.

## Limitaciones conocidas

- Requiere Apple Silicon para la transcripción local; no hay despliegue ni imagen Docker del backend.
- Uso local y de una sola persona: sin autenticación, sin límite de uso ni tope de gasto del LLM.
- La calidad del análisis depende del LLM: los estados de evidencia describen el CV y pueden contener inferencias del modelo.
- Los endpoints de NVIDIA usados son de prueba (sus términos registran input/output).

## Licencia

Todos los derechos reservados: el código se publica solo para consulta. Ver [`LICENSE`](LICENSE).

Recursos de terceros: ilustraciones de [unDraw](https://undraw.co/license) (uso decorativo, modificadas) y fuentes
Geist y Geist Mono (licencia OFL).
