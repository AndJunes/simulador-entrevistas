import { CheckIcon, CircleDashedIcon, CircleIcon, CopyIcon, DumbbellIcon, LightbulbIcon, MessageCircleQuestionIcon, PencilIcon, SparklesIcon, ThumbsDownIcon, ThumbsUpIcon } from "lucide-react"
import { Fragment, useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api, type Annotation, type Coaching, type Criterion, type EvaluationBody, type Lang, LEVEL_LABEL, type Metrics, type Question, type Transcript } from "@/lib/api"
import { anchor, answerWords } from "@/lib/transcript"
import { cn } from "@/lib/utils"
import { AudioPlayer, ScoreDots } from "./common"

// Datos de ejemplo {{…}}

/** El evaluador marca con {{…}} los detalles que NO están en tu CV (un número, una duración): se ven punteados. */
export function ExampleText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\{\{[^}]+\}\})/g)
  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.startsWith("{{") ? (
          <span key={i} className="rounded-sm bg-filler/70 px-0.5 underline decoration-dotted underline-offset-4" title="Dato de ejemplo: si tu dato real es otro, usá el tuyo">
            {p.slice(2, -2)}<span className="sr-only"> (dato de ejemplo, verificalo)</span>
          </span>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </span>
  )
}

const plain = (t: string) => t.replace(/\{\{([^}]+)\}\}/g, "$1")
const hasExamples = (t: string) => /\{\{[^}]+\}\}/.test(t)

function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false)
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        try { await navigator.clipboard.writeText(plain(text)); setOk(true); setTimeout(() => setOk(false), 1500) }
        catch { toast.error("No se pudo copiar") }
      }}
      aria-label={label}
    >
      {ok ? <CheckIcon /> : <CopyIcon />} {ok ? "Copiado" : label}
    </Button>
  )
}

export function ExampleLegend() {
  return (
    <p className="text-xs text-muted-foreground">
      <span className="rounded-sm bg-filler/70 px-0.5 underline decoration-dotted underline-offset-4">Lo punteado</span> es un dato de ejemplo que no está en tu CV: si tu dato real es otro, usá el tuyo — el entrevistador puede repreguntar por él.
    </p>
  )
}

// Anclaje de comentarios

/** Agrupa palabras consecutivas con el mismo comentario en un solo tramo (resaltado continuo). */
function groups(n: number, wordAnn: Map<number, number>): { ann: number | null; idx: number[] }[] {
  const out: { ann: number | null; idx: number[] }[] = []
  for (let i = 0; i < n; i++) {
    const a = wordAnn.get(i) ?? null
    const last = out[out.length - 1]
    if (last && last.ann === a && a !== null) last.idx.push(i)
    else out.push({ ann: a, idx: [i] })
  }
  return out
}

// Chat de la llamada

type ChatStatus = "asking" | "recording" | "transcribing" | "evaluating" | "coaching" | null

function Bubble({ who, children, tone = "muted", align = "left" }: { who: string; children: React.ReactNode; tone?: "muted" | "you" | "coach"; align?: "left" | "right" }) {
  return (
    <div className={cn("flex flex-col gap-1", align === "right" && "items-end")}>
      <span className="px-1 text-xs text-muted-foreground">{who}</span>
      <div
        className={cn(
          "max-w-full rounded-2xl px-3.5 py-2.5 text-[15px] leading-7",
          tone === "muted" && "rounded-tl-sm bg-muted",
          tone === "you" && "rounded-tr-sm border bg-card",
          tone === "coach" && "rounded-tl-sm bg-accent text-accent-foreground",
        )}
      >
        {children}
      </div>
    </div>
  )
}

function Typing({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
      <span className="inline-flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => <span key={i} className="size-1.5 rounded-full bg-current motion-safe:animate-bounce" style={{ animationDelay: `${i * 120}ms` }} />)}
      </span>
      {label}
    </span>
  )
}

