/**
 * Contraste de los tokens de color (WCAG 2.2 · 1.4.3 texto ≥4.5:1 · 1.4.11 componentes/gráficos ≥3:1).
 * Lee index.css: si alguien cambia un color y rompe el contraste, el test falla.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { contrast, readTokens } from "./contrast"

const css = readFileSync(new URL("../index.css", import.meta.url), "utf8")

// [primer plano, fondo, mínimo]
const TEXT: [string, string, number][] = [
  ["foreground", "background", 4.5], ["foreground", "card", 4.5], ["muted-foreground", "background", 4.5],
  ["muted-foreground", "card", 4.5], ["muted-foreground", "muted", 4.5], ["primary", "card", 4.5], ["primary", "background", 4.5],
  ["primary-foreground", "primary", 4.5], ["accent-foreground", "accent", 4.5], ["secondary-foreground", "secondary", 4.5],
  ["ok", "ok-bg", 4.5], ["warn", "warn-bg", 4.5], ["none", "none-bg", 4.5],
  ["lime", "ink", 4.5], ["ink-foreground", "ink", 4.5], ["ink-muted", "ink", 4.5],
]
const NON_TEXT: [string, string, number][] = [
  ["input", "card", 3], ["input", "background", 3], ["ring", "card", 3], ["ring", "background", 3],
  ["ok", "card", 3], ["warn", "card", 3], ["none", "card", 3],
  ["chart-1", "card", 3], ["chart-2", "card", 3], ["chart-3", "card", 3], ["chart-4", "card", 3], ["chart-5", "card", 3],
]

for (const mode of [":root", ".dark"] as const) {
  describe(`contraste de tokens (${mode === ":root" ? "claro" : "oscuro"})`, () => {
    const t = { ...readTokens(css, ":root"), ...(mode === ".dark" ? readTokens(css, ".dark") : {}) }
    for (const [fg, bg, min] of [...TEXT, ...NON_TEXT]) {
      it(`${fg} sobre ${bg} ≥ ${min}:1`, () => {
        expect(t[fg], `falta --${fg}`).toBeDefined()
        expect(t[bg], `falta --${bg}`).toBeDefined()
        expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(min)
      })
    }
  })
}

describe("lima solo sobre tinta", () => {
  it("lima sobre blanco no es usable (documenta la regla)", () => {
    expect(contrast("oklch(0.91 0.17 125)", "#ffffff")).toBeLessThan(3)
  })
})
