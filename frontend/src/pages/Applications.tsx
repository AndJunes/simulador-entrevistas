import { EmptyState, Illustration } from "@/components/illustration"
import { PageHeader, Panel, Tag } from "@/components/page"
import { useQuery } from "@tanstack/react-query"
import { ArrowRightIcon, BriefcaseIcon, CalendarClockIcon, FileTextIcon, LoaderCircleIcon, PlusIcon, SparklesIcon } from "lucide-react"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api, appPath, type AppSummary } from "@/lib/api"

const STATUS: Record<AppSummary["status"], string> = { draft: "Borrador", generating: "Generando preguntas…", ready: "En preparación", error: "Error al generar" }

export default function Applications() {
  const q = useQuery({ queryKey: ["applications"], queryFn: api.applications, refetchInterval: (qq) => (qq.state.data?.some((a) => a.status === "generating") ? 3000 : false) })
  if (q.isError) {
    return <EmptyState name="artificial-intelligence" title="No pudimos conectar con el backend">Revisá que esté corriendo (./dev.sh) y recargá la página.</EmptyState>
  }
  if (q.isLoading) return <Skeleton className="h-64 w-full" />
  const apps = q.data ?? []

  if (!apps.length) return <Welcome />

  return (
    <div>
      <PageHeader eyebrow="Tu espacio" title="Tus postulaciones."
        intro="Cada candidatura tiene su propio CV, requisitos, preguntas y resultados. Elegí una para continuar."
        action={<Button asChild variant="dark" size="cta"><Link to="/postulaciones/nueva"><PlusIcon aria-hidden /> Nueva postulación</Link></Button>} />
      <Panel aria-label="Postulaciones" className="max-w-[900px]">
        <ul>
          {apps.map((a) => (
            <li key={a.id} className="flex flex-col justify-between gap-3 border-b border-border/70 py-4 first:pt-0 last:border-0 last:pb-0 min-[561px]:flex-row min-[561px]:items-center">
              <div className="min-w-0">
                <strong className="block text-[15px] font-extrabold tracking-[-0.02em]">{a.title}</strong>
                <p className="my-1 flex flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
                  <span className="flex items-center gap-1"><BriefcaseIcon className="size-3.5" aria-hidden />{a.company || "Empresa sin nombre"}</span>
                  <span>· <span className="num">{a.questions}</span> preguntas · <span className="num">{a.counts.practice ?? 0}</span> prácticas · <span className="num">{(a.counts.mock ?? 0) + (a.counts.videocall ?? 0)}</span> simulacros</span>
                </p>
                {a.interview?.when && <p className="mb-1 flex items-center gap-1 text-caption text-muted-foreground"><CalendarClockIcon className="size-3.5" aria-hidden />{a.interview.when.replace(/\*\*/g, "")}</p>}
                <Tag tone={a.status === "ready" ? "mint" : a.status === "error" ? "none" : "warn"}>
                  {a.status === "generating" && <LoaderCircleIcon className="size-3.5 motion-safe:animate-spin" aria-hidden />}{STATUS[a.status]}
                </Tag>
              </div>
              <Button asChild variant="dark" size="cta" className="shrink-0"><Link to={appPath(a.id)} aria-label={`Abrir candidatura: ${a.title}${a.company ? `, ${a.company}` : ""}`}>Abrir candidatura <ArrowRightIcon aria-hidden /></Link></Button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}

function Welcome() {
  const steps = [
    { icon: FileTextIcon, title: "Cargá el puesto y tu CV", body: "Subí un PDF o Word, pegá el texto o un link. Lo convertimos a Markdown para que lo revises." },
    { icon: SparklesIcon, title: "La IA arma la entrevista", body: "Requisitos del puesto, qué te falta según tu CV y un banco de preguntas en español e inglés." },
    { icon: BriefcaseIcon, title: "Practicá y mirá tus resultados", body: "Por pregunta, simulacro completo o videollamada. Todo queda dentro de la postulación." },
  ]
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 py-10 text-center">
      <Illustration name="job-hunt" eager className="max-w-64" />
      <div>
        <h1 className="text-[2rem] font-extrabold leading-[1.1] tracking-[-0.05em] sm:text-[2.5rem]">Prepará tu próxima entrevista</h1>
        <p className="mt-2 text-lg text-muted-foreground">Empezá cargando el puesto al que te postulás y el CV que mandaste.</p>
      </div>
      <ol className="grid w-full gap-4 text-left md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={i} className="rounded-[20px] border bg-card p-5">
            <s.icon className="size-5 text-primary" aria-hidden />
            <div className="mt-2 font-medium">{i + 1}. {s.title}</div>
            <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>
      <Button asChild size="lg" className="h-12 px-8 text-base"><Link to="/postulaciones/nueva"><PlusIcon /> Crear mi primera postulación</Link></Button>
    </div>
  )
}