/** Indicador en vivo de que estás hablando: barras que siguen el nivel de tu voz + texto (no solo color/movimiento). */
export function SpeakingIndicator({ level, speaking, elapsed }: { level: number; speaking: boolean; elapsed: number }) {
  const amp = Math.max(0, Math.min(1, (level + 60) / 45))
  const shape = [0.45, 0.8, 1, 0.7, 0.5]
  return (
    <span className="inline-flex items-center gap-3" role="status" aria-live="polite">
      <span className="flex h-6 items-center gap-[3px]" aria-hidden>
        {shape.map((k, i) => (
          <span key={i} className={cn("w-1 rounded-full transition-[height] duration-75", speaking ? "bg-primary" : "bg-muted-foreground/40")}
            style={{ height: `${Math.max(4, (speaking ? amp : 0.12) * k * 24)}px` }} />
        ))}
      </span>
      <span className={cn("text-sm", speaking ? "font-medium" : "text-muted-foreground")}>{speaking ? "Estás hablando…" : "Te escucho · tomate tu tiempo"}</span>
      <span className="font-mono text-xs tabular-nums text-muted-foreground">{Math.floor(elapsed / 60)}:{String(Math.floor(elapsed % 60)).padStart(2, "0")}</span>
    </span>
  )
}

export function CallChat({ question, transcript, metrics, evaluation, coaching, audioUrl, status, autoPlay, compact = false, live, interviewerSpeaking, interviewer = "Recruiter" }: {
  question: string
  transcript?: Transcript | null
  metrics?: Metrics | null
  evaluation?: EvaluationBody | null
  coaching?: Coaching["coaching"] | null
  audioUrl?: string | null
  status?: ChatStatus
  autoPlay?: boolean
  compact?: boolean
  live?: { level: number; speaking: boolean; elapsed: number } | null
  interviewerSpeaking?: boolean
  interviewer?: string
}) {
  const [active, setActive] = useState<number | null>(null)
  const { words, timed } = useMemo(() => answerWords(transcript), [transcript])
  const anns: (Annotation & { span: [number, number] | null })[] = useMemo(
    () => (evaluation?.annotations ?? []).map((a) => ({ ...a, span: anchor(words, a.quote) })),
    [evaluation, words],
  )
  // palabra → índice de comentario
  const wordAnn = useMemo(() => {
    const m = new Map<number, number>()
    anns.forEach((a, n) => { if (a.span) for (let i = a.span[0]; i <= a.span[1]; i++) if (!m.has(i)) m.set(i, n) })
    return m
  }, [anns])
  // Muletillas, pausas y baja confianza usan índices de las palabras con tiempo: sin tiempo no se marcan
  const fill = new Set(timed ? metrics?.filler_word_idx ?? [] : [])
  const low = new Set(timed ? metrics?.low_confidence_idx ?? [] : [])
  const pauses = timed ? [...(metrics?.long_pauses ?? [])] : []

  return (
    <div className="flex flex-col gap-4" aria-label="Chat de la llamada">

      <Bubble who={interviewerSpeaking ? `${interviewer} · hablando` : interviewer}>{question}</Bubble>

      {status === "recording" && live && <Bubble who="Vos" tone="you" align="right"><SpeakingIndicator {...live} /></Bubble>}
      {status === "recording" && !live && <Bubble who="Vos" tone="you" align="right"><Typing label="esperando tu respuesta…" /></Bubble>}
      {status === "transcribing" && <Bubble who="Vos" tone="you" align="right"><Typing label="transcribiendo tu respuesta…" /></Bubble>}

      {transcript && (
        <Bubble who="Vos" tone="you" align="right">
          {words.length ? (
            <p>
              {groups(words.length, wordAnn).map((g) => {
                const a = g.ann != null ? anns[g.ann] : null
                const inner = g.idx.map((i) => {
                  const w = words[i]
                  const pauseHere = pauses.find((p) => p.at_s >= w.end_s - 0.05 && (i + 1 >= words.length || p.at_s <= words[i + 1].start_s + 0.3))
                  if (pauseHere) pauses.splice(pauses.indexOf(pauseHere), 1)
                  return (
                    <Fragment key={i}>
                      <span
                        className={cn(
                          fill.has(i) && "font-semibold underline decoration-2 decoration-wavy underline-offset-4",
                          low.has(i) && !fill.has(i) && !a && "underline decoration-lowconf decoration-dotted underline-offset-4",
                        )}
                        title={fill.has(i) ? "muletilla" : low.has(i) ? "posible error de transcripción" : undefined}
                      >
                        {w.word}{fill.has(i) && <span className="sr-only"> (muletilla)</span>}
                      </span>
                      {pauseHere && <span className="mx-1 rounded bg-pause px-1.5 font-mono text-xs" title="pausa larga">⏸ {pauseHere.dur_s.toFixed(1)}s</span>}
                      {i !== g.idx[g.idx.length - 1] && " "}
                    </Fragment>
                  )
                })
                if (!a) return <Fragment key={g.idx[0]}>{inner} </Fragment>
                const n = g.ann!
                return (
                  <Fragment key={g.idx[0]}>
                    <mark
                      onMouseEnter={() => setActive(n)}
                      onMouseLeave={() => setActive(null)}
                      className={cn(
                        "rounded-sm px-0.5 text-inherit box-decoration-clone",
                        a.kind === "mejorar" ? "bg-[oklch(0.9_0.05_80/.6)] dark:bg-[oklch(0.42_0.06_80/.55)]" : "bg-accent",
                        active === n && "ring-2 ring-primary/60",
                      )}
                    >
                      {inner}
                    </mark>
                    <button
                      type="button"
                      onClick={() => document.getElementById(`ann-${n}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" })}
                      onFocus={() => setActive(n)}
                      onBlur={() => setActive(null)}
                      className="ml-0.5 inline-flex size-4 -translate-y-1.5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground"
                      aria-label={`Comentario ${n + 1}: ${a.kind === "bien" ? "bien" : "para mejorar"}`}
                    >
                      {n + 1}
                    </button>{" "}
                  </Fragment>
                )
              })}
            </p>
          ) : (
            <p>{transcript.text}</p>
          )}
        </Bubble>
      )}

      {/* Hilo de comentarios anclados (como en un doc): legible sin hover */}
      {anns.length > 0 && (
        <ol className="flex flex-col gap-2 pl-4" aria-label="Comentarios sobre tu respuesta">
          {anns.map((a, n) => (
            <li
              key={n}
              id={`ann-${n}`}
              onMouseEnter={() => setActive(n)}
              onMouseLeave={() => setActive(null)}
              className={cn("rounded-xl border bg-card p-3 text-sm transition-shadow", active === n && "ring-2 ring-primary/50")}
            >
              <div className="flex items-start gap-2">
                <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", a.span ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{n + 1}</span>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-muted-foreground">
                    {a.kind === "bien" ? <ThumbsUpIcon className="size-3.5" /> : <PencilIcon className="size-3.5" />}
                    {a.kind === "bien" ? "Bien" : "Para mejorar"}
                  </span>
                  <span className="line-clamp-2 text-xs italic text-muted-foreground">“{a.quote}”{!a.span && " (fragmento no ubicado en tu respuesta)"}</span>
                  <span>{a.comment}</span>
                  {a.fix && <span className="rounded-md bg-muted px-2 py-1"><span className="text-muted-foreground">Mejor: </span>“<ExampleText text={a.fix} />”</span>}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {(status === "evaluating" || status === "coaching") && <Bubble who="Coach" tone="coach"><Typing label={status === "coaching" ? "armando una guía…" : "revisando tu respuesta…"} /></Bubble>}

      {evaluation && (
        <Bubble who="Coach" tone="coach">
          <div className="flex flex-col gap-2">
            <p>{evaluation.spoken_summary}</p>
            {evaluation.strengths.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm">
                {evaluation.strengths.map((s, i) => <li key={i} className="flex gap-1.5"><SparklesIcon className="mt-1 size-3.5 shrink-0" aria-hidden />{s}</li>)}
              </ul>
            )}
            {audioUrl && <AudioPlayer url={audioUrl} label="Escuchar" autoPlay={autoPlay} />}
          </div>
        </Bubble>
      )}

      {coaching && (
        <Bubble who="Coach" tone="coach">
          <div className="flex flex-col gap-2">
            <p>{coaching.calm_down}</p>
            <p className="text-sm font-medium">Para ganar tiempo:</p>
            <ul className="flex flex-col gap-1 text-sm">{coaching.buy_time_phrases.map((p, i) => <li key={i}>“{p}”</li>)}</ul>
            {audioUrl && <AudioPlayer url={audioUrl} label="Escuchar" autoPlay={autoPlay} />}
          </div>
        </Bubble>
      )}

      {transcript && !compact && (
        <p className="flex flex-wrap gap-x-3 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
          <span><span className="rounded-sm bg-accent px-1 underline">resaltado</span> comentario</span>
          {timed && <>
            <span><span className="font-semibold underline decoration-wavy">eh</span> muletilla</span>
            <span><span className="rounded bg-pause px-1 font-mono">⏸</span> pausa larga</span>
            <span><span className="underline decoration-dotted">palabra</span> posible error de transcripción</span>
          </>}
        </p>
      )}
    </div>
  )
}

// Cómo llegar al 5

export function ToFive({ criteria, lang }: { criteria: Criterion[]; lang: Lang }) {
  const na = criteria.filter((c) => c.applicable === false)
  const sorted = criteria.filter((c) => c.applicable !== false).sort((a, b) => a.score - b.score)
  const toWork = sorted.filter((c) => c.score < 5)
  const done = sorted.filter((c) => c.score >= 5)
  return (
    <section aria-labelledby="to5" className="flex flex-col gap-3">
      <div>
        <h2 id="to5" className="text-lg font-semibold">Cómo llegar al 5 en cada criterio</h2>
        <p className="text-sm text-muted-foreground">Ordenado por lo que más te sube la nota. La versión 5/5 está lista para decir ({lang === "es" ? "en español" : "en inglés"}).</p>
      </div>
      <ol className="flex flex-col gap-3">
        {toWork.map((c, i) => (
          <li key={c.id} className={cn("rounded-xl border bg-card p-4", i < 3 && "border-primary/40")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                {i < 3 && <Badge>Prioridad {i + 1}</Badge>}
                <span className="font-medium">{c.label}</span>
              </span>
              <ScoreDots score={c.score} />
            </div>
            {c.missing && <p className="mt-2 text-sm"><span className="text-muted-foreground">Faltó: </span>{c.missing}</p>}
            <div className="mt-3 rounded-lg bg-muted/70 p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Versión 5/5</span>
                <CopyButton text={c.ideal} />
              </div>
              <p className="text-[15px] leading-7">“<ExampleText text={c.ideal} />”</p>
            </div>
            <details className="mt-2 text-sm text-muted-foreground">
              <summary className="cursor-pointer select-none">Por qué este puntaje</summary>
              <p className="mt-1">{c.justification}</p>
              {c.evidence_quote && <blockquote className="mt-1 border-l-2 pl-2 italic">“{c.evidence_quote}”</blockquote>}
            </details>
          </li>
        ))}
      </ol>
      {done.length > 0 && (
        <div className="rounded-xl border border-dashed p-3 text-sm">
          <span className="font-medium">Ya en 5:</span> {done.map((c) => c.label).join(" · ")}
        </div>
      )}
      {na.length > 0 && <p className="text-xs text-muted-foreground">No aplican a esta pregunta (no puntúan): {na.map((c) => c.label).join(" · ")}</p>}
    </section>
  )
}

export function IdealAnswer({ text, lang }: { text: string; lang: Lang }) {
  return (
    <section aria-labelledby="ideal" className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="ideal" className="text-lg font-semibold">La respuesta completa 5/5</h2>
          <p className="text-sm text-muted-foreground">Todo junto, para decirlo de corrido ({lang === "es" ? "español" : "inglés"}, 60–90 s).</p>
        </div>
        <CopyButton text={text} label="Copiar respuesta" />
      </div>
      <p className="text-[15px] leading-8"><ExampleText text={text} /></p>
      {hasExamples(text) && <ExampleLegend />}
    </section>
  )
}

export function MetricsStrip({ m }: { m: Metrics }) {
  const [lo, hi] = m.duration_target_s
  const items = [
    { k: "Arrancaste", v: `${m.first_word_latency_s.toFixed(1)} s` },
    { k: "Duración", v: `${Math.round(m.speech_duration_s)} s`, s: `${lo}–${hi} s · ${m.duration_status}` },
    { k: "Ritmo", v: `${m.wpm}`, s: "palabras/min" },
    { k: "Muletillas", v: `${m.fillers_per_min}/min`, s: Object.entries(m.fillers).map(([a, b]) => `${a}×${b}`).join(" ") || "ninguna" },
  ]
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-xl border bg-card p-3 text-sm">
      {items.map((it) => (
        <div key={it.k}>
          <dt className="text-xs text-muted-foreground">{it.k}</dt>
          <dd className="font-mono tabular-nums">{it.v}{it.s && <span className="ml-1 font-sans text-xs text-muted-foreground">{it.s}</span>}</dd>
        </div>
      ))}
    </dl>
  )
}

// Evaluación explicable

/** Qué demostraste y qué no se sabe todavía, con la repregunta que te haría un entrevistador real. */
export function CompetencyCard({ ev, onFollowup }: { ev: EvaluationBody; onFollowup?: (text: string) => void }) {
  const c = ev.competency
  if (!c && !ev.provisional_assessment) return null
  return (
    <section aria-labelledby="comp" className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      {c && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="comp" className="font-medium">{c.label}</h2>
          {c.scored === false ? <Badge variant="outline">Logística · no puntúa</Badge> : <ScoreDots score={c.score} />}
        </div>
      )}
      {c && (
        <div className="flex flex-wrap gap-1.5 text-xs">
          {c.evidence_source === "ejercicio"
            ? <Badge variant="secondary">Evidencia: demostrada en el ejercicio</Badge>
            : <Badge variant="secondary">Evidencia: {LEVEL_LABEL[c.evidence_level]}</Badge>}
          <Badge variant="outline">Confianza {c.confidence}</Badge>
        </div>
      )}
      {ev.provisional_assessment && <p className="text-sm leading-6">{ev.provisional_assessment}</p>}
      {ev.next_practice_followup && (
        <div className="rounded-lg bg-accent/50 p-3 text-sm">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"><MessageCircleQuestionIcon className="size-3.5" /> La repregunta que te harían</div>
          <p className="leading-6">“{ev.next_practice_followup}”</p>
          {onFollowup && <Button size="sm" className="mt-2" onClick={() => onFollowup(ev.next_practice_followup!)}>Responder esta repregunta</Button>}
        </div>
      )}
      {ev.recommended_exercise && (
        <p className="flex gap-2 text-sm text-muted-foreground"><DumbbellIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span><span className="font-medium text-foreground">Para practicar: </span>{ev.recommended_exercise}</span></p>
      )}
    </section>
  )
}

const CHECK = {
  demostrado: { icon: CheckIcon, label: "Demostrado", cls: "text-primary" },
  parcial: { icon: CircleDashedIcon, label: "Parcial", cls: "text-amber-600 dark:text-amber-400" },
  no_demostrado: { icon: CircleIcon, label: "No demostrado", cls: "text-muted-foreground" },
} as const

/** Lo demostrado, lo inferido y lo que falta; y cada experiencia que mencionaste, por tipo (profesional, proyecto…). */
export function EvidencePanel({ ev }: { ev: EvaluationBody }) {
  const has = ev.evidence_check?.length || ev.experience_claims?.length || ev.facts?.length || ev.not_demonstrated?.length
  if (!has) return null
  return (
    <section aria-labelledby="evid" className="flex flex-col gap-4">
      <h2 id="evid" className="text-lg font-semibold">Evidencia</h2>
      {!!ev.evidence_check?.length && (
        <ul className="flex flex-col gap-2" aria-label="Lo que la pregunta buscaba">
          {ev.evidence_check.map((e, i) => {
            const k = CHECK[e.status]
            return (
              <li key={i} className="flex gap-2 text-sm">
                <k.icon className={cn("mt-0.5 size-4 shrink-0", k.cls)} aria-hidden />
                <span><span className="sr-only">{k.label}: </span>{e.expected}{e.quote && <span className="block text-xs italic text-muted-foreground">“{e.quote}”</span>}</span>
              </li>
            )
          })}
        </ul>
      )}
      {!!ev.experience_claims?.length && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-medium">Experiencias que mencionaste</h3>
          <ul className="flex flex-col gap-1.5">
            {ev.experience_claims.map((c, i) => (
              <li key={i} className="flex flex-wrap items-start gap-2 text-sm"><Badge variant="outline" className="shrink-0">{LEVEL_LABEL[c.level]}</Badge><span>{c.claim}</span></li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {([["Hechos", ev.facts], ["Inferencias", ev.inferences], ["Sin demostrar", ev.not_demonstrated]] as const).map(([t, xs]) => !!xs?.length && (
          <div key={t} className="rounded-lg border p-3 text-sm">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t}</div>
            <ul className="flex flex-col gap-1">{xs.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
        ))}
      </div>
      {ev.uncertainty && <p className="text-xs text-muted-foreground"><span className="font-medium">Límite de esta evaluación: </span>{ev.uncertainty}</p>}
    </section>
  )
}

/** ¿Te sirvió esta devolución? (métrica de producto). */
export function FeedbackRating({ turnId, initial }: { turnId: string | null; initial?: 1 | -1 | null }) {
  const [v, setV] = useState<1 | -1 | null>(initial ?? null)
  if (!turnId) return null
  async function rate(x: 1 | -1) {
    const next = v === x ? null : x
    setV(next)
    try { await api.rateTurn(turnId!, next) } catch { setV(v); toast.error("No se pudo guardar.") }
  }
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>¿Te sirvió esta devolución?</span>
      <Button size="icon-sm" variant={v === 1 ? "default" : "outline"} aria-pressed={v === 1} aria-label="Me sirvió" onClick={() => rate(1)}><ThumbsUpIcon /></Button>
      <Button size="icon-sm" variant={v === -1 ? "default" : "outline"} aria-pressed={v === -1} aria-label="No me sirvió" onClick={() => rate(-1)}><ThumbsDownIcon /></Button>
    </div>
  )
}

/** Modo coach: pistas que aparecen de a una, solo si las pedís (revelar pistas gradualmente). */
export function HintsPanel({ q }: { q: Question }) {
  const steps: { title: string; body?: string; list?: string[] }[] = [
    { title: "Qué evalúa", body: q.objective || q.relevance || "" },
    { title: "Cómo estructurarla", body: q.hints?.structure || (!q.objective ? q.guidance ?? "" : "") },
    { title: "Historias de tu CV que sirven", list: q.hints?.cv_examples ?? [] },
    { title: "Qué evidencia esperan escuchar", list: q.expected_evidence ?? [] },
  ].filter((x) => x.list?.length || x.body)
  const [n, setN] = useState(0)
  if (!steps.length) return null
  return (
    <section aria-labelledby="hints" className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="hints" className="flex items-center gap-1.5 text-sm font-medium"><LightbulbIcon className="size-4 text-primary" aria-hidden /> Pistas</h2>
        <span className="text-xs text-muted-foreground">{n} de {steps.length}</span>
      </div>
      {n === 0 && <p className="text-sm text-muted-foreground">Probá primero sin ayuda. Si la necesitás, las pistas aparecen de a una.</p>}
      <ol className="flex flex-col gap-3" aria-live="polite">
        {steps.slice(0, n).map((st, i) => (
          <li key={i} className="text-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{st.title}</div>
            {st.list ? <ul className="mt-1 flex flex-col gap-1">{st.list.map((x, k) => <li key={k}>• {x}</li>)}</ul> : <p className="mt-1 leading-6">{st.body}</p>}
          </li>
        ))}
      </ol>
      {n < steps.length && <Button variant="outline" size="sm" className="w-fit" onClick={() => setN(n + 1)}>{n === 0 ? "Ver la primera pista" : "Ver la siguiente pista"}</Button>}
      {q.hints?.watch_out && n >= steps.length && <p className="text-xs text-muted-foreground"><span className="font-medium">Cuidado: </span>{q.hints.watch_out}</p>}
    </section>
  )
}
