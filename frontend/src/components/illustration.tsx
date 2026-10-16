import { CircleCheckIcon, CircleIcon, ContrastIcon } from "lucide-react"
import manifest from "@/assets/illustrations/manifest.json"
import { cn } from "@/lib/utils"

/**
 * Ilustraciones unDraw recoloreadas al teal de marca (scripts/illustrations.py). Reglas:
 * decorativas (alt="" + aria-hidden, WCAG 1.1.1) · como máximo una por pantalla · nunca en el bloque del siguiente
 * paso (ceguera a banners) ni mientras grabás o escribís · width/height reales para no mover el layout (CLS).
 */
const urls = import.meta.glob("../assets/illustrations/*.webp", { eager: true, query: "?url", import: "default" }) as Record<string, string>
const SRC: Record<string, string> = Object.fromEntries(Object.entries(urls).map(([k, v]) => [k.split("/").pop()!.replace(".webp", ""), v]))
const DIM = manifest as Record<string, { w: number; h: number }>

export type IllustrationName = keyof typeof manifest

export function Illustration({ name, className, eager }: { name: IllustrationName; className?: string; eager?: boolean }) {
  const d = DIM[name]
  if (!SRC[name] || !d) return null
  return (
    <img src={SRC[name]} width={d.w} height={d.h} alt="" aria-hidden loading={eager ? "eager" : "lazy"} decoding="async"
      className={cn("h-auto w-full max-w-60 select-none dark:opacity-85", className)} draggable={false} />
  )
}

/** Estado vacío / espera / éxito: una ilustración + un título que dice qué pasa + qué hacer. */
export function EmptyState({ name, title, children, action, className }: {
  name: IllustrationName; title: string; children?: React.ReactNode; action?: React.ReactNode; className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-xl border border-dashed p-6 text-center", className)}>
      <Illustration name={name} className="max-w-44" />
      <p className="text-body font-semibold">{title}</p>
      {children && <div className="max-w-[60ch] text-label text-muted-foreground">{children}</div>}
      {action}
    </div>
  )
}

const EVIDENCE = {
  strong: { label: "Evidencia fuerte", icon: CircleCheckIcon, cls: "bg-ok-bg text-ok" },
  partial: { label: "Evidencia parcial", icon: ContrastIcon, cls: "bg-warn-bg text-warn" },
  gap: { label: "Sin evidencia", icon: CircleIcon, cls: "bg-none-bg text-none" },
} as const

/** Estado de evidencia: icono + texto + color (nunca solo color, WCAG 1.4.1). Describe el CV, no a la persona. */
export function EvidenceStatus({ coverage, className }: { coverage?: "strong" | "partial" | "gap"; className?: string }) {
  if (!coverage) return null
  const e = EVIDENCE[coverage]
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium", e.cls, className)}>
      <e.icon className="size-3.5" aria-hidden /> {e.label}
    </span>
  )
}
