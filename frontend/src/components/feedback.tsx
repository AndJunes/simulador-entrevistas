import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon, ChevronDownIcon, InfoIcon, LightbulbIcon, SparklesIcon, TargetIcon } from "lucide-react"
import { Fragment, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { type Coaching, type Comparison, type EvaluationBody, type Metrics, type Transcript } from "@/lib/api"
import { cn } from "@/lib/utils"
import { ScoreDots } from "./common"

// Transcript

/** Fillers: background + underline + "muletilla" label (WCAG 1.4.1). Pauses: ⏸ with duration. Low confidence: dotted. */
export function TranscriptView({ transcript, metrics }: { transcript: Transcript; metrics?: Metrics | null }) {
  const fill = new Set(metrics?.filler_word_idx ?? [])
  const low = new Set(metrics?.low_confidence_idx ?? [])
  const pauses = [...(metrics?.long_pauses ?? [])]
  const words = transcript.words ?? []
  if (!words.length) return <p className="text-sm leading-7">{transcript.text}</p>
  return (
    <div>
      <p className="text-[15px] leading-8">
        {words.map((w, i) => {
          const pauseHere = pauses.find((p) => p.at_s >= w.end_s - 0.05 && (i + 1 >= words.length || p.at_s <= words[i + 1].start_s + 0.3))
          if (pauseHere) pauses.splice(pauses.indexOf(pauseHere), 1)
          return (
            <Fragment key={i}>
              <span
                className={cn(
                  fill.has(i) && "rounded bg-filler px-0.5 underline decoration-2 underline-offset-4",
                  low.has(i) && !fill.has(i) && "underline decoration-lowconf decoration-dotted underline-offset-4",
                )}
                title={fill.has(i) ? "muletilla" : low.has(i) ? "posible error de transcripción" : undefined}
              >
                {w.word}
                {fill.has(i) && <span className="sr-only"> (muletilla)</span>}
              </span>
              {pauseHere && (
                <span className="mx-1 inline-flex items-center rounded bg-pause px-1.5 font-mono text-xs" title="pausa larga">
                  ⏸ {pauseHere.dur_s.toFixed(1)} s<span className="sr-only"> de pausa</span>
                </span>
              )}{" "}
            </Fragment>
          )
        })}
      </p>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span><span className="rounded bg-filler px-1 underline">eh</span> muletilla</span>
        <span><span className="rounded bg-pause px-1 font-mono">⏸ 2.1 s</span> pausa larga</span>
        <span><span className="underline decoration-dotted">palabra</span> posible error de transcripción (no te penaliza)</span>
      </p>
    </div>
  )
}

// Delivery metrics

function Metric({ label, value, hint, status }: { label: string; value: string; hint?: string; status?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-xl tabular-nums">{value}</div>
      {status && <div className="mt-0.5 text-xs">{status}</div>}
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

export function MetricsPanel({ m }: { m: Metrics }) {
  const [lo, hi] = m.duration_target_s
  const fillers = Object.entries(m.fillers)
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Metric label="Empezaste a hablar a los" value={`${m.first_word_latency_s.toFixed(1)} s`} hint="pausar unos segundos para pensar está bien" />
        <Metric label="Duración" value={`${Math.round(m.speech_duration_s)} s`} status={`objetivo ${lo}–${hi} s · ${m.duration_status}`} />
        <Metric label="Ritmo" value={`${m.wpm}`} hint="palabras por minuto" />
        <Metric label="Muletillas" value={`${m.fillers_per_min}/min`} hint={fillers.length ? fillers.map(([k, v]) => `${k} ×${v}`).join(" · ") : "ninguna detectada"} />
      </div>
      {(m.long_pauses.length > 0 || m.repetitions.length > 0 || m.stretched_words.length > 0) && (
        <p className="text-sm text-muted-foreground">
          {m.long_pauses.length > 0 && <>Hiciste {m.long_pauses.length} pausa{m.long_pauses.length > 1 ? "s" : ""} de más de {m.long_pause_threshold_s} s. </>}
          {m.repetitions.length > 0 && <>Repetiste: “{m.repetitions.join("”, “")}”. </>}
          {m.stretched_words.length > 0 && <>Palabras estiradas (vacilación): {m.stretched_words.join(", ")}.</>}
        </p>
      )}
      {m.mic_level_db !== null && m.mic_level_db < -40 && (
        <p className="flex items-center gap-2 text-sm"><InfoIcon className="size-4" /> El micrófono grabó bajo ({m.mic_level_db} dB): acercate o subí la ganancia.</p>
      )}
      {m.duration_target_source == null && <p className="text-xs text-muted-foreground">El rango de duración es una referencia provisoria (sin fuente externa para este tipo de pregunta).</p>}
    </div>
  )
}

// Evaluation

export function FeedbackView({ ev, comparison }: { ev: EvaluationBody; comparison?: Comparison | null }) {
  return (
    <div className="flex flex-col gap-6">
      {/* Feed up: what the question assesses */}
      {ev.feed_up && (
        <p className="flex items-start gap-2 rounded-lg bg-accent/60 p-3 text-sm text-accent-foreground">
          <TargetIcon className="mt-0.5 size-4 shrink-0" /> <span><strong>Qué evalúa esta pregunta:</strong> {ev.feed_up}</span>
        </p>
      )}

      {comparison && <ComparisonView c={comparison} />}

      {/* Strengths first (concrete behaviours) */}
      <section aria-labelledby="fort">
        <h3 id="fort" className="mb-2 flex items-center gap-2 font-medium"><SparklesIcon className="size-4" /> Lo que hiciste bien</h3>
        <ul className="flex flex-col gap-1.5 text-sm">
          {ev.strengths.map((s, i) => <li key={i} className="flex gap-2"><span aria-hidden>•</span>{s}</li>)}
        </ul>
      </section>

      {/* Feed forward: at most 3 improvements with an example sentence */}
      <section aria-labelledby="mej">
        <h3 id="mej" className="mb-2 flex items-center gap-2 font-medium"><LightbulbIcon className="size-4" /> Para la próxima (en orden de prioridad)</h3>
        <ol className="flex flex-col gap-3">
          {ev.improvements.map((imp, i) => (
            <li key={i} className="rounded-lg border p-3">
              <div className="font-medium">{i + 1}. {imp.issue}</div>
              <div className="mt-1 text-sm text-muted-foreground">{imp.why}</div>
              <div className="mt-2 rounded-md bg-muted p-2 text-sm"><span className="text-muted-foreground">Decí algo como: </span>“{imp.example}”</div>
            </li>
          ))}
        </ol>
      </section>

      {/* Feed back: rubric with evidence */}
      <section aria-labelledby="rub">
        <h3 id="rub" className="mb-2 font-medium">Cómo te fue en cada criterio</h3>
        <ul className="flex flex-col divide-y rounded-lg border">
          {ev.criteria.map((c) => (
            <li key={c.id} className="p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{c.label}</span>
                <ScoreDots score={c.score} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{c.justification}</p>
              {c.evidence_quote && <blockquote className="mt-1 border-l-2 pl-2 text-xs italic text-muted-foreground">“{c.evidence_quote}”</blockquote>}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">Sin nota global a propósito: cada criterio se trabaja por separado. Confianza de la evaluación: {ev.confidence}.</p>
      </section>

      {(ev.job_requirements_addressed.length > 0 || ev.job_requirements_missed.length > 0 || ev.unsupported_claims_vs_cv.length > 0) && (
        <section className="flex flex-col gap-2 text-sm">
          {ev.job_requirements_addressed.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">Requisitos del puesto que tocaste: {ev.job_requirements_addressed.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}</div>
          )}
          {ev.job_requirements_missed.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">Podrías conectar también: {ev.job_requirements_missed.map((r) => <Badge key={r} variant="outline">{r}</Badge>)}</div>
          )}
          {ev.unsupported_claims_vs_cv.length > 0 && <div>Ojo, no está en tu CV: {ev.unsupported_claims_vs_cv.join(" · ")}</div>}
        </section>
      )}

      {/* Model answer: only after trying, collapsed */}
      <ModelAnswer text={ev.model_answer} />
    </div>
  )
}

export function ModelAnswer({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const parts = text.split(/(\[[^\]]+\])/g)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border">
      <CollapsibleTrigger className="flex w-full items-center justify-between p-3 text-left font-medium focus-visible:outline-2">
        Ver una respuesta modelo (solo con hechos de tu CV)
        <ChevronDownIcon className={cn("size-4 transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3 text-[15px] leading-7">
        {parts.map((p, i) =>
          p.startsWith("[") ? (
            <mark key={i} className="rounded bg-filler px-1 not-italic">{p}<span className="sr-only"> (completá con tu dato)</span></mark>
          ) : (
            <span key={i}>{p}</span>
          ),
        )}
        <p className="mt-2 text-xs text-muted-foreground">Lo resaltado entre corchetes no está en tu CV: completalo con tu dato real, no lo inventes.</p>
      </CollapsibleContent>
    </Collapsible>
  )
}

export const CRITERIA_LABELS: Record<string, string> = {
  star_situation: "Situación", star_task: "Tarea", star_action: "Acción", star_result: "Resultado", relevance: "Relevancia",
  conciseness: "Concisión", job_alignment: "Alineación con el puesto", cv_consistency: "Coherencia con el CV",
  clarity_structure: "Claridad y estructura", motivation_company_knowledge: "Motivación y conocimiento de la empresa",
  experience_role_alignment: "Experiencia vs. el rol", communication_english: "Comunicación en inglés",
  communication_clarity: "Claridad oral", professionalism_logistics: "Profesionalismo y logística",
}

const METRIC_LABELS: Record<string, string> = {
  first_word_latency_s: "Inicio (s)", speech_duration_s: "Duración (s)", wpm: "Palabras/min", fillers_per_min: "Muletillas/min",
}

export function ComparisonView({ c }: { c: Comparison }) {
  const labels = CRITERIA_LABELS
  return (
    <Card size="sm" className="bg-accent/40">
      <CardHeader>
        <CardTitle className="text-base">Antes → ahora</CardTitle>
        <CardDescription>Comparado con tu intento anterior de esta pregunta.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-x-6 gap-y-1 text-sm md:grid-cols-2">
        {Object.entries(c.criteria).map(([k, [a, b]]) => {
          const d = a == null ? 0 : b - a
          return (
            <div key={k} className="flex items-center justify-between gap-2">
              <span>{labels[k] ?? k.replace(/_/g, " ")}</span>
              <span className="flex items-center gap-1 font-mono tabular-nums">
                {a ?? "–"} <ArrowRightIcon className="size-3" /> {b}
                {d > 0 ? <ArrowUpIcon className="size-3.5" aria-label="mejoró" /> : d < 0 ? <ArrowDownIcon className="size-3.5" aria-label="bajó" /> : <span className="sr-only">igual</span>}
              </span>
            </div>
          )
        })}
        {Object.entries(c.metrics).map(([k, [a, b]]) => (
          <div key={k} className="flex items-center justify-between gap-2 text-muted-foreground">
            <span>{METRIC_LABELS[k] ?? k}</span>
            <span className="font-mono tabular-nums">{a ?? "–"} → {b ?? "–"}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// Blank mode

export function CoachingView({ c, compact = false }: { c: Coaching["coaching"]; compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <div className="font-medium">Tu esqueleto</div>
        <ol className="flex list-decimal flex-col gap-1 pl-5">{c.skeleton.map((b, i) => <li key={i}>{b}</li>)}</ol>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-lg bg-accent/60 p-3 text-accent-foreground">{c.calm_down}</p>
      <section>
        <h3 className="mb-2 font-medium">Para ganar tiempo (con honestidad)</h3>
        <ul className="flex flex-col gap-1.5">{c.buy_time_phrases.map((p, i) => <li key={i} className="rounded-md bg-muted p-2 text-sm">“{p}”</li>)}</ul>
      </section>
      <section>
        <h3 className="mb-1 font-medium">Qué buscan con esta pregunta</h3>
        <p className="text-sm text-muted-foreground">{c.approach}</p>
      </section>
      <section>
        <h3 className="mb-2 font-medium">Historias de tu CV que encajan</h3>
        <ul className="flex flex-col gap-2">{c.cv_examples.map((e, i) => <li key={i} className="rounded-lg border p-3 text-sm"><div className="font-medium">{e.title}</div><div className="text-muted-foreground">{e.why_it_fits}</div></li>)}</ul>
      </section>
      <section>
        <h3 className="mb-2 font-medium">Esqueleto para responder ahora</h3>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">{c.skeleton.map((b, i) => <li key={i}>{b}</li>)}</ol>
      </section>
      <section>
        <h3 className="mb-1 font-medium">Si de verdad no sabés</h3>
        <p className="rounded-md bg-muted p-2 text-sm">“{c.if_you_truly_dont_know}”</p>
      </section>
    </div>
  )
}
