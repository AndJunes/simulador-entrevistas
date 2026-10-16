/** Contraste WCAG 2.x (luminancia relativa) para colores OKLCH o hex. Lo usa el test de tokens (contrast.test.ts). */
type RGB = [number, number, number]   // sRGB codificado 0–1

export function oklchToSrgb(L: number, C: number, h: number): RGB {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
  return lin.map((x) => { x = Math.min(Math.max(x, 0), 1); return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055 }) as RGB
}

export function parseColor(v: string): RGB {
  const t = v.trim()
  if (t.startsWith("#")) {
    const h = t.slice(1)
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as RGB
  }
  const m = t.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/)
  if (!m) throw new Error(`color no soportado: ${v}`)
  return oklchToSrgb(Number(m[1]), Number(m[2]), Number(m[3]))
}

const lum = (c: RGB) => {
  const [r, g, b] = c.map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const la = lum(parseColor(a)), lb = lum(parseColor(b))
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Lee las variables `--x: valor;` de un bloque CSS (`:root {…}` o `.dark {…}`). */
export function readTokens(css: string, selector: ":root" | ".dark"): Record<string, string> {
  const out: Record<string, string> = {}
  const re = new RegExp(`(^|\\n)${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`, "g")
  for (const block of css.matchAll(re)) {
    for (const m of block[2].matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].replace(/\/\*.*?\*\//g, "").trim()
  }
  return out
}
