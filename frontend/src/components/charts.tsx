import { useState } from "react"

const fmt = (v: number) => (Math.abs(v) >= 10 ? Math.round(v) : Math.round(v * 10) / 10)

/**
 * Gráfico de línea de UNA serie (small multiple). Guía dataviz: una serie → sin leyenda (el título la nombra),
 * un solo tono (primary), línea 2px, marcadores ≥8px, grilla recesiva, tooltip al pasar el mouse o con foco.
 */
export function LineSmall({ title, unit, points, yMin, yMax, hint }: {
  title: string; unit?: string; points: { x: string; y: number | null }[]; yMin?: number; yMax?: number; hint?: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 280, H = 120, P = { l: 30, r: 10, t: 10, b: 22 }
  const vals = points.map((p) => p.y).filter((v): v is number => v != null)
  if (!vals.length) {
    return (
      <figure className="rounded-xl border bg-card p-4">
        <figcaption className="text-sm font-medium">{title}</figcaption>
        <p className="mt-6 text-sm text-muted-foreground">Todavía sin datos.</p>
      </figure>
    )
  }
  let lo = yMin ?? Math.min(...vals), hi = yMax ?? Math.max(...vals)
  if (hi === lo) { lo -= 1; hi += 1 }   // un solo punto: escala con margen, no colapsada
  const span = hi - lo
  const x = (i: number) => P.l + (points.length === 1 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (points.length - 1))
  const y = (v: number) => P.t + (1 - (v - lo) / span) * (H - P.t - P.b)
  const path = points.map((p, i) => (p.y == null ? null : `${x(i)},${y(p.y)}`)).filter(Boolean).join(" L ")
  const last = [...points].reverse().find((p) => p.y != null)
  return (
    <figure className="rounded-xl border bg-card p-4">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{title}</span>
        {last && <span className="font-mono text-sm tabular-nums text-muted-foreground">{fmt(last.y!)}{unit}</span>}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label={`${title}: ${points.map((p) => `${p.x} ${p.y ?? "sin dato"}`).join(", ")}`}>
        {[lo, (lo + hi) / 2, hi].map((g, i) => (
          <g key={i}>
            <line x1={P.l} x2={W - P.r} y1={y(g)} y2={y(g)} stroke="currentColor" className="text-border" strokeWidth={1} />
            <text x={P.l - 4} y={y(g) + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">{fmt(g)}</text>
          </g>
        ))}
        {points.length > 1 && <path d={`M ${path}`} fill="none" stroke="var(--color-primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {points.map((p, i) =>
          p.y == null ? null : (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0}>
              <circle cx={x(i)} cy={y(p.y)} r={12} fill="transparent" />
              <circle cx={x(i)} cy={y(p.y)} r={4} fill="var(--color-primary)" stroke="var(--color-card)" strokeWidth={2} />
            </g>
          ),
        )}
        {points.map((p, i) => (i === 0 || i === points.length - 1 ? (
          <text key={`l${i}`} x={x(i)} y={H - 6} textAnchor={i === 0 && points.length > 1 ? "start" : "end"} className="fill-muted-foreground text-[9px]">{p.x.slice(5)}</text>
        ) : null))}
        {hover != null && points[hover].y != null && (
          <g pointerEvents="none">
            <rect x={Math.min(x(hover) - 34, W - 78)} y={Math.max(y(points[hover].y!) - 30, 0)} width={74} height={22} rx={4} fill="var(--color-popover)" stroke="var(--color-border)" />
            <text x={Math.min(x(hover) - 34, W - 78) + 37} y={Math.max(y(points[hover].y!) - 30, 0) + 15} textAnchor="middle" className="fill-foreground text-[10px]">
              {points[hover].x.slice(5)}: {fmt(points[hover].y!)}{unit}
            </text>
          </g>
        )}
      </svg>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </figure>
  )
}
