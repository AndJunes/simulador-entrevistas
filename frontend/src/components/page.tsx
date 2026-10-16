import { CircleCheckIcon, CircleIcon, ContrastIcon } from "lucide-react"
import { Link } from "react-router"
import { cn } from "@/lib/utils"

/**
 * Piezas de layout compartidas: un solo sistema, sobre los tokens de index.css.
 * Cada pieza tiene una responsabilidad; nada de booleanos que cambien el layout entero.
 */

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-caption font-extrabold uppercase tracking-[0.14em] text-teal-dark", className)}>{children}</p>
}

/** Encabezado de página: eyebrow + h1 + una frase + acción secundaria a la derecha. */
export function PageHeader({ eyebrow, title, intro, action }: { eyebrow: string; title: React.ReactNode; intro?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <header className="mb-[26px] flex flex-col items-start justify-between gap-x-6 gap-y-4 sm:flex-row sm:items-end">
      <div className="min-w-0">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 tabIndex={-1} className="mb-2.5 mt-[7px] text-[clamp(1.75rem,3vw,2.45rem)] font-extrabold leading-[1.08] tracking-[-0.05em] outline-none">{title}</h1>
        {intro && <p className="max-w-[670px] text-label text-muted-foreground">{intro}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}

export function Panel({ className, children, ...rest }: React.ComponentProps<"section">) {
  return <section className={cn("min-w-0 rounded-card border bg-card p-4 sm:p-5", className)} {...rest}>{children}</section>
}

/** Encabezado de sección: título que dice el propósito + una línea + enlace opcional. */
export function SectionHead({ title, sub, id, eyebrow, to, link, className }: {
  title: string; sub?: string; id?: string; eyebrow?: string; to?: string; link?: string; className?: string
}) {
  return (
    <div className={cn("mb-3.5 flex flex-wrap items-end justify-between gap-x-4 gap-y-1", className)}>
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-1">{eyebrow}</Eyebrow>}
        <h2 id={id} className="mb-1 text-[19px] font-bold tracking-[-0.035em]">{title}</h2>
        {sub && <p className="text-caption text-muted-foreground">{sub}</p>}
      </div>
      {to && link && <Link to={to} className="whitespace-nowrap py-2 text-caption font-extrabold text-teal-dark hover:underline">{link} →</Link>}
    </div>
  )
}

/** Tarjeta de métrica: icono 38px + número + etiqueta + explicación breve. */
export function MetricCard({ icon, tone = "mint", value, label, desc, to }: {
  icon: React.ReactNode; tone?: "mint" | "info" | "warn"; value: React.ReactNode; label: string; desc: string; to?: string
}) {
  const body = (
    <>
      <span aria-hidden className={cn("grid size-[38px] shrink-0 place-items-center rounded-xl [&_svg]:size-[18px]",
        tone === "mint" && "bg-mint text-primary", tone === "info" && "bg-info-bg text-info", tone === "warn" && "bg-warn-bg text-warn")}>{icon}</span>
      <span className="min-w-0">
        <span className="num block text-[23px] font-extrabold leading-[1.05] tracking-[-0.05em] sm:text-[27px]">{value}</span>
        <span className="mb-0.5 mt-1 block text-caption font-bold text-foreground">{label}</span>
        <span className="block text-caption text-muted-foreground">{desc}</span>
      </span>
    </>
  )
  const cls = "flex h-full min-w-0 items-start gap-3 rounded-[17px] border bg-card px-[15px] py-[13px] sm:px-5 sm:py-[18px]"
  return <li>{to ? <Link to={to} className={cn(cls, "transition-[border-color,transform] duration-[var(--dur-fast)] hover:-translate-y-px hover:border-primary/50")}>{body}</Link> : <div className={cls}>{body}</div>}</li>
}

const COV = {
  strong: { label: "Evidencia fuerte", short: "Fuerte", icon: CircleCheckIcon, cls: "bg-ok-bg text-ok" },
  partial: { label: "Evidencia parcial", short: "Parcial", icon: ContrastIcon, cls: "bg-warn-bg text-warn" },
  gap: { label: "Sin evidencia", short: "Sin evidencia", icon: CircleIcon, cls: "bg-none-bg text-none" },
} as const

/** Estado de evidencia: icono + texto + color, nunca solo color (WCAG 1.4.1). Describe el CV, no a la persona. */
export function StatusBadge({ coverage, short, className }: { coverage?: "strong" | "partial" | "gap"; short?: boolean; className?: string }) {
  if (!coverage) return null
  const c = COV[coverage]
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[7px] px-2 py-1 text-caption font-extrabold", c.cls, className)}>
      <c.icon className="size-3.5" aria-hidden />{short ? c.short : c.label}
    </span>
  )
}

const TAG = { mint: "bg-mint text-teal-dark", warn: "bg-warn-bg text-warn", none: "bg-none-bg text-none", info: "bg-info-bg text-info", soft: "bg-soft text-muted-foreground" } as const

/** Etiqueta chica para metadatos: tipo de experiencia, estado de sesión, "Sugerido". */
export function Tag({ tone = "mint", children, className }: { tone?: keyof typeof TAG; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-[7px] px-2 py-1 text-caption font-extrabold", TAG[tone], className)}>{children}</span>
}

/** Icono lineal en contenedor de 38–40 px. */
export function IconBox({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span aria-hidden className={cn("grid size-[38px] shrink-0 place-items-center rounded-xl bg-soft text-teal-dark [&_svg]:size-[18px]", className)}>{children}</span>
}
