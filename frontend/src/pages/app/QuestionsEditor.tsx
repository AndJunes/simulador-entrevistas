import { EmptyState } from "@/components/illustration"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangleIcon, ArrowDownIcon, ArrowRightIcon, ArrowUpIcon, ChevronDownIcon, EyeOffIcon, PlusIcon, SaveIcon, SparklesIcon, Trash2Icon } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { toast } from "sonner"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { api, appPath, type ExerciseSpec, PRIORITY_LABEL, type Priority, type QFormat, type Question, type Stage } from "@/lib/api"
import { useAppId } from "@/lib/app"
import { cn } from "@/lib/utils"

const STAGES: { id: Stage; label: string; hint: string }[] = [
  { id: "recruiter_screen", label: "Recruiter screen", hint: "Trayectoria, motivación, experiencia y logística (al final)." },
  { id: "technical_screen", label: "Entrevista técnica", hint: "Una competencia técnica por pregunta, con situaciones de trabajo." },
  { id: "behavioral_client", label: "Conductual y cliente", hint: "Historias reales: entrega, bugs, decisiones, ambigüedad, comunicación." },
  { id: "work_sample", label: "Ejercicio práctico", hint: "Tareas escritas con consigna y criterios visibles." },
]
const FORMATS: { id: QFormat; label: string }[] = [
  { id: "biographical", label: "Trayectoria" }, { id: "motivation", label: "Motivación" }, { id: "behavioral", label: "Conductual (STAR)" },
  { id: "situational", label: "Situacional" }, { id: "technical_knowledge", label: "Conocimiento técnico" }, { id: "debugging", label: "Debugging" },
  { id: "design", label: "Diseño" }, { id: "exercise", label: "Ejercicio" }, { id: "logistics", label: "Logística (no puntúa)" },
]
const DEFAULT_FORMAT: Record<Stage, QFormat> = { recruiter_screen: "motivation", technical_screen: "technical_knowledge", behavioral_client: "behavioral", work_sample: "exercise" }
const blankEx = (): ExerciseSpec => ({ brief: "", deliverable: "", criteria: [], constraints: [], reference_facts: [], minutes: 30 })

const blankQ = (stage: Stage): Question => ({
  id: "", stage, format: DEFAULT_FORMAT[stage], type: stage === "work_sample" ? "exercise" : "screening", text_es: "", text_en: "",
  primary_competency: "", competency_label: "", priority: "important", difficulty: "intermediate", evidence_mode: "past_behavior",
  duration: stage === "work_sample" ? [900, 2700] : [60, 120], pitch: false, followup: stage !== "work_sample", guidance: "", objective: "",
  expected_evidence: [], weak_indicators: [], hints: { structure: "", cv_examples: [], watch_out: "" },
  followup_policy: { triggers: [], max_followups: stage === "work_sample" ? 0 : 2, skip_if_covered: true }, approved: false,
  exercise: stage === "work_sample" ? blankEx() : null,
})

const lines = (xs?: string[]) => (xs ?? []).join("\n")
const toLines = (s: string) => s.split("\n")

