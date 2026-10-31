import { useQuery } from "@tanstack/react-query"
import { ArrowRightIcon, ArrowUpRightIcon, CheckIcon, Code2Icon, InfoIcon, ListChecksIcon, MessagesSquareIcon, MonitorPlayIcon, PlayIcon, SparklesIcon, TargetIcon, VideoIcon } from "lucide-react"
import { useState } from "react"
import { Link, useNavigate } from "react-router"
import { Eyebrow, IconBox, MetricCard, PageHeader, Panel, SectionHead, Tag } from "@/components/page"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api, appPath, type Requirement } from "@/lib/api"
import { useAppId } from "@/lib/app"
import { nextStep, practiceState, questionsFor, requirementOrder } from "@/lib/nextStep"
import { cn } from "@/lib/utils"

const MODE_LABEL: Record<string, string> = { practice: "Práctica por pregunta", mock: "Simulacro", videocall: "Videollamada", exercise: "Ejercicio técnico" }
const MODE_ICON: Record<string, typeof PlayIcon> = { practice: MessagesSquareIcon, mock: PlayIcon, videocall: VideoIcon, exercise: Code2Icon }

/** The 4 practice modes. Durations are the ones the product already states in Practicar (Lobby). */
const PRACTICE_MODES = [
  { id: "practice", title: "Modo coach", desc: "Recibí pistas graduales para construir una respuesta clara.", foot: "Guiado · 2–3 min por pregunta", icon: SparklesIcon },
  { id: "mock", title: "Simulacro completo", desc: "Respondé sin ayuda y recibí el informe al finalizar.", foot: "Realista · según la etapa", icon: PlayIcon },
  { id: "videocall", title: "Videollamada", desc: "Practicá el ritmo de una conversación oral.", foot: "Oral · según la etapa", icon: MonitorPlayIcon },
  { id: "exercise", title: "Ejercicio técnico", desc: "Resolvé una tarea escrita relacionada con el puesto.", foot: "Práctico · 15–40 min", icon: Code2Icon },
] as const

/** "2+ años de experiencia con Python (FastAPI)" → "2+ años de experiencia con Python" (trims parentheticals) */
const shortName = (t: string) => t.replace(/\s*\(.*?\)\s*/g, " ").split(/[:;.]/)[0].trim()
const firstSentence = (t?: string) => t?.split(/(?<=\.)\s/)[0]

/**
 * Summary = entry point: which application, what to do now, how to practice, what's missing.
 * Everything comes from the API (application, sessions, progress); the recommendation from the deterministic nextStep rule.
 */
