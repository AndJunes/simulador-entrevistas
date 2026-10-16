import { useQuery } from "@tanstack/react-query"
import { useParams } from "react-router"
import { api } from "./api"

/** La postulación activa sale de la URL (/p/:appId/...). */
export function useAppId(): string {
  const { appId = "" } = useParams()
  return appId
}

/** Contexto de la postulación activa: preguntas, empresa, candidato, entrevista.
 *  view="mock": el simulacro pide la vista SIN pistas ni evidencia esperada (ni siquiera llegan al navegador). */
export function useAppContext(view: "coach" | "mock" = "coach") {
  const appId = useAppId()
  return useQuery({ queryKey: ["app", appId, "context", view], queryFn: () => api.appContext(appId, view), enabled: !!appId, staleTime: 60_000 })
}
