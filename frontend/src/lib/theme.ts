// Theme: light by default (Piepenbrock via NN/g: with normal vision light performs better, especially with small type);
// dark optional. Remembered in this browser (convenience, not critical data).
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
  try { localStorage.setItem(KEY, pref) } catch { /* storage unavailable */ }
  applyTheme(pref)
}
media?.addEventListener("change", () => readTheme() === "system" && applyTheme("system"))
