import { CircleCheckIcon, CircleIcon, ContrastIcon } from "lucide-react"
import manifest from "@/assets/illustrations/manifest.json"
import { cn } from "@/lib/utils"

/**
 * unDraw illustrations recolored to the brand teal (scripts/illustrations.py). Rules:
 * decorative (alt="" + aria-hidden, WCAG 1.1.1) · at most one per screen · never in the next-step
 * block (banner blindness) nor while recording or writing · real width/height to avoid layout shift (CLS).
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

/** Empty / waiting / success state: an illustration + a title saying what's happening + what to do. */
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

/** Evidence status: icon + text + color (never color alone, WCAG 1.4.1). Describes the CV, not the person. */
export function EvidenceStatus({ coverage, className }: { coverage?: "strong" | "partial" | "gap"; className?: string }) {
  if (!coverage) return null
  const e = EVIDENCE[coverage]
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium", e.cls, className)}>
      <e.icon className="size-3.5" aria-hidden /> {e.label}
    </span>
  )
}
