import { defineConfig } from "vitest/config"

// Unitarios (contraste de tokens, regla del siguiente paso). Los e2e de Playwright van aparte: npm run test:e2e
export default defineConfig({ test: { include: ["src/**/*.test.ts"] } })
