import { EmptyState } from "@/components/illustration"
import { useQuery } from "@tanstack/react-query"
import { InfoIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { api, type EvalSummary } from "@/lib/api"
import { useAppId } from "@/lib/app"

const fmt = (v: number | null | undefined, u = "") => (v == null ? "–" : `${v}${u}`)

/** SYSTEM quality (not yours): do the generator, interviewer and evaluator do their job well? */
export default function Quality() {
  const appId = useAppId()
  const q = useQuery({ queryKey: ["quality", appId], queryFn: () => api.quality(appId) })
  if (q.isLoading) return <Skeleton className="h-64 w-full" />
  if (!q.data) return <p>No se pudieron cargar las métricas.</p>
  const { generator: g, interviewer: i, evaluator: e, session_coverage: sc, evals } = q.data
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground"><InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          Esto no mide tu desempeño: mide si las preguntas, las repreguntas y las devoluciones de esta postulación son buenas. Tus marcas (aprobada, útil, redundante, ¿te sirvió?) alimentan estos números.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Block title="Preguntas (generador)" desc={`${g.questions} preguntas · formato nuevo: ${g.apps_v2 ? "sí" : "no"}`} rows={[
          ["Aprobadas por vos", fmt(g.approved_pct, "%")],
          ["Con avisos del validador", fmt(g.with_issues_pct, "%")],
          ["Premisas no fundamentadas", String(g.unsupported_premises)],
          ["Preguntas dobles / inductivas", `${g.multi_part} / ${g.leading}`],
          ["Duplicados eliminados", String(g.duplicates_removed)],
          ["Cobertura de obligatorios", fmt(g.must_have_coverage_pct, "%")],
          ["Costo de generación", g.cost_usd ? `US$${g.cost_usd}` : "–"],
        ]} foot={g.uncovered.length ? `Sin cubrir: ${g.uncovered.join(", ")}` : undefined} />
        <Block title="Repreguntas (entrevistador)" desc={`${i.main_questions} preguntas en simulacros`} rows={[
          ["Repreguntas por pregunta", fmt(i.followups_per_question)],
          ["Decisiones registradas", String(i.decisions)],
          ["Saltos justificados (no hacía falta)", String(i.justified_skips)],
          ["Marcadas como redundantes", i.flagged ? `${fmt(i.redundant_pct, "%")} de ${i.flagged}` : "– (marcalas en el informe)"],
          ["Máximo en una pregunta", String(i.max_per_question)],
        ]} />
        <Block title="Devoluciones (evaluador)" desc={`${e.evaluations} evaluaciones`} rows={[
          ["Te sirvieron", e.feedback_rated ? `${fmt(e.feedback_useful_pct, "%")} de ${e.feedback_rated}` : "– (votá en cada devolución)"],
          ["Con afirmaciones que no están en tu CV", fmt(e.unsupported_claims_pct, "%")],
          ["Confianza del evaluador", Object.entries(e.confidence).map(([k, v]) => `${k} ${v}`).join(" · ") || "–"],
          ["Mejora de competencia al reintentar", e.retries ? `${e.retry_competency_delta! > 0 ? "+" : ""}${e.retry_competency_delta} (${e.retries} reintentos)` : "–"],
        ]} />
      </div>

      {sc.length > 0 && (
        <Card size="sm">
          <CardHeader><CardTitle className="text-base">Cobertura por simulacro</CardTitle><CardDescription>Qué parte del plan respondiste y cuántas preguntas obligatorias llegaste a cubrir.</CardDescription></CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y text-sm">
              {sc.map((s) => (
                <li key={s.session_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="flex items-center gap-2"><Badge variant="secondary">{s.stage ?? "formato anterior"}</Badge>{s.planned} preguntas</span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">respondidas {fmt(s.answered_pct, "%")} · obligatorias {fmt(s.must_have_answered_pct, "%")}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <EvalCard title="Evals del generador (A/B sobre el dataset fijo)" s={evals.generator}
          empty="Todavía no se corrió. Desde la terminal: evals/run_generator.py" />
        <EvalCard title="Consistencia del evaluador" s={evals.consistency}
          empty="Todavía no se corrió. Desde la terminal: evals/run_evaluator_consistency.py" />
      </div>
    </div>
  )
}

function Block({ title, desc, rows, foot }: { title: string; desc: string; rows: [string, string][]; foot?: string }) {
  return (
    <Card size="sm">
      <CardHeader><CardTitle className="text-base">{title}</CardTitle><CardDescription>{desc}</CardDescription></CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-sm">
          {rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-mono tabular-nums">{v}</dd></div>)}
        </dl>
        {foot && <p className="mt-3 text-xs text-muted-foreground">{foot}</p>}
      </CardContent>
    </Card>
  )
}

function EvalCard({ title, s, empty }: { title: string; s: EvalSummary | null; empty: string }) {
  const headline = (s?.headline as [string, string][] | undefined) ?? []
  if (!s) return <EmptyState name="futuristic-interface" title={title}>{empty}</EmptyState>
  return (
    <Card size="sm">
      <CardHeader><CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{s ? `${s.file}${s.created_at ? ` · ${new Date(String(s.created_at)).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" })}` : ""}` : empty}</CardDescription></CardHeader>
      {s && (
        <CardContent>
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-sm">
            {headline.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-mono tabular-nums">{v}</dd></div>)}
          </dl>
          {typeof s.note === "string" && <p className="mt-3 text-xs text-muted-foreground">{s.note}</p>}
        </CardContent>
      )}
    </Card>
  )
}
