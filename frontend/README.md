# Frontend

React 19 + TypeScript + Vite 8 + Tailwind CSS v4 + shadcn/ui. Instalación y ejecución en el [README principal](../README.md).

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (proxy de `/api` al backend en `127.0.0.1:8000`) |
| `npm test` | Vitest: contraste WCAG de los tokens de `src/index.css` y regla del próximo paso |
| `npm run lint` | oxlint |
| `npm run build` | `tsc -b` + build de producción |
| `npm run test:e2e` | Playwright + axe-core (requiere la app corriendo) |

- `src/pages/`: pantallas. `src/pages/app/`: secciones de una postulación.
- `src/components/`: componentes propios; `src/components/ui/`: componentes de shadcn.
- `src/lib/`: cliente de la API, audio (grabación, nivel, reproducción), tema y regla del próximo paso.
- `scripts/illustrations.py`: recolorea las ilustraciones de unDraw al teal de la marca (OKLCH) y las exporta a WebP.

El sistema de diseño (tokens de color OKLCH con contraste verificado, escala tipográfica y movimiento) vive en `src/index.css`.
