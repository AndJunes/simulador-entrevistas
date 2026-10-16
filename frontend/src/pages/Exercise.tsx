import { EmptyState, Illustration } from "@/components/illustration"
import { ArrowLeftIcon, ChevronDownIcon, ClockIcon, CodeIcon, LoaderCircleIcon, MessageCircleQuestionIcon, SendIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router"
import { toast } from "sonner"
import { LiveRegion, StageProgress } from "@/components/common"
import { CompetencyCard, EvidencePanel, FeedbackRating, ToFive } from "@/components/review"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { api, appPath, type Clarification, type Evaluation, followStages, type Lang, type Question } from "@/lib/api"
import { fmtTime } from "@/lib/audio"
import { useAppContext, useAppId } from "@/lib/app"
import { readSettings } from "@/lib/settings"
import { cn } from "@/lib/utils"

type Phase = "pick" | "working" | "evaluating" | "feedback"
const MAX_CHARS = 20000

/** Ejercicio práctico (work sample): consigna y criterios visibles, aclaraciones, respuesta escrita. El código no se ejecuta. */
export default function Exercise() {
  const appId = useAppId()
  const ctx = useAppContext()
  const navigate = useNavigate()
  const lang: Lang = readSettings().lang
  const [sid, setSid] = useState<string | null>(null)
  const [q, setQ] = useState<Question | null>(null)
  const [phase, setPhase] = useState<Phase>("pick")
  const [text, setText] = useState("")
  const [clar, setClar] = useState<Clarification[]>([])
  const [ask, setAsk] = useState("")
  const [asking, setAsking] = useState(false)
  const [startedAt, setStartedAt] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [turnId, setTurnId] = useState<string | null>(null)
  const [ev, setEv] = useState<Evaluation | null>(null)
  const [announce, setAnnounce] = useState("")
  const creating = useRef(false)
  const closeSse = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!creating.current) {
      creating.current = true
      api.newExerciseSession(appId, lang).then((r) => setSid(r.session_id)).catch(() => toast.error("No se pudo crear la sesión."))
    }
    return () => closeSse.current?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (phase !== "working") return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [phase])

  if (ctx.isLoading) return <Skeleton className="h-64 w-full" />
  const exercises = (ctx.data?.questions ?? []).filter((x) => x.format === "exercise" && x.exercise)

  // Borrador guardado en este navegador (COGA 4.5.9: evitar perder trabajo). Es comodidad, no dato crítico.
  const draftKey = (qid: string) => `simulador.exercise.${appId}.${qid}`
  useEffect(() => {
    if (!q || phase !== "working") return
    try { localStorage.setItem(draftKey(q.id), text) } catch { /* sin almacenamiento */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  function start(x: Question) {
    let saved = ""
    try { saved = localStorage.getItem(draftKey(x.id)) ?? "" } catch { /* sin almacenamiento */ }
    setQ(x); setText(saved); setClar([]); setEv(null); setTurnId(null)
    setStartedAt(Date.now()); setNow(Date.now()); setPhase("working")
    setAnnounce("Ejercicio abierto. Leé la consigna y los criterios.")
  }

  async function clarify() {
    if (!sid || !q || !ask.trim()) return
    setAsking(true)
    try {
      const c = await api.clarify(sid, q.id, ask.trim())
      setClar((xs) => [...xs, c]); setAsk(""); setAnnounce(`Respuesta del entrevistador: ${c.a}`)
    } catch (e) { toast.error((e as Error).message) }
    setAsking(false)
  }

  async function submit() {
    if (!sid || !q) return
    try {
      const { turn_id } = await api.submitExercise(sid, q.id, text, (Date.now() - startedAt) / 1000)
      setTurnId(turn_id); setPhase("evaluating"); setAnnounce("Evaluando tu ejercicio.")
      try { localStorage.removeItem(draftKey(q.id)) } catch { /* sin almacenamiento */ }
      closeSse.current?.()
      closeSse.current = followStages(`/api/turns/${turn_id}/events`, (e) => {
        if (e.stage === "evaluated") { setEv(e.evaluation); setPhase("feedback"); setAnnounce("Devolución lista.") }
        if (e.stage === "error") { toast.error(e.message); setPhase("working") }
      })
    } catch (e) { toast.error((e as Error).message) }
  }

  // Elegir ejercicio
  if (phase === "pick" || !q) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ejercicio práctico</h1>
          <p className="mt-1 text-muted-foreground">Tareas escritas parecidas al trabajo real. No reproducen un proceso interno de la empresa: están alineadas con el puesto.</p>
        </div>
        {exercises.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {exercises.map((x) => (
              <button key={x.id} onClick={() => start(x)} className="flex flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-ring">
                <span className="flex items-center gap-2"><Badge variant="secondary" className="font-mono">{x.id}</Badge><span className="text-xs text-muted-foreground">{x.competency_label} · {x.exercise!.minutes} min</span></span>
                <span className="line-clamp-3 text-[15px]">{x.exercise!.brief || (lang === "es" ? x.text_es : x.text_en)}</span>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState name="online-test" title="Esta postulación no tiene ejercicios">Se generan para roles técnicos con el formato nuevo (Practicar → Banco de preguntas → Actualizar al formato nuevo).</EmptyState>
        )}
        <Button variant="ghost" className="w-fit" onClick={() => navigate(appPath(appId, "practicar"))}><ArrowLeftIcon /> Cambiar de modo</Button>
      </div>
    )
  }

  const ex = q.exercise!
  const elapsed = (now - startedAt) / 1000
  const over = elapsed > ex.minutes * 60

  return (
    <div className="flex flex-col gap-3">
      <LiveRegion message={announce} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => setPhase("pick")}><ArrowLeftIcon /> Ejercicios</Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary" className="font-mono">{q.id}</Badge>
          <Badge variant="outline">{q.competency_label}</Badge>
          {phase === "working" && <span className={cn("flex items-center gap-1 font-mono tabular-nums", over && "text-amber-600 dark:text-amber-400")} aria-label={`Tiempo ${fmtTime(elapsed)} de ${ex.minutes} minutos`}><ClockIcon className="size-4" /> {fmtTime(elapsed)} / {ex.minutes}:00</span>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
        <aside className="flex flex-col gap-4">
          <Card size="sm">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CodeIcon className="size-4 text-primary" /> Consigna</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm leading-6">
              <p className="whitespace-pre-wrap">{ex.brief}</p>
              {ex.deliverable && <p><span className="font-medium">Entregable: </span>{ex.deliverable}</p>}
              {ex.criteria.length > 0 && <div><div className="font-medium">Se evalúa</div><ul className="mt-1 flex flex-col gap-0.5">{ex.criteria.map((c, i) => <li key={i}>• {c}</li>)}</ul></div>}
              {ex.constraints.length > 0 && <div><div className="font-medium">Restricciones</div><ul className="mt-1 flex flex-col gap-0.5">{ex.constraints.map((c, i) => <li key={i}>• {c}</li>)}</ul></div>}
              <p className="text-xs text-muted-foreground">El código no se ejecuta: se evalúa leyéndolo. Si una alternativa es válida y la justificás, cuenta igual.</p>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><MessageCircleQuestionIcon className="size-4 text-primary" /> Preguntas aclaratorias</CardTitle>
              <CardDescription>Preguntar antes de empezar suma. El entrevistador responde solo con los datos del ejercicio; si algo no está definido, asumilo y anotalo.</CardDescription></CardHeader>
            <CardContent className="flex flex-col gap-3">
              {!clar.length && <Illustration name="chat-bot" className="mx-auto max-w-28" />}
              {clar.map((c, i) => (
                <div key={i} className="flex flex-col gap-1 text-sm">
                  <p className="self-end rounded-lg bg-accent px-3 py-1.5">{c.q}</p>
                  <p className={cn("rounded-lg bg-muted px-3 py-1.5", !c.specified && "border border-dashed")}>{c.a}{!c.specified && <span className="block text-xs text-muted-foreground">No está especificado: anotá tu supuesto.</span>}</p>
                </div>
              ))}
              {phase === "working" && (
                <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); clarify() }}>
                  <Input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder={lang === "es" ? "¿Cuántos documentos por día?" : "How many documents per day?"} aria-label="Tu pregunta aclaratoria" maxLength={500} />
                  <Button type="submit" variant="outline" disabled={asking || !ask.trim()}>{asking ? <LoaderCircleIcon className="motion-safe:animate-spin" /> : "Preguntar"}</Button>
                </form>
              )}
            </CardContent>
          </Card>
        </aside>

        <section aria-label="Tu respuesta" className="flex min-w-0 flex-col gap-3">
          {phase === "working" && (
            <>
              <label htmlFor="answer" className="text-sm font-medium">Tu respuesta <span className="font-normal text-muted-foreground">(código + una explicación breve del enfoque, supuestos y trade-offs)</span></label>
              <textarea id="answer" value={text} onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))} spellCheck={false}
                onKeyDown={(e) => {   // Tab inserta 4 espacios (Esc + Tab sale del editor, para teclado)
                  if (e.key === "Tab" && !e.shiftKey && !e.altKey) {
                    e.preventDefault()
                    const el = e.currentTarget, a = el.selectionStart, b = el.selectionEnd
                    const v = text.slice(0, a) + "    " + text.slice(b)
                    setText(v); requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = a + 4 })
                  }
                  if (e.key === "Escape") e.currentTarget.blur()
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim().length >= 20) { e.preventDefault(); submit() }
                }}
                className="min-h-[55svh] w-full resize-y rounded-xl border bg-card p-4 font-mono text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder={"# Enfoque\n...\n\n# Código\n...\n\n# Tests\n...\n\n# Supuestos y trade-offs\n..."} />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>Tab inserta espacios · <strong>Esc sale del editor</strong> · Ctrl/⌘+Enter envía · borrador guardado · {text.length.toLocaleString("es-AR")}/{MAX_CHARS.toLocaleString("es-AR")}</span>
                <Button size="lg" onClick={submit} disabled={text.trim().length < 20}><SendIcon /> Enviar para evaluar</Button>
              </div>
            </>
          )}
          {phase === "evaluating" && (
            <Card><CardContent className="py-2">
              <Illustration name="detailed-answer" eager className="mx-auto mb-3 max-w-40" />
              <StageProgress stages={[{ key: "evaluating", label: "Leyendo tu respuesta con la rúbrica de ejercicio" }]} current="evaluating" done={[]} etaS={40} />
            </CardContent></Card>
          )}
          {phase === "feedback" && ev && (
            <div className="flex flex-col gap-6">
              <CompetencyCard ev={ev.evaluation} />
              <EvidencePanel ev={ev.evaluation} />
              <ToFive criteria={ev.evaluation.criteria} lang={lang} />
              <Collapsible className="rounded-xl border bg-card">
                <CollapsibleTrigger className="group flex w-full items-center justify-between p-4 text-left font-medium">
                  Una versión 5/5 de referencia <ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="px-4 pb-4">
                  <p className="mb-2 text-xs text-muted-foreground">No es la única solución correcta. Los detalles entre llaves son ejemplos para verificar.</p>
                  <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-sm leading-6">{ev.evaluation.model_answer}</pre>
                </CollapsibleContent>
              </Collapsible>
              <Collapsible className="rounded-xl border bg-card">
                <CollapsibleTrigger className="group flex w-full items-center justify-between p-4 text-left font-medium">
                  Lo que enviaste <ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="px-4 pb-4"><pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-sm leading-6">{text}</pre></CollapsibleContent>
              </Collapsible>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <FeedbackRating key={turnId} turnId={turnId} />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setPhase("working")}>Corregir y reenviar</Button>
                  <Button variant="ghost" onClick={() => setPhase("pick")}>Otro ejercicio</Button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
