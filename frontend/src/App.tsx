import { ArrowUpRightIcon, MonitorIcon, MoonIcon, PlusIcon, SunIcon } from "lucide-react"
import { lazy, Suspense, useState } from "react"
import { readTheme, setTheme, type ThemePref } from "@/lib/theme"
import { Link, Navigate, NavLink, Route, Routes, useLocation } from "react-router"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import AppWorkspace from "./pages/AppWorkspace"
import Applications from "./pages/Applications"
const Documents = lazy(() => import("./pages/app/Documents"))
const Quality = lazy(() => import("./pages/app/Quality"))
const QuestionsEditor = lazy(() => import("./pages/app/QuestionsEditor"))
const Company = lazy(() => import("./pages/app/Company"))
const Requirements = lazy(() => import("./pages/app/Requirements"))
const Results = lazy(() => import("./pages/app/Results"))
import Summary from "./pages/app/Summary"
const Exercise = lazy(() => import("./pages/Exercise"))
const Lobby = lazy(() => import("./pages/Lobby"))
const MockInterview = lazy(() => import("./pages/MockInterview"))
const NewApplication = lazy(() => import("./pages/NewApplication"))
const Practice = lazy(() => import("./pages/Practice"))
const Report = lazy(() => import("./pages/Report"))
const SessionView = lazy(() => import("./pages/SessionView"))

export default function App() {
  const { pathname } = useLocation()
  const immersive = pathname.endsWith("/videollamada")
  const workspace = pathname.startsWith("/p/")   // the application builds its own layout (sidebar + content)

  return (
    <div className="min-h-svh bg-background text-foreground">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-card focus:p-2">
        Saltar al contenido
      </a>
      {!immersive && (
        <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur-md">
          <div className="flex h-[62px] items-center justify-between gap-3 px-3.5 min-[561px]:h-topbar min-[561px]:px-[clamp(18px,4vw,52px)]">
            <NavLink to="/" className="flex items-center gap-[11px] text-[14px] font-extrabold tracking-[-0.045em] min-[561px]:text-[17px]">
              <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><ArrowUpRightIcon className="size-5" aria-hidden /></span>
              <span className="max-[360px]:sr-only">Simulador <span className="font-semibold text-muted-foreground max-[560px]:hidden">de Entrevistas</span></span>
            </NavLink>
            <nav aria-label="Principal" className="flex items-center gap-2.5">
              <NavLink to="/" end className={({ isActive }) => cn("hidden px-3 py-2.5 text-label font-semibold text-muted-foreground hover:text-foreground min-[561px]:block", isActive && "text-foreground")}>Postulaciones</NavLink>
              <ThemeToggle />
              <Button asChild variant="dark" size="cta" className="max-[560px]:px-3">
                <Link to="/postulaciones/nueva"><PlusIcon aria-hidden /> <span>Nueva<span className="max-[560px]:hidden"> postulación</span></span></Link>
              </Button>
            </nav>
          </div>
        </header>
      )}
      <main id="main" className={cn(!immersive && !workspace && "mx-auto max-w-content px-3.5 pb-16 pt-[21px] min-[561px]:px-[clamp(20px,3.4vw,52px)] min-[561px]:pt-[34px]")}>
        <Suspense fallback={<div className="m-6 h-64 animate-pulse rounded-[20px] bg-muted" aria-busy="true" aria-label="Cargando" />}>
        <Routes>
          <Route path="/" element={<Applications />} />
          <Route path="/postulaciones/nueva" element={<NewApplication />} />
          <Route path="/p/:appId" element={<AppWorkspace />}>
            <Route index element={<Summary />} />
            <Route path="practicar" element={<Lobby />} />
            <Route path="practica" element={<Practice />} />
            <Route path="simulacro" element={<MockInterview mode="mock" />} />
            <Route path="videollamada" element={<MockInterview mode="videocall" />} />
            <Route path="ejercicio" element={<Exercise />} />
            <Route path="resultados" element={<Results />} />
            <Route path="informe/:sid" element={<Report />} />
            <Route path="sesion/:sid" element={<SessionView />} />
            <Route path="preguntas" element={<QuestionsEditor />} />
            <Route path="requisitos" element={<Requirements view="req" />} />
            <Route path="requisitos/cobertura" element={<Requirements view="coverage" />} />
            <Route path="evidencia" element={<Requirements view="cv" />} />
            <Route path="empresa" element={<Company />} />
            <Route path="documentos" element={<Documents />} />
            <Route path="calidad" element={<Quality />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </main>
    </div>
  )
}

const THEMES: { v: ThemePref; label: string; icon: typeof SunIcon }[] = [
  { v: "light", label: "Tema claro", icon: SunIcon }, { v: "dark", label: "Tema oscuro", icon: MoonIcon }, { v: "system", label: "Tema del sistema", icon: MonitorIcon },
]

/** Light by default; dark and "match the system" optional. */
function ThemeToggle() {
  const [t, setT] = useState<ThemePref>(readTheme)
  return (
    <div role="group" aria-label="Tema" className="flex rounded-control border border-input p-0.5">
      {THEMES.map(({ v, label, icon: Icon }) => (
        <button key={v} type="button" aria-pressed={t === v} aria-label={label} title={label}
          onClick={() => { setTheme(v); setT(v) }}
          className={cn("grid size-8 place-items-center rounded-[9px]", t === v ? "bg-mint text-teal-dark" : "text-muted-foreground hover:text-foreground")}>
          <Icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  )
}
