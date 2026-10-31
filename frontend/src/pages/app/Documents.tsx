import { Illustration } from "@/components/illustration"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { BriefcaseIcon, FileUserIcon, SaveIcon, SparklesIcon, Trash2Icon } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { toast } from "sonner"
import { MarkdownEditor, SourceInput, type DocValue } from "@/components/SourceInput"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { api, type Application } from "@/lib/api"
import { useAppId } from "@/lib/app"

/** The application's CV and job: view as Markdown, edit, or reload. */
export default function Documents() {
  const appId = useAppId()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const app = useQuery({ queryKey: ["app", appId], queryFn: () => api.application(appId) })
  const [draft, setDraft] = useState<Pick<Application, "title" | "company" | "cv_md" | "job_md" | "cv_source" | "job_source"> | null>(null)
  const [reload, setReload] = useState<{ kind: "cv" | "job"; value: DocValue | null } | null>(null)
  const [changedDocs, setChangedDocs] = useState(false)

  useEffect(() => {
    if (app.data && !draft) {
      const { title, company, cv_md, job_md, cv_source, job_source } = app.data
      setDraft({ title, company, cv_md, job_md, cv_source, job_source })
    }
  }, [app.data, draft])

  if (!app.data || !draft) return <Skeleton className="h-64 w-full" />
  const a = app.data
  const dirty = draft.title !== a.title || draft.company !== a.company || draft.cv_md !== a.cv_md || draft.job_md !== a.job_md

  async function save() {
    try {
      await api.patchApplication(appId, draft!)
      setChangedDocs(draft!.cv_md !== a.cv_md || draft!.job_md !== a.job_md || changedDocs)
      qc.invalidateQueries({ queryKey: ["app", appId] })
      qc.invalidateQueries({ queryKey: ["applications"] })
      toast.success("Cambios guardados")
    } catch (e) { toast.error((e as Error).message) }
  }

  const docCard = (kind: "job" | "cv") => {
    const isJob = kind === "job"
    const md = isJob ? draft.job_md : draft.cv_md
    const src = isJob ? draft.job_source : draft.cv_source
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">{isJob ? <BriefcaseIcon className="size-5 text-primary" /> : <FileUserIcon className="size-5 text-primary" />} {isJob ? "El puesto" : "Tu CV"}</CardTitle>
          <CardDescription>{isJob ? "Lo que la IA usa para armar requisitos y preguntas." : "Las respuestas modelo solo usan lo que diga acá."}</CardDescription>
        </CardHeader>
        <CardContent>
          {reload?.kind === kind ? (
            <div className="flex flex-col gap-2">
              <Illustration name="online-cv" className="mx-auto max-w-32" />
              <SourceInput kind={kind} value={reload.value} onChange={(v) => {
                if (v) { setDraft({ ...draft, ...(isJob ? { job_md: v.markdown, job_source: v.source } : { cv_md: v.markdown, cv_source: v.source }) }); setReload(null) }
                else setReload({ kind, value: null })
              }} />
              <Button variant="ghost" size="sm" className="w-fit" onClick={() => setReload(null)}>Cancelar</Button>
            </div>
          ) : (
            <MarkdownEditor value={md} source={src} resetLabel="Volver a cargar" onReset={() => setReload({ kind, value: null })}
              onChange={(v) => setDraft({ ...draft, ...(isJob ? { job_md: v } : { cv_md: v }) })} />
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1"><Label htmlFor="title" className="text-xs text-muted-foreground">Puesto</Label>
          <Input id="title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="w-80" /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="company" className="text-xs text-muted-foreground">Empresa</Label>
          <Input id="company" value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} className="w-56" /></div>
        <Button onClick={save} disabled={!dirty}><SaveIcon /> {dirty ? "Guardar cambios" : "Guardado"}</Button>
      </div>

      {changedDocs && !dirty && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-accent/60 p-3 text-sm" role="status">
          <span>Cambiaste el CV o el puesto. ¿Querés que la IA vuelva a armar los requisitos y las preguntas?</span>
          <Button size="sm" onClick={async () => { await api.regenerate(appId); setChangedDocs(false); qc.invalidateQueries({ queryKey: ["app", appId] }) }}><SparklesIcon /> Regenerar</Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">{docCard("job")}{docCard("cv")}</div>

      <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 p-4">
        <div>
          <div className="font-medium">Borrar esta postulación</div>
          <p className="text-sm text-muted-foreground">Se borran el CV, el puesto, las preguntas y todos sus resultados. No se puede deshacer.</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="outline"><Trash2Icon /> Borrar postulación</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Borrar "{a.title}"?</AlertDialogTitle>
              <AlertDialogDescription>Se borran definitivamente el CV, el puesto, las preguntas y todas las prácticas y resultados de esta postulación.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={async () => { await api.deleteApplication(appId); qc.invalidateQueries({ queryKey: ["applications"] }); navigate("/") }}>Borrar definitivamente</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  )
}
