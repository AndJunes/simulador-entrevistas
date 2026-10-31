import { useAutoAnimate } from "@formkit/auto-animate/react"
import { useQuery } from "@tanstack/react-query"
import { CheckIcon, ChevronDownIcon, MinusIcon, QuoteIcon, SearchIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link, useLocation, useSearchParams } from "react-router"
import { EmptyState } from "@/components/illustration"
import { Eyebrow, PageHeader, Panel, SectionHead, StatusBadge, Tag } from "@/components/page"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api, type Application, appPath, type EvidenceItem, KIND_LABEL, type Priority, type Requirement, type Stage } from "@/lib/api"
import { useAppId } from "@/lib/app"
import { practiceState, PRIORITY_SHORT, questionsFor, requirementOrder } from "@/lib/nextStep"
import { cn } from "@/lib/utils"

const STAGE_SHORT: Record<Stage, string> = { recruiter_screen: "Recruiter", technical_screen: "Técnica", behavioral_client: "Conductual", work_sample: "Ejercicio" }

/** Job requirements and CV & evidence: the same data seen from the requirement or from the CV. */
export default function Requirements({ view }: { view: "req" | "coverage" | "cv" }) {
  const appId = useAppId()
  const app = useQuery({ queryKey: ["app", appId], queryFn: () => api.application(appId) })
  const prog = useQuery({ queryKey: ["progress", appId], queryFn: () => api.progress(appId) })
  if (app.isError) return <p role="alert" className="rounded-card border p-5">No pudimos cargar los requisitos. Revisá que el backend esté corriendo y recargá.</p>
  if (!app.data) return <Skeleton className="h-64 w-full" />
  const a = app.data
  const { practiced } = practiceState(prog.data?.days ?? [])
  const isPracticed = (r: Requirement) => questionsFor(r, a.questions).some((q) => practiced.has(q.primary_competency))
  if (view === "cv") return <ByExperience a={a} />
  if (view === "coverage") return <Coverage a={a} />
  return <ByRequirement a={a} isPracticed={isPracticed} />
}

// By requirement

type Filter = "all" | "strong" | "partial" | "gap" | Priority
const FILTERS: { v: Filter; label: string; test: (r: Requirement) => boolean }[] = [
  { v: "all", label: "Todos", test: () => true },
  { v: "strong", label: "Evidencia fuerte", test: (r) => r.coverage === "strong" },
  { v: "partial", label: "Evidencia parcial", test: (r) => r.coverage === "partial" },
  { v: "gap", label: "Sin evidencia", test: (r) => r.coverage === "gap" },
  { v: "must_have", label: "Obligatorios", test: (r) => r.priority === "must_have" },
  { v: "important", label: "Importantes", test: (r) => r.priority === "important" },
  { v: "nice_to_have", label: "Deseables", test: (r) => r.priority === "nice_to_have" },
]
const norm = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()

