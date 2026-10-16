import { CheckIcon, LoaderCircleIcon, PauseIcon, PlayIcon, RotateCcwIcon, Volume2Icon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { applyVoicePrefs } from "@/lib/audio"
import { cn } from "@/lib/utils"

/** Región aria-live (WCAG 4.1.3): anuncia "Grabando", "Paso 2 de 3", "Feedback listo" a lectores de pantalla. */
export function LiveRegion({ message }: { message: string }) {
  return (
    <div aria-live="polite" role="status" className="sr-only">
      {message}
    </div>
  )
}

/** Medidor de nivel: barra + texto (no depende solo del color). */
export function LevelMeter({ db, className, label = "Nivel del micrófono" }: { db: number; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, ((db + 60) / 50) * 100))
  const status = db < -50 ? "muy bajo" : db < -40 ? "bajo" : db > -12 ? "muy alto" : "bien"
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label={label}
        aria-valuemin={-60}
        aria-valuemax={-10}
        aria-valuenow={Math.round(db)}
        aria-valuetext={`${Math.round(db)} dB, ${status}`}
      >
        <div className="h-full rounded-full bg-primary transition-[width] duration-75" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-20 text-right font-mono text-xs text-muted-foreground tabular-nums">{status}</span>
    </div>
  )
}

/** 1–5 con puntos + texto "3 de 5" (no solo color). */
export function ScoreDots({ score, size = "md" }: { score: number; size?: "sm" | "md" }) {
  const d = size === "sm" ? "size-2" : "size-2.5"
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${score} de 5`} title={`${score} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} aria-hidden className={cn(d, "rounded-full border border-primary/50", i <= score ? "bg-primary" : "bg-transparent")} />
      ))}
      <span className="ml-1 font-mono text-xs text-muted-foreground tabular-nums">{score}/5</span>
    </span>
  )
}

export interface Stage { key: string; label: string }

/** Etapas con nombre (NN/g: >10 s necesita progreso explícito). */
export function StageProgress({ stages, current, done, etaS }: { stages: Stage[]; current: string; done: string[]; etaS?: number }) {
  const idx = stages.findIndex((s) => s.key === current)
  return (
    <ol className="flex flex-col gap-2" aria-label="Progreso del procesamiento">
      {stages.map((s, i) => {
        const isDone = done.includes(s.key)
        const isCur = s.key === current && !isDone
        return (
          <li key={s.key} className={cn("flex items-center gap-3 text-sm", !isDone && !isCur && "text-muted-foreground")}>
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs",
                isDone && "border-primary bg-primary text-primary-foreground",
                isCur && "border-primary text-primary",
              )}
              aria-hidden
            >
              {isDone ? <CheckIcon className="size-3.5" /> : isCur ? <LoaderCircleIcon className="size-3.5 motion-safe:animate-spin" /> : i + 1}
            </span>
            <span>
              {s.label}
              {isCur && etaS ? <span className="text-muted-foreground"> · ~{etaS} s</span> : null}
            </span>
            <span className="sr-only">{isDone ? "listo" : isCur ? `en curso, paso ${idx + 1} de ${stages.length}` : "pendiente"}</span>
          </li>
        )
      })}
    </ol>
  )
}

/** Reproductor con pausa/repetir (WCAG 1.4.2: audio automático > 3 s debe poder detenerse). */
export function AudioPlayer({ url, label, autoPlay = false, onEnded }: { url: string | null; label: string; autoPlay?: boolean; onEnded?: () => void }) {
  const ref = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    const a = ref.current
    if (!a || !url) return
    a.src = url
    applyVoicePrefs(a)
    if (autoPlay) a.play().catch(() => setPlaying(false))
  }, [url, autoPlay])
  if (!url) return null
  return (
    <div className="inline-flex items-center gap-1">
      <audio
        ref={ref}
        onPlay={(e) => { applyVoicePrefs(e.currentTarget); setPlaying(true) }}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); onEnded?.() }}
        preload="auto"
      />
      <Button variant="outline" size="sm" onClick={() => (playing ? ref.current?.pause() : ref.current?.play())} aria-label={playing ? `Pausar ${label}` : `Escuchar ${label}`}>
        {playing ? <PauseIcon /> : <Volume2Icon />}
        {playing ? "Pausar" : label}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => { if (ref.current) { ref.current.currentTime = 0; ref.current.play() } }}
        aria-label={`Repetir ${label}`}
      >
        <RotateCcwIcon />
      </Button>
    </div>
  )
}

export function PlayButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} aria-label={label}>
      <PlayIcon /> {label}
    </Button>
  )
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px]">{children}</kbd>
}
