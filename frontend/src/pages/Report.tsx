import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowRightIcon, ChevronDownIcon, InfoIcon, LightbulbIcon, MessageCircleQuestionIcon, RepeatIcon, SparklesIcon, TargetIcon } from "lucide-react"
import { useState } from "react"
import { Link, useParams } from "react-router"
import { toast } from "sonner"
import { AudioPlayer, ScoreDots } from "@/components/common"
import { CallChat, CompetencyCard, EvidencePanel, IdealAnswer, MetricsStrip, ToFive } from "@/components/review"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { api, appPath, type Aggregates, type Lang, LEVEL_LABEL, type MockReport, type ReportTurn } from "@/lib/api"
import { useAppContext, useAppId } from "@/lib/app"
import { readSettings } from "@/lib/settings"
import { cn } from "@/lib/utils"

const STAGE_LABEL: Record<string, string> = { recruiter_screen: "Recruiter screen", technical_screen: "Entrevista técnica", behavioral_client: "Conductual y cliente" }

export default function Report() {
  const appId = useAppId()
  const company = useAppContext().data?.company || "la empresa"
  const { sid = "" } = useParams()
  const q = useQuery({ queryKey: ["session", sid], queryFn: () => api.session(sid) })
  const settings = readSettings()
  if (q.isLoading) return <Skeleton className="h-96 w-full" />
  const r = q.data?.report
  if (!q.data || !r) return <p>Este simulacro todavía no tiene informe.</p>
  const L = r.llm
  const turnLang = (t: ReportTurn): Lang => t.lang ?? (r.lang === "mix" ? "es" : r.lang)
  const practiceLang: Lang = r.lang === "mix" ? "en" : r.lang
  const scored = r.turns.filter((t) => t.type !== "logistics")
  const logistics = r.turns.filter((t) => t.type === "logistics")
  const interviewer = r.stage === "technical_screen" ? `Ingeniería · ${company}` : `Recruiter · ${company}`
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {q.data.mode === "videocall" ? "Videollamada" : "Simulacro"}{r.stage ? ` · ${STAGE_LABEL[r.stage] ?? r.stage}` : ""} · {new Date(q.data.created_at).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" })} · {r.lang === "mix" ? "Español → inglés" : r.lang === "es" ? "Español" : "Inglés"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Informe de tu simulacro</h1>
        </div>
        <AudioPlayer url={r.audio_url ?? null} label="Escuchar resumen" autoPlay={settings.voice} />
      </div>

      <Card><CardContent className="flex flex-col gap-2 py-1 text-[15px] leading-7">
        <p>{L.summary}</p>
        <p className="flex items-start gap-1.5 text-xs leading-5 text-muted-foreground"><InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Es una estimación de cómo te fue en esta práctica, no una predicción de contratación.{L.uncertainty ? ` ${L.uncertainty}` : ""}</p>
      </CardContent></Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="fz">
          <h2 id="fz" className="mb-3 flex items-center gap-2 font-medium"><SparklesIcon className="size-4" /> Lo que hiciste bien</h2>
          <ul className="flex flex-col gap-2 text-sm">{L.strengths.map((s, i) => <li key={i} className="rounded-lg border bg-card p-3">{s}</li>)}</ul>
        </section>
        <section aria-labelledby="pt">
          <h2 id="pt" className="mb-3 flex items-center gap-2 font-medium"><RepeatIcon className="size-4" /> Patrones que se repiten</h2>
          <ul className="flex flex-col gap-2 text-sm">{L.patterns.map((p, i) => <li key={i} className="rounded-lg border bg-card p-3"><div>{p.pattern}</div><div className="mt-1 text-muted-foreground">{p.evidence}</div></li>)}</ul>
        </section>
      </div>

      <Competencies r={r} />

      <section aria-labelledby="ac">
        <h2 id="ac" className="mb-3 flex items-center gap-2 font-medium"><LightbulbIcon className="size-4" /> 3 cosas para la próxima</h2>
        <ol className="grid gap-3 md:grid-cols-3">
          {L.actions.map((a, i) => (
            <li key={i} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
              <div className="font-medium">{i + 1}. {a.action}</div>
              <div className="rounded-md bg-muted p-2 text-sm">“{a.example}”</div>
              <Button asChild variant="outline" size="sm" className="mt-auto w-fit">
                <Link to={`${appPath(appId, "practica")}?q=${a.question_id}&lang=${practiceLang}`}>Practicar {a.question_id} <ArrowRightIcon /></Link>
              </Button>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="qs" className="rounded-xl border bg-card p-4">
          <h2 id="qs" className="mb-1 font-medium">Tus preguntas al entrevistador</h2>
          <p className="text-sm text-muted-foreground">{L.candidate_questions_feedback}</p>
        </section>
        {(L.logistics_alignment || logistics.length > 0) && (
          <section aria-labelledby="lg" className="rounded-xl border bg-card p-4">
            <h2 id="lg" className="mb-1 flex items-center gap-2 font-medium">Alineación logística <Badge variant="outline">no puntúa</Badge></h2>
            <p className="text-sm text-muted-foreground">{L.logistics_alignment || "Disponibilidad, modalidad y compensación se informan aparte: no son una competencia."}</p>
          </section>
        )}
      </div>

      <Aggregate a={r.aggregates} prev={r.previous} />

      <section aria-labelledby="pq">
        <h2 id="pq" className="mb-3 font-medium">Pregunta por pregunta</h2>
        <div className="flex flex-col gap-3">
          {[...scored, ...logistics].map((t) => <TurnBlock key={t.turn_id} t={t} lang={turnLang(t)} interviewer={interviewer} />)}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button asChild><Link to={appPath(appId, "practicar")}>Volver a practicar</Link></Button>
        <Button asChild variant="outline"><Link to={appPath(appId, "resultados?tab=progreso")}>Ver mi progreso</Link></Button>
      </div>
    </div>
  )
}

function Competencies({ r }: { r: MockReport }) {
  const comps = Object.entries(r.aggregates.competencies ?? {})
  const notes = r.llm.competency_notes ?? []
  if (!comps.length && !notes.length) return null
  return (
    <section aria-labelledby="cp" className="flex flex-col gap-3">
      <div>
        <h2 id="cp" className="flex items-center gap-2 font-medium"><TargetIcon className="size-4" /> Por competencia</h2>
        <p className="text-sm text-muted-foreground">Puntaje con escala anclada 1–5 y el tipo de evidencia que mostraste. La experiencia y el conocimiento teórico se informan por separado.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {comps.map(([id, c]) => {
          const note = notes.find((n) => n.competency.toLowerCase() === c.label.toLowerCase() || n.competency === id)
          const levels = [...new Set(c.evidence_levels.filter(Boolean))] as (keyof typeof LEVEL_LABEL)[]
          return (
            <article key={id} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between gap-2"><h3 className="font-medium">{c.label}</h3>{c.avg != null && (c.n === 1 ? <ScoreDots score={c.avg} /> : <span className="font-mono text-sm tabular-nums" aria-label={`promedio ${c.avg} de 5`}>{c.avg}/5 <span className="text-xs text-muted-foreground">prom.</span></span>)}</div>
              <div className="flex flex-wrap gap-1.5">{levels.map((l) => <Badge key={l} variant="secondary">{LEVEL_LABEL[l]}</Badge>)}<span className="text-xs text-muted-foreground">{c.n} respuesta{c.n === 1 ? "" : "s"}</span></div>
              {note && <>
                <p className="text-sm"><span className="text-muted-foreground">Demostraste: </span>{note.observed}</p>
                {note.gaps && <p className="text-sm"><span className="text-muted-foreground">Falta demostrar: </span>{note.gaps}</p>}
                {note.next_action && <p className="text-sm"><span className="text-muted-foreground">Próximo paso: </span>{note.next_action}</p>}
              </>}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function TurnBlock({ t, lang, interviewer }: { t: ReportTurn; lang: Lang; interviewer: string }) {
  const fus = t.followups ?? []
  return (
    <Collapsible className="rounded-xl border bg-card">
      <CollapsibleTrigger className="flex w-full items-start justify-between gap-3 p-4 text-left">
        <span className="flex flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-mono">{t.qid}</Badge>
            {t.is_followup && <Badge variant="outline">Repregunta</Badge>}
            {fus.length > 0 && <Badge variant="outline">{fus.length} repregunta{fus.length > 1 ? "s" : ""}</Badge>}
            {t.type === "logistics" && <Badge variant="outline">Logística · no puntúa</Badge>}
            {t.evaluation?.competency && t.type !== "logistics" && <span className="text-xs text-muted-foreground">{t.evaluation.competency.label}</span>}
          </span>
          <span className="font-medium">{t.question}</span>
        </span>
        <ChevronDownIcon className="mt-1 size-4 shrink-0" />
      </CollapsibleTrigger>
      <CollapsibleContent className="grid items-start gap-6 px-4 pb-4 lg:grid-cols-[minmax(300px,400px)_1fr]">
        <aside className="flex flex-col gap-4 rounded-2xl border bg-card/60 p-4">
          <CallChat interviewer={interviewer} question={t.question} transcript={{ text: t.transcript, words: [] }} metrics={t.metrics} evaluation={t.evaluation} compact />
          {fus.map((f) => <FollowupItem key={f.turn_id} f={f} />)}
          <Decisions t={t} />
        </aside>
        <div className="flex flex-col gap-6">
          {t.evaluation && <CompetencyCard ev={t.evaluation} />}
          {t.metrics && <MetricsStrip m={t.metrics} />}
          {t.evaluation && <EvidencePanel ev={t.evaluation} />}
          {t.evaluation && <ToFive criteria={t.evaluation.criteria} lang={lang} />}
          {t.evaluation && <IdealAnswer text={t.evaluation.model_answer} lang={lang} />}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

/** Each follow-up with its answer, and the "helpful or redundant?" flag (interviewer quality metric). */
function FollowupItem({ f }: { f: NonNullable<ReportTurn["followups"]>[number] }) {
  const qc = useQueryClient()
  const [flag, setFlag] = useState(f.flag)
  async function mark(x: "useful" | "redundant") {
    const next = flag === x ? null : x
    setFlag(next)
    try { await api.flagFollowup(f.turn_id, next); qc.invalidateQueries({ queryKey: ["quality"] }) } catch { setFlag(flag); toast.error("No se pudo guardar.") }
  }
  return (
    <div className="flex flex-col gap-2 border-t pt-3 text-sm">
      <p className="flex gap-2"><MessageCircleQuestionIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /><span><span className="sr-only">Repregunta: </span>{f.question}</span></p>
      <p className="rounded-lg bg-accent/50 px-3 py-2"><span className="sr-only">Tu respuesta: </span>{f.transcript || "(sin respuesta)"}</p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Esta repregunta fue:</span>
        <Button size="sm" variant={flag === "useful" ? "default" : "outline"} className="h-7" aria-pressed={flag === "useful"} onClick={() => mark("useful")}>Útil</Button>
        <Button size="sm" variant={flag === "redundant" ? "default" : "outline"} className="h-7" aria-pressed={flag === "redundant"} onClick={() => mark("redundant")}>Redundante</Button>
      </div>
    </div>
  )
}

function Decisions({ t }: { t: ReportTurn }) {
  const ds = t.decisions ?? []
  if (!ds.length) return null
  return (
    <details className="border-t pt-3 text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none">Por qué repreguntó (o no)</summary>
      <ol className="mt-2 flex flex-col gap-1.5">
        {ds.map((d, i) => (
          <li key={i} className={cn(d.ask ? "text-foreground" : "")}>
            {i + 1}. {d.ask ? "Repreguntó" : "No repreguntó"}: {d.ask ? d.reason : d.skip_reason || d.reason}
            {d.missing?.length ? <span className="block opacity-80">Faltaba: {d.missing.join(" · ")}</span> : null}
          </li>
        ))}
      </ol>
    </details>
  )
}

function Aggregate({ a, prev }: { a: Aggregates; prev: Aggregates | null }) {
  const rows: [string, number | null, number | null | undefined, string][] = [
    ["Inicio promedio", a.metrics.first_word_latency_s, prev?.metrics.first_word_latency_s, " s"],
    ["Respuestas en rango", a.metrics.in_range_pct, prev?.metrics.in_range_pct, "%"],
    ["Ritmo", a.metrics.wpm, prev?.metrics.wpm, " p/min"],
    ["Muletillas", a.metrics.fillers_per_min, prev?.metrics.fillers_per_min, "/min"],
  ]
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">En números</CardTitle><CardDescription>{prev ? "Comparado con tu simulacro anterior de esta etapa." : "La próxima vez vas a ver la comparación con este."} Los criterios que no aplicaban a una pregunta no entran en el promedio.</CardDescription></CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
          {rows.map(([label, v, p, u]) => (
            <div key={label} className="contents"><dt className="text-muted-foreground">{label}</dt>
              <dd className="font-mono tabular-nums">{v ?? "–"}{v != null ? u : ""}{prev && p != null ? <span className="text-muted-foreground"> (antes {p}{u})</span> : null}</dd></div>
          ))}
        </dl>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
          {Object.entries(a.criteria).map(([k, c]) => (
            <div key={k} className="contents"><dt className="text-muted-foreground">{c.label}</dt>
              <dd className="font-mono tabular-nums">{c.avg ?? "–"}/5{prev?.criteria[k]?.avg != null ? <span className="text-muted-foreground"> (antes {prev.criteria[k].avg})</span> : null}</dd></div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