function ByRequirement({ a, isPracticed }: { a: Application; isPracticed: (r: Requirement) => boolean }) {
  const appId = useAppId()
  const [params, setParams] = useSearchParams()
  const { hash } = useLocation()
  const [open, setOpen] = useState<Set<string>>(() => new Set(hash ? [hash.slice(1)] : []))
  const [listRef] = useAutoAnimate<HTMLUListElement>({ duration: 200 })
  const filter = (FILTERS.some((f) => f.v === params.get("f")) ? params.get("f") : "all") as Filter
  const q = params.get("q") ?? ""
  const ev = useMemo(() => Object.fromEntries(a.evidence.map((e) => [e.id, e])), [a.evidence])
  const matrix = a.generation_report?.coverage?.matrix ?? {}
  const sorted = useMemo(() => [...a.requirements].sort(requirementOrder), [a.requirements])
  const matchesText = (r: Requirement) => !q || norm(`${r.id} ${r.text} ${r.competency_label ?? ""}`).includes(norm(q))
  const shown = sorted.filter((r) => matchesText(r) && FILTERS.find((f) => f.v === filter)!.test(r))
  const filters = FILTERS.filter((f) => f.v === "all" || sorted.some(f.test))

  const must = sorted.filter((r) => r.priority === "must_have")
  const mustOpen = must.filter((r) => r.coverage !== "strong").length
  const count = (t: (r: Requirement) => boolean) => sorted.filter(t).length

  // #R2 in the URL: opens that requirement and gives it focus
  useEffect(() => {
    if (hash) document.getElementById(`req-btn-${hash.slice(1)}`)?.focus()
  }, [hash])

  const setParam = (k: "f" | "q", v: string) => {
    const next = new URLSearchParams(params)
    if (!v || (k === "f" && v === "all")) next.delete(k); else next.set(k, v)
    setParams(next, { replace: true })
  }
  const flip = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const allOpen = shown.length > 0 && shown.every((r) => open.has(r.id))

  return (
    <div>
      <PageHeader eyebrow="Análisis del puesto" title={<>Requisitos, sin perderte<br className="max-[560px]:hidden" /> en los detalles.</>}
        intro="Filtrá por estado y abrí solo los requisitos que necesites. Cada conclusión debe poder rastrearse a una evidencia o cita."
        action={<div className="flex flex-wrap gap-2">
          <Button variant="soft" size="cta" onClick={() => setOpen(allOpen ? new Set() : new Set(shown.map((r) => r.id)))}>{allOpen ? "Cerrar todos" : "Abrir todos"}</Button>
          <Button asChild variant="soft" size="cta"><Link to={appPath(appId, "requisitos/cobertura")}>Cobertura por etapa</Link></Button>
        </div>} />

      {/* Coverage summary: totals derived from the API */}
      <Panel aria-labelledby="cov-sum-h">
        <Eyebrow>Resumen de cobertura</Eyebrow>
        <h2 id="cov-sum-h" className="my-1.5 text-xl font-bold tracking-[-0.03em]">{mustOpen ? `${mustOpen} de ${must.length} obligatorios sin evidencia completa` : "Todos los obligatorios tienen evidencia fuerte"}</h2>
        <p className="text-caption text-muted-foreground">Los estados describen lo que muestra tu CV, no todo lo que sabés.</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 min-[851px]:grid-cols-5">
          {([["Obligatorios", count((r) => r.priority === "must_have")], ["Deseables e importantes", count((r) => r.priority !== "must_have")],
            ["Evidencia fuerte", count((r) => r.coverage === "strong")], ["Evidencia parcial", count((r) => r.coverage === "partial")],
            ["Sin evidencia", count((r) => r.coverage === "gap")]] as const).map(([k, v]) => (
            <div key={k} className="flex flex-col-reverse rounded-row border bg-card p-[15px]"><dt className="text-caption text-muted-foreground">{k}</dt><dd className="num text-[23px] font-extrabold tracking-[-0.04em]">{v}</dd></div>
          ))}
        </dl>
      </Panel>

      {/* Filters + search: combinable; state in the URL */}
      <div className="my-[15px] flex flex-wrap items-center gap-2">
        <label className="relative min-w-[200px] max-[560px]:w-full">
          <span className="sr-only">Buscar requisito</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input type="search" value={q} onChange={(e) => setParam("q", e.target.value)} placeholder="Buscar requisito…"
            className="h-11 w-full rounded-[11px] border border-input bg-card pl-9 pr-3 text-label placeholder:text-muted-foreground" />
        </label>
        <div role="group" aria-label="Filtrar requisitos" className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button key={f.v} type="button" aria-pressed={filter === f.v} onClick={() => setParam("f", f.v)}
              className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-[10px] border px-3 text-caption font-bold transition-colors duration-[var(--dur-fast)]",
                filter === f.v ? "border-primary/40 bg-mint text-teal-dark" : "border-input bg-card text-muted-foreground hover:text-foreground")}>
              {filter === f.v && <CheckIcon className="size-3.5" aria-hidden />}{f.label} <span className="num">· {count(f.test)}</span>
            </button>
          ))}
        </div>
      </div>
      <p role="status" className="mb-3 text-caption text-muted-foreground">Mostrando <span className="num">{shown.length}</span> de <span className="num">{sorted.length}</span> requisitos{shown.length > 1 ? ": obligatorios sin evidencia primero" : ""}.</p>

      {!shown.length ? (
        <EmptyState name="screening-resumes" title={q ? `Ningún requisito coincide con "${q}"` : "Ningún requisito coincide con este filtro"}
          action={<Button variant="soft" size="cta" onClick={() => setParams({}, { replace: true })}>Limpiar búsqueda y filtros</Button>} />
      ) : (
        <ul ref={listRef} className="grid gap-2.5">
          {shown.map((r) => {
            const isOpen = open.has(r.id)
            const qs = questionsFor(r, a.questions)
            const stages = (matrix[r.id] ?? []) as Stage[]
            const linked = (r.evidence_ids ?? []).filter((id) => ev[id])
            return (
              <li key={r.id} id={r.id} className="scroll-mt-28 overflow-hidden rounded-row border bg-card">
                <h3>
                  <button id={`req-btn-${r.id}`} type="button" aria-expanded={isOpen} aria-controls={`req-panel-${r.id}`} onClick={() => flip(r.id)}
                    className="grid min-h-16 w-full grid-cols-[34px_minmax(0,1fr)_20px] items-center gap-x-[9px] gap-y-1.5 p-3 text-left hover:bg-soft/60 min-[561px]:grid-cols-[38px_minmax(0,1fr)_auto_20px] min-[561px]:gap-3 min-[561px]:p-[15px]">
                    <span className="num grid size-[34px] place-items-center rounded-[10px] bg-soft text-caption font-extrabold">{r.id}</span>
                    <span className="min-w-0">
                      <span className="block text-label font-extrabold">{r.text}</span>
                      <span className="mt-0.5 block text-caption text-muted-foreground">
                        <span className={cn(r.priority === "must_have" && "font-bold text-foreground")}>{PRIORITY_SHORT[r.priority ?? "important"]}</span>
                        {" · "}{isPracticed(r) ? "Practicado" : "Sin practicar"}
                      </span>
                    </span>
                    <StatusBadge coverage={r.coverage} short className="col-start-2 justify-self-start min-[561px]:col-start-auto" />
                    <ChevronDownIcon className={cn("col-start-3 row-start-1 size-5 text-muted-foreground transition-transform duration-[var(--dur-fast)] min-[561px]:col-start-auto min-[561px]:row-start-auto", isOpen && "rotate-180")} aria-hidden />
                  </button>
                </h3>
                <div id={`req-panel-${r.id}`} className="collapse-grid" data-open={isOpen} inert={!isOpen}>
                  <div>
                    {/* Detail: two blocks + actions. The posting quote is labeled as such, never as CV. */}
                    <div className="grid gap-3.5 border-t border-border/70 p-[18px] min-[561px]:grid-cols-2">
                      <div className="rounded-xl bg-soft p-[13px]">
                        <h4 className="mb-1.5 text-caption font-bold">Qué muestra la evidencia</h4>
                        <p className="text-caption text-muted-foreground sm:text-label">{r.cv_evidence || "El CV no muestra evidencia explícita para este requisito."}</p>
                        {!!linked.length && <ul className="mt-2.5 flex flex-col gap-1.5">{linked.map((id) => (
                          <li key={id} className="flex flex-wrap items-center gap-1.5 text-caption">
                            <Tag tone={ev[id].kind === "professional" || ev[id].kind === "freelance" ? "mint" : "soft"}>{KIND_LABEL[ev[id].kind]}</Tag>
                            <Link to={`${appPath(appId, "evidencia")}#${id}`} className="font-semibold underline-offset-2 hover:underline">{ev[id].title}</Link>
                            {ev[id].dates && <span className="text-muted-foreground">· {ev[id].dates}</span>}
                          </li>
                        ))}</ul>}
                      </div>
                      <div className="rounded-xl bg-soft p-[13px]">
                        <h4 className="mb-1.5 text-caption font-bold">Qué falta demostrar</h4>
                        <p className="text-caption text-muted-foreground sm:text-label">{r.gap || "Nada pendiente según el análisis: prepará un ejemplo concreto para contarlo."}</p>
                        <p className="mt-2 text-caption text-muted-foreground">Se evalúa en: {stages.length ? stages.map((s) => STAGE_SHORT[s] ?? s).join(" · ") : "ninguna etapa todavía"}</p>
                      </div>
                      <div className="flex flex-col items-start justify-between gap-3 min-[561px]:col-span-2 min-[561px]:flex-row min-[561px]:items-center">
                        {r.source_quote
                          ? <details className="min-w-0 text-caption text-muted-foreground"><summary className="inline-flex min-h-8 cursor-pointer items-center py-1 font-semibold text-teal-dark">Ver fuente/cita del aviso</summary>
                              <p className="mt-1.5 flex max-w-[70ch] gap-1.5 italic"><QuoteIcon className="mt-0.5 size-3.5 shrink-0 not-italic" aria-hidden />{r.source_quote}</p></details>
                          : <span className="text-caption text-muted-foreground">Sin cita del aviso registrada.</span>}
                        {qs.length
                          ? <Button asChild variant="dark" size="cta" className="shrink-0"><Link to={`${appPath(appId, "practica")}?q=${qs[0].id}`}>Practicar una pregunta relacionada →</Link></Button>
                          : <span className="text-caption text-muted-foreground">Todavía no hay preguntas vinculadas a este requisito.</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// Coverage by stage

function Coverage({ a }: { a: Application }) {
  const appId = useAppId()
  const cov = a.generation_report?.coverage
  const header = <PageHeader eyebrow="Análisis del puesto" title="Cobertura por etapa."
    intro="Qué requisitos se exploran en cada etapa de la entrevista. El inglés no se pregunta: se observa durante toda la entrevista."
    action={<Button asChild variant="soft" size="cta"><Link to={appPath(appId, "requisitos")}>← Volver a los requisitos</Link></Button>} />
  if (!cov?.matrix) return <>{header}<EmptyState name="screening-resumes" title="Todavía no hay cobertura calculada">Se calcula al generar la postulación con el formato nuevo.</EmptyState></>
  const stages = a.blueprints.map((b) => b.stage)
  const reqs = [...a.requirements].sort(requirementOrder)
  return (
    <div>
      {header}
      <SectionHead id="cov-h" title={cov.uncovered.length ? `Quedan sin evaluar: ${cov.uncovered.join(", ")}` : "Cada obligatorio se evalúa en al menos una etapa"} />
      {/* ≥768px: table. <768px: list (WCAG 1.4.10, no horizontal scroll) */}
      <div className="hidden overflow-x-auto rounded-card border bg-card md:block">
        <table className="w-full text-label">
          <caption className="sr-only">Requisitos por etapa de la entrevista</caption>
          <thead><tr className="border-b text-left text-caption text-muted-foreground">
            <th scope="col" className="p-3 font-medium">Requisito</th>
            {stages.map((s) => <th key={s} scope="col" className="p-3 text-center font-medium">{STAGE_SHORT[s]}</th>)}
          </tr></thead>
          <tbody>{reqs.map((r) => (
            <tr key={r.id} className="border-b last:border-0">
              <th scope="row" className="p-3 text-left font-normal"><span className="num text-muted-foreground">{r.id}</span> {r.text}
                <span className="ml-1 text-caption text-muted-foreground">· {PRIORITY_SHORT[r.priority ?? "important"]}</span></th>
              {stages.map((s) => (
                <td key={s} className="p-3 text-center">{(cov.matrix[r.id] ?? []).includes(s)
                  ? <CheckIcon className="mx-auto size-4 text-ok" aria-label="Se evalúa" />
                  : <MinusIcon className="mx-auto size-4 text-muted-foreground/50" aria-label="No se evalúa" />}</td>
              ))}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <ul className="flex flex-col divide-y rounded-card border bg-card md:hidden">
        {reqs.map((r) => (
          <li key={r.id} className="p-3 text-label">
            <span className="num text-muted-foreground">{r.id}</span> <span className="font-medium">{r.text}</span>
            <p className="text-muted-foreground">Se evalúa en: {(cov.matrix[r.id] ?? []).map((s) => STAGE_SHORT[s as Stage] ?? s).join(" · ") || "ninguna etapa"}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

// CV and evidence

const GROUPS: { kind: EvidenceItem["kind"]; title: string; sub: string }[] = [
  { kind: "professional", title: "Experiencia profesional", sub: "Empleo. Cuenta como años de experiencia laboral." },
  { kind: "freelance", title: "Trabajo freelance remunerado", sub: "Trabajo pago por proyecto. Cuenta como experiencia laboral." },
  { kind: "project", title: "Proyectos propios", sub: "Demuestran competencias, pero no agregan años laborales." },
  { kind: "academic", title: "Educación", sub: "Formación y cursos." },
  { kind: "hackathon", title: "Hackathons y logros", sub: "Demuestran competencias en un contexto acotado." },
  { kind: "volunteer", title: "Voluntariado", sub: "Experiencia no remunerada." },
]

function ByExperience({ a }: { a: Application }) {
  const appId = useAppId()
  const { hash } = useLocation()
  useEffect(() => { if (hash) document.getElementById(hash.slice(1))?.scrollIntoView() }, [hash])
  const header = <PageHeader eyebrow="Tu experiencia" title="Tu CV, traducido a evidencia."
    intro="Qué experiencia respalda cada afirmación, sin inventar logros ni esconder brechas."
    action={<Button asChild variant="soft" size="cta"><Link to={appPath(appId, "requisitos")}>Ver requisitos vinculados →</Link></Button>} />
  if (!a.evidence?.length) return <>{header}<EmptyState name="candidate" title="Todavía no hay evidencia extraída de tu CV">Se extrae al generar la postulación con el formato nuevo (Practicar → Banco de preguntas → Actualizar).</EmptyState></>
  const backs = (e: EvidenceItem) => a.requirements.filter((r) => r.evidence_ids?.includes(e.id)).map((r) => r.id)
  // Technologies → which evidence they appear in (only what the CV says; nothing inferred for being "common")
  const techs = new Map<string, string[]>()
  for (const e of a.evidence) for (const t of e.technologies) techs.set(t, [...(techs.get(t) ?? []), e.id])

  return (
    <div>
      {header}
      <Panel aria-labelledby="dist-h">
        <Tag tone="warn">Distinción importante</Tag>
        <h2 id="dist-h" className="my-2.5 text-lg font-bold tracking-[-0.03em]">Años profesionales y competencia demostrada se miden por separado.</h2>
        <p className="max-w-[75ch] text-[13px] text-muted-foreground">{a.analysis?.years_vs_competence || "Los proyectos propios pueden demostrar capacidad técnica, pero no se contabilizan como años de empleo profesional. Cada afirmación enlaza con su evidencia."}</p>
      </Panel>

      {GROUPS.map((g) => {
        const items = a.evidence.filter((e) => e.kind === g.kind)
        if (!items.length) return null
        return (
          <Panel key={g.kind} aria-labelledby={`g-${g.kind}`} className="mt-7">
            <SectionHead id={`g-${g.kind}`} title={g.title} sub={g.sub} />
            <ul>
              {items.map((e) => {
                const ids = backs(e)
                return (
                  <li key={e.id} id={e.id} className="flex scroll-mt-28 flex-col justify-between gap-2 border-b border-border/70 py-4 last:border-0 min-[561px]:flex-row min-[561px]:gap-4">
                    <div className="min-w-0">
                      <strong className="text-[13px] font-bold">{e.title}</strong>
                      <p className="my-1 text-caption text-muted-foreground">{[e.org, e.dates].filter(Boolean).join(" · ") || "Fechas no disponibles en el CV"}</p>
                      {!!e.technologies.length && <p className="text-caption">{e.technologies.join(" · ")}</p>}
                      <p className="mt-1.5 text-caption text-muted-foreground">Respalda: {ids.length ? ids.map((id, i) => <span key={id}>{i > 0 && ", "}<Link to={`${appPath(appId, "requisitos")}#${id}`} className="num font-semibold text-teal-dark hover:underline">{id}</Link></span>) : "ningún requisito directamente"}</p>
                      {e.quote && <details className="mt-1.5 text-caption text-muted-foreground"><summary className="inline-flex min-h-8 cursor-pointer items-center py-1 font-semibold text-teal-dark">Ver cita del CV</summary>
                        <p className="mt-1 flex max-w-[75ch] gap-1.5 italic"><QuoteIcon className="mt-0.5 size-3.5 shrink-0 not-italic" aria-hidden />{e.quote}</p></details>}
                    </div>
                    <Tag tone={g.kind === "professional" || g.kind === "freelance" ? "mint" : "soft"} className="self-start">{KIND_LABEL[e.kind]}</Tag>
                  </li>
                )
              })}
            </ul>
          </Panel>
        )
      })}

      {techs.size > 0 && (
        <Panel aria-labelledby="tech-h" className="mt-7">
          <SectionHead id="tech-h" title="Tecnologías y evidencia vinculada" sub="Dónde aparece cada tecnología en tu CV. No se agregan tecnologías que el CV no menciona." />
          <ul className="flex flex-wrap gap-2">
            {[...techs].sort((x, y) => y[1].length - x[1].length).map(([t, ids]) => (
              <li key={t} className="rounded-[10px] border bg-card px-2.5 py-1.5 text-caption"><span className="font-semibold">{t}</span> <span className="text-muted-foreground">· {ids.map((id) => a.evidence.find((e) => e.id === id)?.title.split(/[—(·]/)[0].trim()).join(", ")}</span></li>
            ))}
          </ul>
        </Panel>
      )}

      {!!a.analysis?.cv_ambiguities?.length && (
        <Panel aria-labelledby="amb-h" className="mt-7">
          <SectionHead id="amb-h" title="Información no disponible o para aclarar" sub="Datos que el CV no deja claros. No los tomes como hechos." />
          <ul className="flex max-w-[75ch] list-disc flex-col gap-1 pl-5 text-label text-muted-foreground">{a.analysis.cv_ambiguities.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </Panel>
      )}
    </div>
  )
}
