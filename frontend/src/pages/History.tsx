import { EmptyState } from "@/components/illustration"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api, appPath, type Mode } from "@/lib/api"

const EMPTY: Record<Mode, { title: string; empty: string }> = {
  practice: { title: "Prácticas por pregunta", empty: "Todavía no practicaste preguntas sueltas." },
  mock: { title: "Simulacros", empty: "Todavía no hiciste un simulacro." },
  videocall: { title: "Videollamadas", empty: "Todavía no hiciste una videollamada." },
  exercise: { title: "Ejercicios prácticos", empty: "Todavía no hiciste un ejercicio." },
}
const MODE: Record<string, string> = { practice: "Práctica", mock: "Simulacro", videocall: "Videollamada", exercise: "Ejercicio" }

export default function History({ appId, mode }: { appId: string; mode: Mode }) {
  const q = useQuery({ queryKey: ["sessions", appId, mode], queryFn: () => api.sessions(appId, mode) })
  if (q.isLoading) return <Skeleton className="h-64 w-full" />
  const rows = (q.data ?? []).filter((s) => s.turns > 0)
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">{EMPTY[mode].title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Se guarda el texto, nunca el audio.</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState name="feedback" title={EMPTY[mode].empty} action={<Button asChild><Link to={appPath(appId, "practicar")}>Empezar</Link></Button>} />
      ) : (
        <ul className="flex flex-col divide-y rounded-[20px] border bg-card">
          {rows.map((s) => (
            <li key={s.id}>
              <Link to={appPath(appId, s.has_report ? `informe/${s.id}` : `sesion/${s.id}`)} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring">
                <span className="flex items-center gap-3">
                  <Badge variant="secondary">{MODE[s.mode] ?? s.mode}</Badge>
                  <span>{new Date(s.created_at).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" })}</span>
                </span>
                <span className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>{s.turns} respuesta{s.turns === 1 ? "" : "s"}</span>
                  <Badge variant="outline">{s.lang === "mix" ? "ES→EN" : s.lang === "es" ? "ES" : "EN"}</Badge>
                  {s.has_report && <Badge>Informe</Badge>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
