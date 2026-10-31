import { useQuery } from "@tanstack/react-query"
import { useParams } from "react-router"
import { api } from "./api"

/** The active application comes from the URL (/p/:appId/...). */
export function useAppId(): string {
  const { appId = "" } = useParams()
  return appId
}

/** Context of the active application: questions, company, candidate, interview.
 *  view="mock": the mock requests the view WITHOUT hints or expected evidence (they never even reach the browser). */
export function useAppContext(view: "coach" | "mock" = "coach") {
  const appId = useAppId()
  return useQuery({ queryKey: ["app", appId, "context", view], queryFn: () => api.appContext(appId, view), enabled: !!appId, staleTime: 60_000 })
}
