import { useQuery } from "@tanstack/react-query"
import { ArrowLeftIcon } from "lucide-react"
import { Link, useParams } from "react-router"
import { CoachingView } from "@/components/feedback"
import { CallChat, CompetencyCard, EvidencePanel, FeedbackRating, IdealAnswer, MetricsStrip, ToFive } from "@/components/review"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api, appPath } from "@/lib/api"
import { useAppContext, useAppId } from "@/lib/app"

export default function SessionView() {
  const appId = useAppId()
  const company = useAppContext().data?.company || "la empresa"
  const { sid = "" } = useParams()
  const q = useQuery({ queryKey: ["session", sid], queryFn: () => api.session(sid) })
  if (q.isLoading) return <Skeleton className="h-96 w-full" />
  if (!q.data) return <p>No encontramos la sesión.</p>
  const turns = q.data.turns.filter((t) => t.status === "done")
  return (
    <div className="flex flex-col gap-8">
      <Button asChild variant="ghost" size="sm" className="w-fit"><Link to={appPath(appId, "resultados")}><ArrowLeftIcon /> Resultados</Link></Button>
      <h1 className="text-2xl font-semibold tracking-tight">Sesión del {new Date(q.data.created_at).toLocaleString("es-AR", { dateStyle: "long", timeStyle: "short" })}</h1>
      {turns.length === 0 && <p className="text-muted-foreground">Esta sesión no tiene respuestas procesadas.</p>}
      {turns.map((t) => {
        const ev = t.evaluation?.evaluation
        return (
          <article key={t.id} className="flex flex-col gap-3 border-t pt-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-mono">{t.question_id}</Badge>
              {t.kind === "coaching" && <Badge variant="outline">Orientación</Badge>}
              {t.attempt_of && <Badge variant="outline">Reintento</Badge>}
              {t.is_followup && <Badge variant="outline">Repregunta de práctica</Badge>}
              {t.input_mode === "written" && <Badge variant="outline">Ejercicio escrito</Badge>}
              <span className="text-sm text-muted-foreground">{new Date(t.created_at).toLocaleTimeString("es-AR", { timeStyle: "short" })}</span>
            </div>
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(320px,400px)_1fr]">
              <aside className="flex flex-col gap-3 rounded-2xl border bg-card/60 p-4">
                {t.input_mode === "written" ? (
                  <>
                    <p className="whitespace-pre-wrap text-sm">{t.question_text}</p>
                    {(t.extra?.clarifications ?? []).map((c, i) => (
                      <div key={i} className="text-xs"><p className="font-medium">P: {c.q}</p><p className="text-muted-foreground">R: {c.a}</p></div>
                    ))}
                    <pre className="max-h-[60svh] overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-xs leading-5">{t.transcript?.text}</pre>
                  </>
                ) : (
                  <CallChat interviewer={`Recruiter · ${company}`} question={t.question_text} transcript={t.transcript} metrics={t.metrics} evaluation={ev} coaching={t.coaching?.coaching} audioUrl={t.audio_url} compact />
                )}
              </aside>
              <div className="flex flex-col gap-6">
                {ev && <CompetencyCard ev={ev} />}
                {t.metrics && <MetricsStrip m={t.metrics} />}
                {ev && <EvidencePanel ev={ev} />}
                {ev && <ToFive criteria={ev.criteria} lang={t.lang} />}
                {ev && <IdealAnswer text={ev.model_answer} lang={t.lang} />}
                {t.coaching && <CoachingView c={t.coaching.coaching} />}
                {ev && <FeedbackRating turnId={t.id} initial={t.feedback_rating ?? null} />}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
