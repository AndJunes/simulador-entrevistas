// Tema: claro por defecto (Piepenbrock vía NN/g: con visión normal el claro rinde mejor, sobre todo con letra chica);
// oscuro opcional. Se recuerda en este navegador (comodidad, no dato crítico).
export type ThemePref = "light" | "dark" | "system"
const KEY = "simulador.theme"
const media = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null

export function readTheme(): ThemePref {
  try { return (localStorage.getItem(KEY) as ThemePref) || "light" } catch { return "light" }
}
export function applyTheme(pref: ThemePref = readTheme()) {
  const dark = pref === "dark" || (pref === "system" && !!media?.matches)
  document.documentElement.classList.toggle("dark", dark)
  document.documentElement.style.colorScheme = dark ? "dark" : "light"
}
export function setTheme(pref: ThemePref) {
  try { localStorage.setItem(KEY, pref) } catch { /* sin almacenamiento */ }
  applyTheme(pref)
}
media?.addEventListener("change", () => readTheme() === "system" && applyTheme("system"))
