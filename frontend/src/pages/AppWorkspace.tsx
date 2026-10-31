import { EmptyState } from "@/components/illustration"
import { PageHeader } from "@/components/page"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { BarChart3Icon, Building2Icon, ChevronRightIcon, FileTextIcon, HouseIcon, ListChecksIcon, LoaderCircleIcon, PlayIcon } from "lucide-react"
import { useEffect, useRef } from "react"
import { Link, NavLink, Outlet, useLocation } from "react-router"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api, appPath } from "@/lib/api"
import { useAppId } from "@/lib/app"
import { cn } from "@/lib/utils"

// Main navigation: 6 areas in the sidebar (Tu espacio)
const NAV = [
  { to: "", label: "Resumen", icon: HouseIcon, end: true },
  { to: "practicar", label: "Practicar", icon: PlayIcon, also: ["practica", "simulacro", "ejercicio", "preguntas"] },
  { to: "resultados", label: "Progreso y resultados", icon: BarChart3Icon, also: ["informe", "sesion"] },
  { to: "requisitos", label: "Requisitos del puesto", icon: ListChecksIcon },
  { to: "empresa", label: "Empresa y puesto", icon: Building2Icon },
  { to: "evidencia", label: "CV y evidencia", icon: FileTextIcon },
]
// Secondary tools, outside the main flow. The question bank lives inside Practicar.
const UTIL = [{ to: "documentos", label: "Editar CV y aviso" }, { to: "calidad", label: "Avanzado · Calidad del sistema" }]
const SECTION: Record<string, string> = { "": "Resumen", practicar: "Practicar", practica: "Práctica", simulacro: "Simulacro",
  ejercicio: "Ejercicio", preguntas: "Banco de preguntas", resultados: "Progreso y resultados", informe: "Informe", sesion: "Sesión",
  requisitos: "Requisitos del puesto", evidencia: "CV y evidencia", empresa: "Empresa y puesto", documentos: "CV y aviso", calidad: "Calidad" }

// Header for the utility sections (the main ones build their own with their actions)
const HEAD: Record<string, { eyebrow: string; title: string; intro: string }> = {
  preguntas: { eyebrow: "Practicar", title: "Banco de preguntas.", intro: "Revisá, editá o aprobá las preguntas de cada etapa antes de practicarlas." },
  documentos: { eyebrow: "Tus documentos", title: "CV y aviso.", intro: "El texto del que sale todo el análisis. Si lo cambiás, regenerá las preguntas." },
  calidad: { eyebrow: "Avanzado", title: "Calidad del sistema.", intro: "No mide tu desempeño: mide si las preguntas, las repreguntas y las devoluciones de esta postulación son buenas." },
}