/** Banco de preguntas de la postulación: la IA lo arma por etapa y competencia, vos lo revisás y lo editás. */
export default function QuestionsEditor() {
  const appId = useAppId()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const isNew = params.get("nueva") === "1"
  const app = useQuery({ queryKey: ["app", appId], queryFn: () => api.application(appId) })
  const [items, setItems] = useState<Question[] | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (app.data && (!items || !dirty)) setItems(app.data.questions)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.data])

  if (!items || !app.data) return <Skeleton className="h-64 w-full" />
  const legacy = app.data.generator_version !== "v2"

  const update = (i: number, patch: Partial<Question>) => { setItems(items.map((q, j) => (j === i ? { ...q, ...patch } : q))); setDirty(true) }
  const move = (i: number, d: -1 | 1) => {   // mueve dentro de la misma etapa
    const j = d < 0 ? items.findLastIndex((x, k) => k < i && x.stage === items[i].stage) : items.findIndex((x, k) => k > i && x.stage === items[i].stage)
    if (j < 0) return
    const n = [...items]; [n[i], n[j]] = [n[j], n[i]]; setItems(n); setDirty(true)
  }
  const remove = (i: number) => { setItems(items.filter((_, j) => j !== i)); setDirty(true) }
  const add = (stage: Stage) => {
    const last = items.findLastIndex((x) => x.stage === stage)
    const n = [...items]; n.splice(last + 1, 0, blankQ(stage)); setItems(n); setDirty(true)
  }

  async function save() {
    setSaving(true)
    try {
      const a = await api.patchApplication(appId, { questions: items! })
      setItems(a.questions)
      setDirty(false)
      qc.invalidateQueries({ queryKey: ["app", appId] })
      toast.success("Preguntas guardadas")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function regenerate() {
    await api.regenerate(appId)
    setDirty(false)
    setItems(null)
    qc.invalidateQueries({ queryKey: ["app", appId] })
  }

  const approved = items.filter((q) => q.approved).length
  const withIssues = items.filter((q) => q.validation?.issues.length).length
  const stages = STAGES.filter((s) => items.some((q) => q.stage === s.id) || !legacy)

  return (
    <div className="flex flex-col gap-5">
      {isNew && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/40 bg-accent/40 p-4">
          <div>
            <div className="font-medium">Paso 3 · Revisá las preguntas</div>
            <p className="text-sm text-muted-foreground">La IA armó {items.length} preguntas por etapa y competencia, y las validó. Marcá como aprobadas las que te sirven, cambiá lo que quieras y guardá.</p>
          </div>
          <Button asChild size="lg" disabled={dirty}><Link to={appPath(appId, "practicar")}>Empezar a practicar <ArrowRightIcon /></Link></Button>
        </div>
      )}
      {legacy && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4" role="note">
          <div>
            <div className="font-medium">Formato anterior</div>
            <p className="text-sm text-muted-foreground">Estas preguntas se generaron antes de las etapas y competencias. Al actualizar, la IA analiza el puesto y tu CV por partes, arma las cuatro etapas y valida cada pregunta. Tus resultados no se borran.</p>
          </div>
          <RegenerateButton onConfirm={regenerate} label="Actualizar al formato nuevo" />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Preguntas ({items.length})</h2>
          <p className="text-sm text-muted-foreground">
            {approved} aprobadas{withIssues ? ` · ${withIssues} con avisos del validador` : ""}. El orden dentro de cada etapa es el del simulacro.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!legacy && <RegenerateButton onConfirm={regenerate} label="Regenerar con IA" />}
          <Button onClick={save} disabled={!dirty || saving}><SaveIcon /> {saving ? "Guardando…" : dirty ? "Guardar cambios" : "Guardado"}</Button>
        </div>
      </div>

      {stages.map((st) => {
        const idx = items.map((q, i) => [q, i] as const).filter(([q]) => q.stage === st.id)
        return (
          <section key={st.id} aria-labelledby={`st-${st.id}`} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-2">
              <div>
                <h3 id={`st-${st.id}`} className="font-semibold">{st.label} <span className="font-normal text-muted-foreground">· {idx.length}</span></h3>
                <p className="text-xs text-muted-foreground">{st.hint}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => add(st.id)}><PlusIcon /> Agregar</Button>
            </div>
            <ol className="flex flex-col gap-3">
              {idx.map(([q, i]) => <QuestionCard key={`${q.id}-${i}`} q={q} first={idx[0][1] === i} last={idx[idx.length - 1][1] === i}
                onChange={(p) => update(i, p)} onMove={(d) => move(i, d)} onRemove={() => remove(i)} />)}
              {!idx.length && <li><EmptyState name={st.id === "work_sample" ? "online-test" : "questions"} title="Sin preguntas en esta etapa" action={<Button variant="outline" size="sm" onClick={() => add(st.id)}><PlusIcon /> Agregar una</Button>} /></li>}
            </ol>
          </section>
        )
      })}
    </div>
  )
}