export default function Summary() {
  const appId = useAppId()
  const navigate = useNavigate()
  const [mode, setMode] = useState<string>("practice")
  const app = useQuery({ queryKey: ["app", appId], queryFn: () => api.application(appId) })
  const sessions = useQuery({ queryKey: ["sessions", appId], queryFn: () => api.sessions(appId) })
  const prog = useQuery({ queryKey: ["progress", appId], queryFn: () => api.progress(appId) })
  if (app.isError) return <p role="alert" className="rounded-card border p-5">No pudimos cargar la postulación. Revisá que el backend esté corriendo y recargá.</p>
  if (!app.data || prog.isLoading) return <Skeleton className="h-96 w-full rounded-hero" />
  const a = app.data
  const done = (sessions.data ?? []).filter((s) => s.turns > 0)
  const step = nextStep(a, prog.data?.days ?? [], { exerciseDone: done.some((s) => s.mode === "exercise") })
  const { practiced } = practiceState(prog.data?.days ?? [])
  const isPracticed = (r: Requirement) => questionsFor(r, a.questions).some((q) => practiced.has(q.primary_competency))

  const reqs = a.requirements
  const must = reqs.filter((r) => r.priority === "must_have")
  const nice = reqs.filter((r) => r.priority === "nice_to_have")
  const strong = reqs.filter((r) => r.coverage === "strong")
  const priorityGaps = [...reqs].sort(requirementOrder).filter((r) => r.priority === "must_have" && r.coverage !== "strong")
  const mustPracticed = must.filter(isPracticed)
  const pct = must.length ? Math.round((mustPracticed.length / must.length) * 100) : 0
  const hasExercise = a.questions.some((q) => q.format === "exercise")
  const modes = PRACTICE_MODES.filter((m) => m.id !== "exercise" || hasExercise)
  const sel = modes.find((m) => m.id === mode) ?? modes[0]
  // Hero tags: analysis data only (role family, seniority, English, interview type)
  const tags = [a.analysis?.role_family, a.analysis?.seniority, a.analysis?.english_required ? "Inglés" : null, a.interview?.type?.replace(/\*\*/g, "")]
    .filter((t): t is string => !!t && t.length < 40).map((t) => t.charAt(0).toUpperCase() + t.slice(1))

  const stepHref = step.kind === "question" ? `${appPath(appId, "practica")}?q=${step.qid}`
    : step.kind === "exercise" ? appPath(appId, "ejercicio") : appPath(appId, "practicar")
  const stepTitle = step.kind === "question" && step.requirement ? `Prepará un ejemplo sobre ${shortName(step.requirement.text).toLowerCase()}` : step.title
  const stepReason = step.kind === "question" && step.requirement ? (step.requirement.gap || step.reason) : step.reason

  return (
    <div>
      <PageHeader eyebrow="Tu espacio de preparación" title={<>Prepará tu entrevista.<br />Un paso a la vez.</>}
        intro="Una vista clara de lo que ya podés demostrar y lo que conviene practicar a continuación."
        action={<Button asChild variant="soft" size="cta"><Link to={appPath(appId, "requisitos")}>Ver análisis completo <ArrowUpRightIcon aria-hidden /></Link></Button>} />

      {/* Application hero */}
      <section aria-labelledby="hero-h" className="relative mb-5 grid gap-7 overflow-hidden rounded-[21px] bg-ink p-[22px] text-ink-foreground shadow-[0_12px_32px_rgba(23,43,50,.06)] ring-1 ring-transparent dark:ring-white/15 min-[561px]:rounded-hero min-[561px]:p-[clamp(22px,3vw,36px)] min-[851px]:grid-cols-[minmax(0,1fr)_240px] min-[1151px]:grid-cols-[minmax(0,1.45fr)_minmax(220px,.55fr)]">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-36 size-[280px] rounded-full border border-lime/15 shadow-[0_0_0_35px_rgba(199,243,107,.035),0_0_0_75px_rgba(199,243,107,.025)]" />
        <div className="relative min-w-0">
          <Eyebrow className="text-lime">Tu próxima entrevista</Eyebrow>
          <h2 id="hero-h" className="my-3 max-w-[620px] text-[27px] font-extrabold leading-[1.12] tracking-[-0.05em] min-[561px]:text-[clamp(25px,3vw,36px)]">
            {a.title}{a.company && <><br /><span className="text-lime">{a.company}</span></>}
          </h2>
          <p className="mb-5 line-clamp-3 max-w-[600px] text-label text-ink-muted">
            {strong.length ? `Tenés evidencia sólida en ${strong.slice(0, 2).map((r) => shortName(r.text)).join(" y ")}. ` : ""}
            Ahora conviene preparar cómo explicar tu experiencia y las brechas del CV.
          </p>
          {!!tags.length && <ul className="mb-6 flex flex-wrap gap-[7px]" aria-label="Datos del puesto">
            {tags.map((t) => <li key={t} className="rounded-lg border border-white/10 bg-white/10 px-[9px] py-1.5 text-caption text-[#e3ece9]">{t}</li>)}
          </ul>}
          <Button asChild variant="lime" size="cta"><Link to={stepHref}>Empezar a practicar <ArrowRightIcon aria-hidden /></Link></Button>
        </div>
        <div className="relative z-[1] flex max-w-[420px] flex-col justify-center rounded-card border border-white/10 bg-white/[.065] p-5 min-[851px]:max-w-none">
          <p className="text-caption text-ink-muted">Preparación de la candidatura</p>
          <p className="my-[7px] text-lg font-bold">{!done.length ? "Sin empezar" : must.length && mustPracticed.length === must.length ? "Obligatorios practicados" : "En marcha"}</p>
          <div className="my-3 h-[7px] overflow-hidden rounded-full bg-white/15" role="img" aria-label={`${mustPracticed.length} de ${must.length} requisitos obligatorios practicados`}>
            <span className="block h-full rounded-full bg-lime transition-[width] duration-[var(--dur-slow)]" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-caption text-ink-muted"><span className="num">{mustPracticed.length} de {must.length}</span> requisitos obligatorios practicados</p>
          <p className="mt-2 text-caption text-ink-muted/80">Indicador de actividad, no una probabilidad de contratación.</p>
        </div>
      </section>

      <ul className="mb-7 mt-5 grid gap-[9px] min-[561px]:grid-cols-3 min-[561px]:gap-3.5" aria-label="Estado de los requisitos">
        <MetricCard icon={<ListChecksIcon />} value={reqs.length} label="Requisitos detectados" desc={`${must.length} obligatorios · ${nice.length} deseables`} to={appPath(appId, "requisitos")} />
        <MetricCard icon={<CheckIcon />} tone="info" value={strong.length} label="Con evidencia fuerte" desc={strong.length ? strong.slice(0, 2).map((r) => shortName(r.text)).join(" y ") : "Ninguno todavía"} to={`${appPath(appId, "requisitos")}?f=strong`} />
        <MetricCard icon={<TargetIcon />} tone="warn" value={priorityGaps.length} label="Brechas prioritarias" desc="Obligatorios para aclarar o practicar" to={`${appPath(appId, "requisitos")}?f=must_have`} />
      </ul>

      <section aria-labelledby="next-h" className="mt-7">
        <SectionHead id="next-h" eyebrow="Recomendación personalizada" title="Tu próximo paso" sub="Una acción concreta para avanzar sin analizar todo el informe." />
        <div className="grid items-center gap-5 rounded-card border border-[#cfe7df] bg-card p-[17px] shadow-[0_8px_24px_rgba(8,126,128,.045)] dark:border-border min-[561px]:grid-cols-[1fr_auto] min-[561px]:p-[22px]">
          <div className="flex items-start gap-[15px]">
            <IconBox className="size-[42px] rounded-[14px] bg-mint"><SparklesIcon /></IconBox>
            <div className="min-w-0">
              <Tag tone="warn">{step.level === "N0" ? "Estado" : "Sugerido"}{"minutes" in step ? <> · <span className="num">{step.minutes}</span> min</> : null}</Tag>
              <h3 className="mb-1.5 mt-1 text-base font-bold tracking-[-0.02em]">{step.level === "N0" ? step.title : stepTitle}</h3>
              <p className="max-w-[740px] text-[13px] text-muted-foreground">{stepReason}</p>
            </div>
          </div>
          {step.kind === "generating" || step.kind === "error" ? null : step.kind === "no_questions"
            ? <Button asChild variant="dark" size="cta" className="max-[560px]:w-full"><Link to={appPath(appId, "preguntas")}>Elegir una pregunta →</Link></Button>
            : <Button asChild variant="dark" size="cta" className="max-[560px]:w-full"><Link to={stepHref}>Practicar ahora →</Link></Button>}
        </div>
      </section>

      <section aria-labelledby="modes-h" className="mt-7">
        <SectionHead id="modes-h" title="Elegí cómo practicar" sub="Podés cambiar de modalidad cuando quieras." to={appPath(appId, "practicar")} link="Ver todas las opciones" />
        <div role="radiogroup" aria-labelledby="modes-h" className="grid gap-3 min-[561px]:grid-cols-2 min-[1151px]:grid-cols-4">
          {modes.map((m) => {
            const on = m.id === sel.id
            return (
              <button key={m.id} type="button" role="radio" aria-checked={on} onClick={() => setMode(m.id)}
                className={cn("relative flex min-h-[140px] flex-col items-start rounded-[18px] border bg-card p-[17px] text-left transition-[transform,border-color,box-shadow] duration-[var(--dur-fast)] hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_12px_32px_rgba(23,43,50,.06)] min-[561px]:min-h-[170px]",
                  on && "border-2 border-primary bg-mint/30 p-4 shadow-[0_0_0_3px_rgba(8,126,128,.07)]")}>
                <span aria-hidden className={cn("absolute right-3 top-3 grid size-5 place-items-center rounded-full border", on ? "border-primary bg-primary text-primary-foreground" : "text-transparent")}><CheckIcon className="size-3" /></span>
                <IconBox className="mb-[15px]"><m.icon /></IconBox>
                <span className="mb-1.5 block text-label font-bold tracking-[-0.02em]">{m.title}</span>
                <span className="block text-caption leading-[1.45] text-muted-foreground">{m.desc}</span>
                <span className="mt-auto block pt-3 text-caption font-extrabold text-teal-dark">{m.foot}</span>
              </button>
            )
          })}
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="dark" size="cta" className="max-[560px]:w-full" onClick={() => navigate(`${appPath(appId, "practicar")}?modo=${sel.id}`)}>Continuar con {sel.title} →</Button>
        </div>
      </section>

      {/* Recent activity and gaps */}
      <div className="mt-7 grid gap-[18px] min-[1151px]:grid-cols-[minmax(0,1.2fr)_minmax(270px,.8fr)]">
        <Panel aria-labelledby="act-h">
          <SectionHead id="act-h" title="Tu actividad reciente" sub="Retomá donde lo dejaste." to={appPath(appId, "resultados")} link="Ver historial" />
          {done.length ? (
            <ul>
              {done.slice(0, 3).map((s) => {
                const Icon = MODE_ICON[s.mode] ?? PlayIcon
                return (
                  <li key={s.id} className="border-b border-border/70 last:border-0">
                    <Link to={appPath(appId, s.has_report ? `informe/${s.id}` : `sesion/${s.id}`)} className="flex items-center gap-3 py-[13px] hover:text-teal-dark">
                      <IconBox className="size-[35px] rounded-[11px]"><Icon /></IconBox>
                      <span className="min-w-0 flex-1">
                        <strong className="block text-caption font-bold sm:text-label">{MODE_LABEL[s.mode]}</strong>
                        <span className="text-caption text-muted-foreground">{new Date(s.created_at).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" })} · <span className="num">{s.turns}</span> respuesta{s.turns === 1 ? "" : "s"}</span>
                      </span>
                      {s.has_report ? <Tag>Informe listo</Tag> : s.mode === "practice" || s.mode === "exercise" ? <Tag>Con devolución</Tag> : s.status === "finished" ? <Tag tone="soft">Revisar</Tag> : <Tag tone="soft">Sin terminar</Tag>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : <p className="rounded-xl bg-soft p-4 text-label text-muted-foreground">Todavía no practicaste esta postulación. Tu primera práctica aparece acá.</p>}
        </Panel>

        <Panel aria-labelledby="gaps-h">
          <SectionHead id="gaps-h" title="Brechas para revisar" sub="Empezá por las más relevantes." to={`${appPath(appId, "requisitos")}?f=must_have`} link="Ver todas las brechas" />
          {priorityGaps.length ? (
            <ul className="grid gap-3">
              {priorityGaps.slice(0, 3).map((r) => (
                <li key={r.id}>
                  <Link to={`${appPath(appId, "requisitos")}#${r.id}`} className="group flex items-start gap-2.5">
                    <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", r.coverage === "gap" ? "bg-coral" : "bg-warn")} />
                    <span className="min-w-0">
                      <strong className="block text-caption font-bold group-hover:underline sm:text-label">{shortName(r.text)}</strong>
                      <span className="line-clamp-2 text-caption text-muted-foreground">{r.coverage === "gap" ? "Sin evidencia en el CV. " : "Evidencia parcial. "}{firstSentence(r.gap)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-label text-muted-foreground">Todos los obligatorios tienen evidencia fuerte en tu CV.</p>}
          {/* Interpretation notice: visible, not hidden */}
          <p className="mt-3.5 flex gap-2 rounded-xl bg-background p-3 text-caption text-muted-foreground">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Sin evidencia en el CV no significa necesariamente que no tengas esa competencia. Significa que el documento no la demuestra explícitamente.
          </p>
        </Panel>
      </div>
    </div>
  )
}