/** An application's folder: sidebar + content. */
export default function AppWorkspace() {
  const appId = useAppId()
  const { pathname } = useLocation()
  const qc = useQueryClient()
  const app = useQuery({ queryKey: ["app", appId], queryFn: () => api.application(appId),
    refetchInterval: (q) => (q.state.data?.status === "generating" ? 2500 : false) })
  const immersive = pathname.endsWith("/videollamada")
  const inSession = /\/(practica|simulacro|ejercicio)$/.test(pathname)
  const firstRender = useRef(true)

  // when generation finishes, refresh the context (new questions)
  useEffect(() => {
    if (app.data?.status === "ready") qc.invalidateQueries({ queryKey: ["app", appId, "context"] })
  }, [app.data?.status, app.data?.updated_at, appId, qc])

  // Route change: document title and focus on the section's h1 (not in sessions: there it goes to the main control)
  const sub = pathname.replace(appPath(appId), "").replace(/^\//, "").split("/")[0]
  useEffect(() => {
    if (!app.data) return
    document.title = `${SECTION[sub] ?? "Postulación"} · ${app.data.title}${app.data.company ? ` · ${app.data.company}` : ""}`
    if (firstRender.current) { firstRender.current = false; return }
    if (inSession || immersive) return
    let tries = 0
    const t = setInterval(() => {   // sections lazy-load: wait until the h1 exists
      const h = document.querySelector<HTMLElement>("#main h1")
      if (h || ++tries > 30) { clearInterval(t); h?.focus({ preventScroll: true }); window.scrollTo({ top: 0 }) }
    }, 50)
    return () => clearInterval(t)
  }, [sub, app.data, inSession, immersive])

  if (immersive) return <Outlet />
  if (app.isLoading) return <Skeleton className="m-6 h-64" />
  if (!app.data) {
    return <div className="p-6"><EmptyState name="hire" title="No encontramos esta postulación" action={<Link className="underline" to="/">Volver a tus postulaciones</Link>} /></div>
  }
  const a = app.data
  const head = HEAD[sub]

  const crumb = (
    <nav aria-label="Ruta" className="mb-[15px] text-caption text-muted-foreground min-[561px]:mb-5">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <li><Link to="/" className="hover:text-foreground hover:underline">Postulaciones</Link></li>
        <li aria-hidden><ChevronRightIcon className="size-3.5" /></li>
        {sub === "" ? <li aria-current="page" className="font-bold text-foreground">{a.title}{a.company && ` · ${a.company}`}</li> : (
          <>
            <li><Link to={appPath(appId)} className="hover:text-foreground hover:underline">{a.title}{a.company && ` · ${a.company}`}</Link></li>
            <li aria-hidden><ChevronRightIcon className="size-3.5" /></li>
            <li aria-current="page" className="font-bold text-foreground">{SECTION[sub] ?? "Sección"}</li>
          </>
        )}
      </ol>
    </nav>
  )
  const status = (
    <>
      {a.status === "generating" && (
        <p className="mb-5 flex items-center gap-2 rounded-[14px] bg-mint p-3 text-label text-teal-dark" role="status"><LoaderCircleIcon className="size-4 motion-safe:animate-spin" /> Generando la entrevista de esta postulación: análisis del puesto, evidencia del CV, preguntas y validación (~2–3 min)</p>
      )}
      {a.status === "error" && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-[14px] border p-3 text-label" role="alert">
          <span>No pudimos generar las preguntas.</span>
          <Button size="sm" onClick={async () => { await api.regenerate(appId); qc.invalidateQueries({ queryKey: ["app", appId] }) }}>Reintentar</Button>
        </div>
      )}
    </>
  )

  // Sessions: full screen, no sidebar (focus on answering)
  if (inSession) return <div className="px-4 py-3 lg:px-6">{crumb}{status}<Outlet /></div>

  return (
    <div className="mx-auto max-w-[1600px] min-[851px]:grid min-[851px]:min-h-[calc(100svh-var(--spacing-topbar))] min-[851px]:grid-cols-[205px_minmax(0,1fr)] min-[1151px]:grid-cols-[var(--spacing-sidebar)_minmax(0,1fr)]">
      <aside className="sticky top-[62px] z-10 overflow-x-auto border-b bg-background/95 px-3 py-2 backdrop-blur-md min-[561px]:top-topbar min-[851px]:h-[calc(100svh-var(--spacing-topbar))] min-[851px]:overflow-y-auto min-[851px]:border-b-0 min-[851px]:border-r min-[851px]:bg-transparent min-[851px]:pb-8 min-[851px]:pl-3 min-[851px]:pr-2.5 min-[851px]:pt-[26px] min-[851px]:backdrop-blur-none min-[1151px]:pl-[22px] min-[1151px]:pr-4">
        <p className="mb-2.5 mt-2 hidden px-3 text-caption font-extrabold uppercase tracking-[0.16em] text-muted-foreground min-[851px]:block">Tu espacio</p>
        <nav aria-label="Secciones de la postulación">
          <ul className="flex min-w-max gap-1 min-[851px]:grid min-[851px]:min-w-0 min-[851px]:gap-[5px]">
            {NAV.map((t) => {
              const active = t.end ? sub === "" : sub === t.to || (t.also ?? []).includes(sub)
              return (
                <li key={t.label}>
                  <NavLink to={appPath(appId, t.to)} end={t.end} viewTransition aria-current={active ? "page" : undefined}
                    className={cn("flex min-h-10 items-center gap-3 whitespace-nowrap rounded-xl px-[11px] text-[13px] transition-colors duration-[var(--dur-fast)] min-[851px]:min-h-11 min-[851px]:px-3 min-[851px]:whitespace-normal",
                      active ? "bg-mint font-extrabold text-teal-dark" : "font-semibold text-muted-foreground hover:bg-soft hover:text-foreground")}>
                    <t.icon className="size-[18px] shrink-0" aria-hidden /> {t.label}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="mx-1 mt-7 hidden rounded-2xl border bg-soft p-[15px] text-caption text-muted-foreground min-[851px]:block">
          <p className="mb-1 text-label font-bold text-foreground">Un paso a la vez</p>
          <p>Practicá una respuesta, revisá la evidencia y seguí con el próximo objetivo.</p>
        </div>
        <ul className="mt-6 hidden flex-col gap-2 px-3 text-caption min-[851px]:flex" aria-label="Herramientas">
          {UTIL.map((u) => (
            <li key={u.to}><NavLink to={appPath(appId, u.to)} viewTransition aria-current={sub === u.to ? "page" : undefined}
              className={({ isActive }) => cn("underline-offset-4 hover:underline", isActive ? "font-semibold text-foreground underline" : "text-muted-foreground")}>{u.label}</NavLink></li>
          ))}
        </ul>
      </aside>

      <div className="mx-auto w-full min-w-0 max-w-content px-3.5 pb-10 pt-[21px] min-[561px]:px-5 min-[561px]:pb-[50px] min-[561px]:pt-[25px] min-[851px]:px-[clamp(20px,3.4vw,52px)] min-[851px]:pb-16 min-[851px]:pt-[34px]">
        {crumb}
        {status}
        {head && <PageHeader eyebrow={head.eyebrow} title={head.title} intro={head.intro} />}
        <Outlet />
        <ul className="mt-10 flex flex-wrap gap-x-4 gap-y-2 border-t pt-4 text-caption min-[851px]:hidden" aria-label="Herramientas">
          {UTIL.map((u) => <li key={u.to}><Link to={appPath(appId, u.to)} className="text-muted-foreground underline underline-offset-4">{u.label}</Link></li>)}
        </ul>
      </div>
    </div>
  )
}
