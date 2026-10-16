/**
 * WCAG 2.2 A/AA automatizado (axe-core cubre ~57 % de los problemas por volumen, Deque): se complementa con
 * teclado + VoiceOver manual. También: reflow a 320 px (1.4.10), foco visible,
 * navegación con aria-current y movimiento reducido.
 */
import AxeBuilder from "@axe-core/playwright"
import { expect, type Page, test } from "@playwright/test"

let appId = ""
test.beforeAll(async ({ request }) => {
  const apps = await (await request.get("http://localhost:8000/api/applications")).json()
  appId = (apps.find((a: { generator_version?: string; questions: number }) => a.questions > 10) ?? apps[0]).id
})

const ROUTES = (id: string) => [
  ["Postulaciones", "/"],
  ["Resumen", `/p/${id}`],
  ["Practicar", `/p/${id}/practicar`],
  ["Banco de preguntas", `/p/${id}/preguntas`],
  ["Progreso", `/p/${id}/resultados`],
  ["Requisitos", `/p/${id}/requisitos`],
  ["Cobertura", `/p/${id}/requisitos/cobertura`],
  ["CV y evidencia", `/p/${id}/evidencia`],
  ["Empresa y puesto", `/p/${id}/empresa`],
  ["Ejercicio", `/p/${id}/ejercicio`],
  ["Calidad", `/p/${id}/calidad`],
]

async function open(page: Page, path: string, theme: "light" | "dark") {
  await page.addInitScript((t) => localStorage.setItem("simulador.theme", t), theme)
  await page.goto(path)
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(400)
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`axe WCAG 2.2 AA · tema ${theme}`, () => {
    for (const [name, path] of ROUTES("APP")) {
      test(name, async ({ page }) => {
        await open(page, path.replace("APP", appId), theme)
        const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze()
        const summary = r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} · ${v.nodes[0]?.target.join(" ")}`)
        expect(summary, summary.join("\n")).toEqual([])
      })
    }
  })
}

test.describe("reflow 320 px (WCAG 1.4.10)", () => {
  test.use({ viewport: { width: 320, height: 640 } })
  for (const [name, path] of ROUTES("APP")) {
    test(name, async ({ page }) => {
      await open(page, path.replace("APP", appId), "light")
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, `scroll horizontal de ${overflow}px`).toBeLessThanOrEqual(1)
    })
  }
})

test("navegación: aria-current, foco visible y título del documento", async ({ page }) => {
  await open(page, `/p/${appId}`, "light")
  await expect(page.locator('nav[aria-label="Secciones de la postulación"] a[aria-current="page"]')).toHaveText("Resumen")
  await expect(page).toHaveTitle(/^Resumen · /)
  await page.getByRole("link", { name: /Requisitos/ }).first().click()
  await expect(page).toHaveTitle(/^Requisitos del puesto · /)
  await expect(page.locator("h1")).toBeFocused()
  await page.keyboard.press("Tab")
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineStyle)
  expect(outline).not.toBe("none")
})

test("filtros de requisitos: aria-pressed y mensaje de estado", async ({ page }) => {
  await open(page, `/p/${appId}/requisitos`, "light")
  const btn = page.getByRole("group", { name: "Filtrar requisitos" }).getByRole("button").nth(1)
  await expect(btn).toHaveAttribute("aria-pressed", "false")
  await btn.click()
  await expect(btn).toHaveAttribute("aria-pressed", "true")
  await expect(btn).toBeFocused()
  await expect(page.getByRole("status").filter({ hasText: "Mostrando" })).toBeVisible()
  const disclosure = page.locator('button[aria-expanded]').first()
  await disclosure.click()
  await expect(disclosure).toHaveAttribute("aria-expanded", "true")
})

test("búsqueda + filtro se combinan y el vacío permite limpiar", async ({ page }) => {
  await open(page, `/p/${appId}/requisitos`, "light")
  const status = page.getByRole("status").filter({ hasText: "Mostrando" })
  const total = Number((await status.textContent())!.match(/de (\d+)/)![1])
  await page.getByRole("button", { name: /^Obligatorios/ }).click()
  const must = Number((await status.textContent())!.match(/Mostrando (\d+)/)![1])
  expect(must).toBeLessThanOrEqual(total)
  await page.getByRole("searchbox", { name: "Buscar requisito" }).fill("zzz-no-existe")
  await expect(page.getByText(/Ningún requisito coincide/)).toBeVisible()
  await page.getByRole("button", { name: "Limpiar búsqueda y filtros" }).click()
  await expect(status).toContainText(`Mostrando ${total} de ${total}`)
})

test("Resumen: el modo elegido cambia el CTA y lleva a Practicar con ese modo", async ({ page }) => {
  await open(page, `/p/${appId}`, "light")
  await page.getByRole("radio", { name: /Simulacro completo/ }).click()
  await expect(page.getByRole("radio", { name: /Simulacro completo/ })).toHaveAttribute("aria-checked", "true")
  await page.getByRole("button", { name: "Continuar con Simulacro completo →" }).click()
  await expect(page).toHaveURL(/\/practicar\?modo=mock/)
  await expect(page.getByRole("radio", { name: "Simulacro de corrido" })).toBeChecked()
})

test.describe("movimiento reducido", () => {
  test.use({ reducedMotion: "reduce" })
  test("sin transiciones largas", async ({ page }) => {
    await open(page, `/p/${appId}/requisitos`, "light")
    const d = await page.evaluate(() => getComputedStyle(document.querySelector(".collapse-grid") as Element).transitionDuration)
    expect(parseFloat(d)).toBeLessThan(0.05)
  })
})
