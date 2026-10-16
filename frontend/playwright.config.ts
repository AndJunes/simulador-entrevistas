import { defineConfig } from "@playwright/test"

// Pruebas de accesibilidad y responsive contra la app corriendo (./dev.sh): http://localhost:5173
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: { baseURL: process.env.BASE_URL ?? "http://localhost:5173", headless: true },
  reporter: [["list"]],
})