function RegenerateButton({ onConfirm, label }: { onConfirm: () => void; label: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant="outline"><SparklesIcon /> {label}</Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Regenerar las preguntas?</AlertDialogTitle>
          <AlertDialogDescription>La IA vuelve a leer el puesto y tu CV (~2–3 min, unos US$0,60) y reemplaza esta lista, incluidos tus cambios. Tus resultados anteriores no se borran.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={onConfirm}>Regenerar</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function QuestionCard({ q, first, last, onChange, onMove, onRemove }: {
  q: Question; first: boolean; last: boolean; onChange: (p: Partial<Question>) => void; onMove: (d: -1 | 1) => void; onRemove: () => void
}) {
  const issues = q.validation?.issues ?? []
  const isEx = q.format === "exercise"
  const pol = q.followup_policy ?? { triggers: [], max_followups: 0, skip_if_covered: true }
  const ex = q.exercise ?? blankEx()
  const sel = "h-8 rounded-md border bg-background px-2 text-sm"
  return (
    <li className={cn("rounded-[20px] border bg-card p-4", q.approved && "border-primary/40")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-mono">{q.id || "nueva"}</Badge>
          <select value={q.format} onChange={(e) => onChange({ format: e.target.value as QFormat, exercise: e.target.value === "exercise" ? q.exercise ?? blankEx() : q.exercise })} aria-label="Formato" className={sel}>
            {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
          <select value={q.stage} onChange={(e) => onChange({ stage: e.target.value as Stage })} aria-label="Etapa" className={sel}>
            {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <select value={q.priority} onChange={(e) => onChange({ priority: e.target.value as Priority })} aria-label="Prioridad" className={sel}>
            {(["must_have", "important", "nice_to_have"] as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
          </select>
          {issues.length > 0 && (
            <Badge variant="outline" className="gap-1 border-amber-500/60"><AlertTriangleIcon className="size-3" /> {issues.length} aviso{issues.length > 1 ? "s" : ""}</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <label className="mr-2 flex items-center gap-1.5 text-sm"><Switch checked={!!q.approved} onCheckedChange={(v) => onChange({ approved: v })} aria-label="Aprobada" /> Aprobada</label>
          <Button variant="ghost" size="icon-sm" onClick={() => onMove(-1)} disabled={first} aria-label="Subir"><ArrowUpIcon /></Button>
          <Button variant="ghost" size="icon-sm" onClick={() => onMove(1)} disabled={last} aria-label="Bajar"><ArrowDownIcon /></Button>
          <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label="Borrar pregunta"><Trash2Icon /></Button>
        </div>
      </div>

      {issues.length > 0 && (
        <ul className="mt-2 flex flex-col gap-0.5 rounded-lg bg-amber-500/5 p-2 text-xs text-muted-foreground" aria-label="Avisos del validador">
          {issues.map((x, k) => <li key={k}>• {x}</li>)}
        </ul>
      )}

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Field id={`es-${q.id}`} label="En español"><Textarea id={`es-${q.id}`} rows={2} value={q.text_es} onChange={(e) => onChange({ text_es: e.target.value })} /></Field>
        <Field id={`en-${q.id}`} label="En inglés"><Textarea id={`en-${q.id}`} rows={2} value={q.text_en} onChange={(e) => onChange({ text_en: e.target.value })} /></Field>
        <Field id={`c-${q.id}`} label="Competencia que evalúa (una)">
          <Input id={`c-${q.id}`} value={q.competency_label} onChange={(e) => onChange({ competency_label: e.target.value })} className="h-8" />
        </Field>
        <div className="flex flex-wrap items-end gap-3 text-sm">
          {!isEx ? (
            <>
              <span className="flex items-center gap-2"><span className="text-muted-foreground">Duración</span>
                <Input type="number" min={10} max={300} value={q.duration[0]} onChange={(e) => onChange({ duration: [Number(e.target.value), q.duration[1]] })} className="h-8 w-18" aria-label="Mínimo en segundos" />
                <span>–</span>
                <Input type="number" min={10} max={300} value={q.duration[1]} onChange={(e) => onChange({ duration: [q.duration[0], Number(e.target.value)] })} className="h-8 w-18" aria-label="Máximo en segundos" />
                <span className="text-muted-foreground">s</span></span>
              <label className="flex items-center gap-2"><span className="text-muted-foreground">Repreguntas máx.</span>
                <select value={pol.max_followups} onChange={(e) => onChange({ followup_policy: { ...pol, max_followups: Number(e.target.value) } })} className={sel}>
                  {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
                </select></label>
            </>
          ) : (
            <label className="flex items-center gap-2"><span className="text-muted-foreground">Minutos</span>
              <Input type="number" min={10} max={90} value={ex.minutes} onChange={(e) => onChange({ exercise: { ...ex, minutes: Number(e.target.value) } })} className="h-8 w-20" /></label>
          )}
        </div>
        <Field id={`o-${q.id}`} label="Objetivo: qué evidencia tiene que obtener" className="md:col-span-2">
          <Textarea id={`o-${q.id}`} rows={2} value={q.objective ?? ""} onChange={(e) => onChange({ objective: e.target.value })} />
        </Field>
      </div>

      {isEx && (
        <div className="mt-3 grid gap-3 rounded-lg border p-3 md:grid-cols-2">
          <Field id={`b-${q.id}`} label="Consigna (la ve la persona)" className="md:col-span-2"><Textarea id={`b-${q.id}`} rows={3} value={ex.brief} onChange={(e) => onChange({ exercise: { ...ex, brief: e.target.value } })} /></Field>
          <Field id={`d-${q.id}`} label="Entregable"><Textarea id={`d-${q.id}`} rows={2} value={ex.deliverable} onChange={(e) => onChange({ exercise: { ...ex, deliverable: e.target.value } })} /></Field>
          <Field id={`cr-${q.id}`} label="Criterios visibles (uno por línea)"><Textarea id={`cr-${q.id}`} rows={3} value={lines(ex.criteria)} onChange={(e) => onChange({ exercise: { ...ex, criteria: toLines(e.target.value) } })} /></Field>
          <Field id={`co-${q.id}`} label="Restricciones (una por línea)"><Textarea id={`co-${q.id}`} rows={2} value={lines(ex.constraints)} onChange={(e) => onChange({ exercise: { ...ex, constraints: toLines(e.target.value) } })} /></Field>
          <Field id={`rf-${q.id}`} label="Datos que el entrevistador puede dar si preguntan (privado)"><Textarea id={`rf-${q.id}`} rows={2} value={lines(ex.reference_facts)} onChange={(e) => onChange({ exercise: { ...ex, reference_facts: toLines(e.target.value) } })} /></Field>
        </div>
      )}

      <Collapsible className="mt-3">
        <CollapsibleTrigger className="group flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <EyeOffIcon className="size-4" /> Privado: oculto en el simulacro (evidencia esperada, repreguntas, pistas)
          <ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 grid gap-3 md:grid-cols-2">
          <Field id={`ee-${q.id}`} label="Evidencia esperada (una por línea): contra esto compara el evaluador">
            <Textarea id={`ee-${q.id}`} rows={4} value={lines(q.expected_evidence)} onChange={(e) => onChange({ expected_evidence: toLines(e.target.value) })} />
          </Field>
          <Field id={`wi-${q.id}`} label="Señales de respuesta débil (una por línea)">
            <Textarea id={`wi-${q.id}`} rows={4} value={lines(q.weak_indicators)} onChange={(e) => onChange({ weak_indicators: toLines(e.target.value) })} />
          </Field>
          {!isEx && (
            <Field id={`tr-${q.id}`} label="Repreguntas preparadas: «si falta… | pregunta» (una por línea)" className="md:col-span-2">
              <Textarea id={`tr-${q.id}`} rows={3} value={pol.triggers.map((t) => `${t.if_missing} | ${t.ask}`).join("\n")}
                onChange={(e) => onChange({ followup_policy: { ...pol, triggers: toLines(e.target.value).map((l) => { const [a, ...b] = l.split("|"); return { if_missing: a.trim(), ask: b.join("|").trim() } }) } })} />
            </Field>
          )}
          <Field id={`hs-${q.id}`} label="Pista: cómo estructurar la respuesta (modo coach)">
            <Textarea id={`hs-${q.id}`} rows={2} value={q.hints?.structure ?? ""} onChange={(e) => onChange({ hints: { ...(q.hints ?? { cv_examples: [], watch_out: "" }), structure: e.target.value } })} />
          </Field>
          <Field id={`hc-${q.id}`} label="Pista: historias de tu CV que sirven (una por línea)">
            <Textarea id={`hc-${q.id}`} rows={2} value={lines(q.hints?.cv_examples)} onChange={(e) => onChange({ hints: { ...(q.hints ?? { structure: "", watch_out: "" }), cv_examples: toLines(e.target.value) } })} />
          </Field>
          <Field id={`hw-${q.id}`} label="Pista: cuidado con…" className="md:col-span-2">
            <Input id={`hw-${q.id}`} value={q.hints?.watch_out ?? ""} onChange={(e) => onChange({ hints: { ...(q.hints ?? { structure: "", cv_examples: [] }), watch_out: e.target.value } })} />
          </Field>
          {q.relevance && <p className="text-xs text-muted-foreground md:col-span-2"><span className="font-medium text-foreground">Por qué importa para el puesto: </span>{q.relevance}</p>}
        </CollapsibleContent>
      </Collapsible>
    </li>
  )
}

function Field({ id, label, className, children }: { id: string; label: string; className?: string; children: React.ReactNode }) {
  return <div className={cn("flex flex-col gap-1", className)}><Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>{children}</div>
}
