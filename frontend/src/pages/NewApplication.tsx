import { Illustration } from "@/components/illustration"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeftIcon, BriefcaseIcon, FileUserIcon, SparklesIcon } from "lucide-react"
import { useState } from "react"
import { Link, useNavigate } from "react-router"
import { toast } from "sonner"
import { LiveRegion, StageProgress } from "@/components/common"
import { type DocValue, SourceInput } from "@/components/SourceInput"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api, appPath, followStages } from "@/lib/api"
import { cn } from "@/lib/utils"

// Pipeline por etapas: cada etapa es una tarea separada y verificable.
const GEN_STAGES = [
  { key: "analyzing_job", label: "Analizando el puesto: requisitos, prioridad y competencias" },
  { key: "extracting_evidence", label: "Extrayendo la evidencia de tu CV (profesional, proyectos, hackathons)" },
  { key: "mapping", label: "Cruzando requisitos con evidencia: qué tenés y qué falta" },
  { key: "designing", label: "Diseñando las etapas: recruiter, técnica, conductual y ejercicio" },
  { key: "generating", label: "Escribiendo 2 preguntas candidatas por competencia (español e inglés)" },
  { key: "validating", label: "Validando: premisas, preguntas dobles, inductivas, duplicados y cobertura" },
  { key: "saving", label: "Guardando la postulación" },
]
const ORDER = GEN_STAGES.map((g) => g.key)
const ETA: Record<string, number> = { analyzing_job: 30, mapping: 15, generating: 75, validating: 35 }   // segundos por etapa, medidos con una postulación real

export default function NewApplication() {
  const [job, setJob] = useState<DocValue | null>(null)
  const [cv, setCv] = useState<DocValue | null>(null)
  const [gen, setGen] = useState<{ stage: string; done: string[] } | null>(null)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const step = gen ? 2 : 1

  async function generate() {
    if (!job || !cv) return
    try {
      const { id } = await api.createApplication({ cv_md: cv.markdown, job_md: job.markdown, cv_source: cv.source, job_source: job.source })
      setGen({ stage: "analyzing_job", done: [] })
      followStages(`/api/applications/${id}/events`, (e) => {
        const i = ORDER.indexOf(e.stage)
        if (i >= 0) setGen({ stage: e.stage, done: ORDER.slice(0, i) })
        if (e.stage === "done") {
          qc.invalidateQueries({ queryKey: ["applications"] })
          navigate(`${appPath(id, "preguntas")}?nueva=1`)
        }
        if (e.stage === "error") { toast.error(e.message); setGen(null) }
      })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="w-fit"><Link to="/"><ArrowLeftIcon /> Postulaciones</Link></Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva postulación</h1>
        <Steps step={step} />
      </div>

      {!gen ? (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BriefcaseIcon className="size-5 text-primary" /> El puesto</CardTitle>
                <Illustration name="hiring" className="mx-auto max-w-28" />
                <CardDescription>El aviso, la descripción del rol o tus notas de preparación. Cuanto más detalle (empresa, requisitos, cómo es la entrevista), mejores preguntas.</CardDescription>
              </CardHeader>
              <CardContent><SourceInput kind="job" value={job} onChange={setJob} /></CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileUserIcon className="size-5 text-primary" /> Tu CV</CardTitle>
                <Illustration name="resume" className="mx-auto max-w-28" />
                <CardDescription>El CV que mandaste a esta postulación. Las respuestas modelo solo usan lo que diga acá.</CardDescription>
              </CardHeader>
              <CardContent><SourceInput kind="cv" value={cv} onChange={setCv} /></CardContent>
            </Card>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button size="lg" className="h-12 px-8 text-base" disabled={!job || !cv} onClick={generate}><SparklesIcon /> Generar la postulación</Button>
            <span className="text-sm text-muted-foreground">{!job || !cv ? "Cargá el puesto y tu CV para seguir." : "Tarda ~2–3 min (análisis, generación y validación). Después revisás y editás las preguntas."}</span>
          </div>
        </>
      ) : (
        <Card className="max-w-xl">
          <CardHeader><CardTitle>Generando tu postulación</CardTitle><CardDescription>La IA lee el puesto y tu CV como datos y arma la entrevista.</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Illustration name="ai-agent" eager className="mx-auto max-w-48" />
            <LiveRegion message={GEN_STAGES.find((s) => s.key === gen.stage)?.label ?? ""} />
            <StageProgress stages={GEN_STAGES} current={gen.stage} done={gen.done} etaS={ETA[gen.stage]} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Steps({ step }: { step: number }) {
  const items = ["Puesto y CV", "Generar", "Revisar preguntas"]
  return (
    <ol className="mt-3 flex flex-wrap items-center gap-2 text-sm" aria-label="Pasos">
      {items.map((t, i) => (
        <li key={t} className="flex items-center gap-2">
          <span className={cn("flex size-6 items-center justify-center rounded-full border text-xs", i + 1 <= step ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}
            aria-current={i + 1 === step ? "step" : undefined}>{i + 1}</span>
          <span className={cn(i + 1 === step ? "font-medium" : "text-muted-foreground")}>{t}</span>
          {i < items.length - 1 && <span aria-hidden className="mx-1 h-px w-6 bg-border" />}
        </li>
      ))}
    </ol>
  )
}
