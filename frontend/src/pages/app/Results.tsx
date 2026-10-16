import { useQuery } from "@tanstack/react-query"
import { MessageSquareTextIcon, PlayIcon, TrendingUpIcon } from "lucide-react"
import { Link, useSearchParams } from "react-router"
import { MetricCard, PageHeader } from "@/components/page"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api, appPath } from "@/lib/api"
import { useAppId } from "@/lib/app"
import { practiceState } from "@/lib/nextStep"
import History from "../History"
import Progress from "../Progress"

const TABS = [
  { v: "progreso", label: "Evolución" },
  { v: "practica", label: "Prácticas por pregunta" },
  { v: "simulacros", label: "Simulacros" },
  { v: "videollamadas", label: "Videollamadas" },
  { v: "ejercicios", label: "Ejercicios" },
]

/** Progreso y resultados: qué mejorar, con datos reales. Cada pestaña separa un tipo de práctica. */
export default function Results() {
  const appId = useAppId()
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.v === params.get("tab")) ? params.get("tab")! : "progreso"
  const app = useQuery({ queryKey: ["app", appId], queryFn: () => api.application(appId) })
  const sessions = useQuery({ queryKey: ["sessions", appId], queryFn: () => api.sessions(appId) })
  const prog = useQuery({ queryKey: ["progress", appId], queryFn: () => api.progress(appId) })
  const done = (sessions.data ?? []).filter((s) => s.turns > 0)
  const { practiced } = practiceState(prog.data?.days ?? [])
  const asked = new Set((app.data?.questions ?? []).map((q) => q.primary_competency))
  const practicedHere = [...practiced].filter((c) => asked.has(c)).length

  return (
    <div>
      <PageHeader eyebrow="Tu evolución" title={<>Lo que ya demostrás y<br className="max-[560px]:hidden" /> lo que falta practicar.</>}
        intro="Compará tus respuestas con tus intentos anteriores. Los indicadores describen tu práctica, no predicen una contratación."
        action={<Button asChild variant="dark" size="cta"><Link to={appPath(appId, "practicar")}>Nueva práctica →</Link></Button>} />
      <ul className="mb-7 grid gap-[9px] min-[561px]:grid-cols-3 min-[561px]:gap-3.5" aria-label="Tu actividad">
        <MetricCard icon={<PlayIcon />} value={done.length} label="Prácticas realizadas" desc="En esta candidatura" />
        <MetricCard icon={<MessageSquareTextIcon />} tone="info" value={done.reduce((n, s) => n + s.turns, 0)} label="Respuestas evaluadas" desc="Con devolución disponible" />
        <MetricCard icon={<TrendingUpIcon />} tone="warn" value={`${practicedHere} de ${asked.size}`} label="Competencias practicadas" desc="De las que evalúan las preguntas de este puesto" />
      </ul>
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })} className="gap-4">
        <TabsList className="h-auto flex-wrap justify-start">{TABS.map((t) => <TabsTrigger key={t.v} value={t.v} className="min-h-9">{t.label}</TabsTrigger>)}</TabsList>
        <TabsContent value="progreso"><Progress appId={appId} /></TabsContent>
        <TabsContent value="practica"><History appId={appId} mode="practice" /></TabsContent>
        <TabsContent value="simulacros"><History appId={appId} mode="mock" /></TabsContent>
        <TabsContent value="videollamadas"><History appId={appId} mode="videocall" /></TabsContent>
        <TabsContent value="ejercicios"><History appId={appId} mode="exercise" /></TabsContent>
      </Tabs>
    </div>
  )
}
