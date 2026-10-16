import { useQuery } from "@tanstack/react-query"
import { MessageCircleQuestionIcon, QuoteIcon } from "lucide-react"
import { Link } from "react-router"
import { EmptyState } from "@/components/illustration"
import { PageHeader, Panel, SectionHead, Tag } from "@/components/page"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api, appPath } from "@/lib/api"
import { useAppId } from "@/lib/app"

const CONF_ORDER = { alta: 0, media: 1, baja: 2 } as const
const CONF_TONE = { alta: "mint", media: "warn", baja: "soft" } as const

/**
 * Empresa y puesto: lo que sabemos (con su fuente) y lo que falta confirmar (preguntas para el reclutador).
 * La única fuente es el aviso que cargaste: no se agrega conocimiento externo. La confianza la estima la IA al leer
 * el aviso, así que se rotula como estimación, no como hecho.
 */
export default function Company() {
  const appId = useAppId()
  const app = useQuery({ queryKey: ["app", appId], queryFn: () => api.application(appId) })
  if (app.isError) return <p role="alert" className="rounded-card border p-5">No pudimos cargar los datos de la empresa. Revisá que el backend esté corriendo y recargá.</p>
  if (!app.data) return <Skeleton className="h-64 w-full" />
  const a = app.data
  const iv = a.interview || {}
  const facts = [["Cuándo", iv.when], ["Formato", iv.type], ["Con quién", iv.with], ["Qué evalúa", iv.evaluates], ["Idioma", iv.language]].filter(([, v]) => v)
  const known = [...(a.company_facts ?? [])].sort((x, y) => CONF_ORDER[x.confidence] - CONF_ORDER[y.confidence])
  const doubts = a.analysis?.ambiguities ?? []
  const source = a.job_source?.kind === "url" ? "Fuente: aviso (link cargado)" : a.job_source?.name ? `Fuente: aviso (${a.job_source.name})` : "Fuente: aviso cargado"

  return (
    <div>
      <PageHeader eyebrow="Contexto" title="Empresa y puesto."
        intro="Separá lo que dice la fuente, lo que inferimos y lo que todavía necesitás confirmar en una entrevista." />

      {facts.length > 0 && (
        <Panel aria-labelledby="iv-h" className="mb-[15px]">
          <SectionHead id="iv-h" title="La entrevista" sub="Lo que el aviso dice sobre el proceso." />
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {facts.map(([k, v]) => <div key={k}><dt className="text-caption text-muted-foreground">{k}</dt><dd className="text-label">{String(v).replace(/\*\*/g, "")}</dd></div>)}
          </dl>
        </Panel>
      )}

      <div className="grid gap-[15px] min-[851px]:grid-cols-2">
        <Panel aria-labelledby="known-h">
          <SectionHead id="known-h" title="Lo que sabemos" sub="Solo afirmaciones del texto que cargaste, cada una con su cita." />
          {known.length ? (
            <ul>
              {known.map((f, i) => (
                <li key={i} className="border-b border-border/70 py-3.5 first:pt-0 last:border-0">
                  <strong className="block text-[13px] font-bold">{f.fact}</strong>
                  <p className="my-1 flex gap-1.5 text-caption italic text-muted-foreground"><QuoteIcon className="mt-0.5 size-3.5 shrink-0 not-italic" aria-hidden />{f.source_quote}</p>
                  <span className="flex flex-wrap items-center gap-2 text-caption font-bold text-teal-dark">{source}
                    <Tag tone={CONF_TONE[f.confidence]}>Confianza estimada por la IA: {f.confidence}</Tag></span>
                </li>
              ))}
            </ul>
          ) : <EmptyState name="ai-research-assistant" title="Pendiente de verificar">El aviso no trae datos de la empresa. Podés agregar notas en <Link className="underline" to={appPath(appId, "documentos")}>Editar CV y aviso</Link>.</EmptyState>}
        </Panel>

        <Panel aria-labelledby="ask-h">
          <SectionHead id="ask-h" title="Lo que falta confirmar" sub="Datos que el aviso no aclara o que se contradicen: preguntáselos al reclutador." />
          {doubts.length ? (
            <ul>
              {doubts.map((d, i) => (
                <li key={i} className="flex gap-2.5 border-b border-border/70 py-3.5 text-[13px] first:pt-0 last:border-0">
                  <MessageCircleQuestionIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />{d}
                </li>
              ))}
            </ul>
          ) : <p className="text-label text-muted-foreground">El análisis no encontró datos pendientes de confirmar.</p>}
        </Panel>
      </div>
      <div className="mt-7 flex flex-wrap gap-2">
        <Button asChild variant="soft" size="cta"><Link to={appPath(appId, "requisitos")}>Ver requisitos del puesto →</Link></Button>
        <Button asChild variant="soft" size="cta"><Link to={appPath(appId, "documentos")}>Ver el aviso completo</Link></Button>
      </div>
    </div>
  )
}
