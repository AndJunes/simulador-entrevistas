import { EmptyState, Illustration } from "@/components/illustration"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import { LineSmall } from "@/components/charts"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { api, appPath, LEVEL_LABEL } from "@/lib/api"

const ORDER = ["star_situation", "star_task", "star_action", "star_result", "decisions_tradeoffs", "learning", "relevance", "conciseness", "job_alignment", "cv_consistency",
  "clarity_structure", "motivation_company_knowledge", "experience_role_alignment", "communication_clarity", "communication_english", "professionalism_logistics",
  "technical_correctness", "reasoning", "edge_cases_failures", "testing_validation", "security_permissions", "tradeoffs_operability", "directness",
  "clarifies_assumptions", "uncertainty_transparency", "approach", "written_communication"]

export default function Progress({ appId }: { appId: string }) {
  const q = useQuery({ queryKey: ["progress", appId], queryFn: () => api.progress(appId) })
  if (q.isLoading) return <Skeleton className="h-64 w-full" />
  const days = q.data?.days ?? []
  const labels = q.data?.labels ?? {}
  if (!days.length) {
    return (
      <EmptyState name="predictive-analytics" title="Todavía no hay respuestas evaluadas"
        action={<Button asChild><Link to={appPath(appId, "practicar")}>Empezar a practicar</Link></Button>}>
        Cuando practiques, acá vas a ver tu evolución por competencia y por criterio, sin nota global: solo contra tus propios intentos.
      </EmptyState>
    )
  }
  const series = (k: keyof (typeof days)[number]) => days.map((d) => ({ x: d.day, y: d[k] as number | null }))
  const crits = ORDER.filter((c) => days.some((d) => d.criteria[c] != null))
  const oneDay = days.length === 1
  const compLabels = q.data?.competency_labels ?? {}
  const comps = Object.keys(compLabels).filter((c) => days.some((d) => d.competencies?.[c]?.avg != null))
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-[19px] font-bold tracking-[-0.035em]">Evolución por competencia</h2>
        <p className="mt-1 text-muted-foreground">Promedio por día de tus respuestas evaluadas ({days.reduce((a, d) => a + d.answers, 0)} en total). Comparás contra vos, no contra otros.</p>
      </div>
      {oneDay && (
        <div className="flex items-center gap-4 rounded-xl border border-dashed p-4">
          <Illustration name="data-reports" className="w-24 max-w-24" />
          <p className="text-label text-muted-foreground">Con un solo día de prácticas todavía no hay tendencia: los gráficos muestran un punto. Volvé a practicar otro día para ver la evolución.</p>
        </div>
      )}
      {comps.length > 0 && (
        <section aria-labelledby="competencias">
          <h2 id="competencias" className="mb-1 text-[19px] font-bold tracking-[-0.035em]">Por competencia (1–5, escala anclada)</h2>
          <p className="mb-3 text-sm text-muted-foreground">La logística no puntúa y no aparece acá. Debajo de cada gráfico, el tipo de evidencia que mostraste la última vez.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {comps.map((c) => {
              const last = [...days].reverse().find((d) => d.competencies?.[c]?.avg != null)
              const lv = last?.competencies?.[c]?.levels.filter(Boolean) ?? []
              return <LineSmall key={c} title={compLabels[c]} points={days.map((d) => ({ x: d.day, y: d.competencies?.[c]?.avg ?? null }))} yMin={1} yMax={5}
                hint={lv.length ? `Evidencia: ${[...new Set(lv)].map((l) => LEVEL_LABEL[l!]).join(", ")}` : undefined} />
            })}
          </div>
        </section>
      )}
      <section aria-labelledby="contenido">
        <h2 id="contenido" className="mb-3 text-[19px] font-bold tracking-[-0.035em]">Qué decís (1–5 por criterio)</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {crits.map((c) => (
            <LineSmall key={c} title={labels[c] ?? c} points={days.map((d) => ({ x: d.day, y: d.criteria[c] ?? null }))} yMin={1} yMax={5} />
          ))}
        </div>
      </section>
      <Collapsible>
        <CollapsibleTrigger className="text-label font-semibold text-teal-dark hover:underline">Métricas de entrega (opcional): inicio, duración, ritmo y muletillas</CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <p className="mb-3 max-w-[75ch] text-caption text-muted-foreground">Describen cómo sonás, no qué sabés: no son competencia técnica y no se usan para puntuar. El acento nunca se mide.</p>
      <section aria-labelledby="forma">
        <h2 id="forma" className="sr-only">Cómo sonás</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <LineSmall title="Inicio de la respuesta" unit=" s" points={series("first_word_latency_s")} yMin={0} hint="Segundos hasta tu primera palabra" />
          <LineSmall title="Duración en rango" unit="%" points={series("in_range_pct")} yMin={0} yMax={100} hint="% de respuestas dentro del rango sugerido" />
          <LineSmall title="Ritmo" unit="" points={series("wpm")} hint="Palabras por minuto" />
          <LineSmall title="Muletillas" unit="/min" points={series("fillers_per_min")} yMin={0} hint="Pausas llenas y marcadores repetidos" />
        </div>
      </section>
        </CollapsibleContent>
      </Collapsible>
      <Collapsible>
        <CollapsibleTrigger className="text-sm text-muted-foreground hover:text-foreground">Ver los datos en tabla</CollapsibleTrigger>
        <CollapsibleContent className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 pr-4">Día</th><th className="pr-4">Respuestas</th><th className="pr-4">Inicio (s)</th><th className="pr-4">En rango</th><th className="pr-4">Palabras/min</th><th>Muletillas/min</th></tr></thead>
            <tbody>{days.map((d) => (
              <tr key={d.day} className="border-b font-mono tabular-nums"><td className="py-1.5 pr-4">{d.day}</td><td className="pr-4">{d.answers}</td><td className="pr-4">{d.first_word_latency_s ?? "–"}</td><td className="pr-4">{d.in_range_pct ?? "–"}%</td><td className="pr-4">{d.wpm ?? "–"}</td><td>{d.fillers_per_min ?? "–"}</td></tr>
            ))}</tbody>
          </table>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
