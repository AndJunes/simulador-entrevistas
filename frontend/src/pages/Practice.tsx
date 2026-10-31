import { EmptyState, Illustration } from "@/components/illustration"
import { KeyboardIcon } from "lucide-react"
import { ArrowLeftIcon, ChevronDownIcon, HelpCircleIcon, LanguagesIcon, ListIcon, MessageSquareIcon, MicIcon, RotateCcwIcon, SquareIcon, TargetIcon, Trash2Icon, UploadIcon } from "lucide-react"
import { useCallback, useEffect, useReducer, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { toast } from "sonner"
import { LevelMeter, LiveRegion, StageProgress } from "@/components/common"
import { CoachingView, ComparisonView, MetricsPanel } from "@/components/feedback"
import { ImprovementNote, Reveal } from "@/components/motion"
import { WrittenAnswer } from "@/components/written-answer"
import { CallChat, CompetencyCard, EvidencePanel, ExampleText, FeedbackRating, HintsPanel, IdealAnswer, MetricsStrip, ToFive } from "@/components/review"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { api, type Coaching, type Comparison, type Evaluation, type EvaluationBody, followStages, type Lang, type Metrics, qText, type Question, type StageEvent, type Transcript, appPath } from "@/lib/api"
import { chime, fmtTime, playUrl, type Recording, useRecorder } from "@/lib/audio"
import { useMic } from "@/lib/mic"
import { readSettings } from "@/lib/settings"
import { useAppContext, useAppId } from "@/lib/app"
import { cn } from "@/lib/utils"

type Phase = "pick" | "asking" | "ready" | "recording" | "processing" | "feedback" | "coaching" | "error"

interface State {
  phase: Phase
  q: Question | null
  lang: Lang
  turnId: string | null
  stage: string
  doneStages: string[]
  eta?: number
  transcript: Transcript | null
  metrics: Metrics | null
  evaluation: Evaluation | null
  comparison: Comparison | null
  coaching: Coaching | null
  audioUrl: string | null
  error: string | null
  lastEvalTurn: { id: string; qid: string; lang: Lang; modelAnswer: string } | null
  guide: Coaching["coaching"] | null
  reference: { lang: Lang; text: string } | null
  followup: { of: string; text: string } | null   // answering the practice follow-up from the previous feedback
}

type Action =
  | { type: "pick"; q: Question }
  | { type: "phase"; phase: Phase }
  | { type: "submitted"; turnId: string }
  | { type: "event"; e: StageEvent }
  | { type: "switchLang" }
  | { type: "retryWithGuide" }
  | { type: "back" }
  | { type: "followup"; text: string }

const STAGES = [
  { key: "transcribing", label: "Transcribiendo tu respuesta" },
  { key: "measuring", label: "Midiendo cómo sonaste" },
  { key: "evaluating", label: "Evaluando el contenido con la rúbrica" },
  { key: "speaking", label: "Preparando el resumen hablado" },
]
const COACH_STAGES = [
  { key: "transcribing", label: "Escuchando lo que dijiste" },
  { key: "coaching", label: "Armando una guía para destrabarte" },
  { key: "speaking", label: "Preparando el resumen hablado" },
]

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "pick":
      return { ...s, phase: "asking", q: a.q, guide: null, reference: null, followup: null, ...blank }
    case "followup":
      return s.lastEvalTurn ? { ...s, phase: "asking", followup: { of: s.lastEvalTurn.id, text: a.text }, guide: null, ...blank } : s
    case "phase":
      return { ...s, phase: a.phase }
    case "submitted":
      return { ...s, ...blank, phase: "processing", turnId: a.turnId, stage: "transcribing", doneStages: [] }
    case "switchLang": {
      const ref = s.evaluation ? { lang: s.lang, text: s.evaluation.evaluation.model_answer } : s.reference
      return { ...s, lang: s.lang === "es" ? "en" : "es", phase: "asking", reference: ref, guide: null, followup: null, ...blank }
    }
    case "retryWithGuide":
      return { ...s, phase: "asking", guide: s.coaching?.coaching ?? null, ...blank }
    case "back":
      return { ...s, phase: "pick", q: null, followup: null, ...blank }
    case "event": {
      const e = a.e
      switch (e.stage) {
        case "transcribing":
          return { ...s, stage: "transcribing", eta: e.eta_s }
        case "transcribed":
          return { ...s, transcript: e.transcript, metrics: e.metrics, stage: "measuring", doneStages: ["transcribing", "measuring"] }
        case "evaluating":
          return { ...s, stage: "evaluating", eta: e.eta_s, doneStages: ["transcribing", "measuring"] }
        case "coaching_started":
          return { ...s, stage: "coaching", eta: e.eta_s, doneStages: ["transcribing"] }
        case "evaluated":
          return {
            ...s, evaluation: e.evaluation, comparison: e.comparison, phase: "feedback", stage: "speaking",
            doneStages: ["transcribing", "measuring", "evaluating"],
            lastEvalTurn: s.turnId && s.q && !s.followup ? { id: s.turnId, qid: s.q.id, lang: s.lang, modelAnswer: e.evaluation.evaluation.model_answer } : s.lastEvalTurn,
          }
        case "coaching":
          return { ...s, coaching: e.coaching, phase: "coaching", stage: "speaking", doneStages: ["transcribing", "coaching"] }
        case "tts_ready":
          return { ...s, audioUrl: e.audio_url, doneStages: [...s.doneStages, "speaking"] }
        case "error":
          return { ...s, phase: s.evaluation ? s.phase : "error", error: e.message }
        case "cancelled":
          return { ...s, phase: "asking", ...blank }
        default:
          return s
      }
    }
  }
}

const blank = {
  turnId: null, stage: "", doneStages: [] as string[], eta: undefined, transcript: null, metrics: null, evaluation: null,
  comparison: null, coaching: null, audioUrl: null, error: null,
}

export default function Practice() {
  const settings = readSettings()
  const appId = useAppId()
  const ctx = useAppContext()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const mic = useMic()
  const rec = useRecorder(mic.stream)
  const [s, dispatch] = useReducer(reducer, {
    phase: "pick", q: null, lang: (params.get("lang") as Lang) || settings.lang, lastEvalTurn: null, guide: null, reference: null, followup: null, ...blank,
  } as State)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [writing, setWriting] = useState(false)   // written alternative to voice
  const [voiceFailed, setVoiceFailed] = useState(false)
  const [draft, setDraft] = useState("")
  const [announce, setAnnounce] = useState("")
  const questionAudio = useRef<HTMLAudioElement | null>(null)
  const stopRef = useRef<HTMLButtonElement>(null)
  const closeSse = useRef<(() => void) | null>(null)
  const chatScroll = useRef<HTMLDivElement>(null)

  // practice session (one per visit). The ref avoids creating two on StrictMode's double mount.
  const creating = useRef(false)
  useEffect(() => {
    if (!creating.current) {
      creating.current = true
      api.newPracticeSession(appId, s.lang, settings).then((r) => setSessionId(r.session_id)).catch(() => toast.error("No se pudo crear la sesión. ¿Está corriendo el backend?"))
    }
    return () => closeSse.current?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ?q=Q4 from the report ("practice this question"): used once, then cleared from the URL
  useEffect(() => {
    const qid = params.get("q")
    if (qid && ctx.data) {
      const q = ctx.data.questions.find((x) => x.id === qid)
      if (q) dispatch({ type: "pick", q })
      setParams({}, { replace: true })
    }
  }, [ctx.data, params, setParams])

  // on leaving the page, the mic is released
  useEffect(() => () => mic.release(), [mic.release])

  const startRecording = useCallback(async () => {
    if (settings.devFile) { dispatch({ type: "phase", phase: "recording" }); return }
    const st = await mic.request()   // opens only now
    if (!st) { toast.error("No pudimos abrir el micrófono. Volvé al panel para probarlo."); return }
    chime()
    rec.start(st)
    dispatch({ type: "phase", phase: "recording" })
    setAnnounce("Grabando. Respondé y pulsá Terminé cuando acabes.")
    setTimeout(() => stopRef.current?.focus(), 50)
  }, [mic, rec, settings.devFile])

  // "asking" phase: say the question and (when configured) start recording automatically
  useEffect(() => {
    if (s.phase !== "asking" || !s.q) return
    let cancelled = false
    const text = s.followup?.text ?? qText(s.q, s.lang)
    setAnnounce(`Pregunta: ${text}`)
    ;(async () => {
      if (settings.voice) {
        try {
          const { audio_url } = await api.tts(text, s.lang, "interviewer")
          if (cancelled) return
          const { audio, done } = playUrl(audio_url)
          questionAudio.current = audio
          await done
        } catch { setVoiceFailed(true) /* no voice: the text is on screen */ }
      }
      if (cancelled) return
      if (settings.autostart) startRecording()
      else dispatch({ type: "phase", phase: "ready" })
    })()
    return () => { cancelled = true; questionAudio.current?.pause() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase, s.q, s.lang, s.followup])

  async function submit(r: Recording | { blob: Blob; filename: string } | { text: string }, help: boolean) {
    if (!sessionId || !s.q) return
    try {
      const attempt = !s.followup && s.lastEvalTurn && s.lastEvalTurn.qid === s.q.id && s.lastEvalTurn.lang === s.lang ? s.lastEvalTurn.id : null
      const media = "text" in r ? { text: r.text } : { audio: r.blob, filename: r.filename }
      setWriting(false)
      const { turn_id } = await api.submitTurn({ ...media, session_id: sessionId, question_id: s.q.id, lang: s.lang, help_requested: help, attempt_of: attempt,
        followup_of: s.followup?.of ?? null, followup_text: s.followup?.text ?? null })
      dispatch({ type: "submitted", turnId: turn_id })
      setAnnounce("Procesando tu respuesta. Paso 1 de 4: transcribiendo.")
      closeSse.current?.()
      closeSse.current = followStages(`/api/turns/${turn_id}/events`, (e) => {
        dispatch({ type: "event", e })
        if (e.stage === "evaluated") setAnnounce("Feedback listo.")
        if (e.stage === "coaching") setAnnounce("Guía lista para destrabarte.")
        if (e.stage === "error") toast.error(e.message)
      })
    } catch (e) {
      toast.error(`No se pudo enviar la respuesta: ${(e as Error).message}`)
      dispatch({ type: "phase", phase: "asking" })
    }
  }

  async function finish(help = false) {
    const r = await rec.stop()
    mic.release()
    if (r) submit(r, help)
  }

  function discard() {
    rec.discard()
    mic.release()
    dispatch({ type: "phase", phase: settings.autostart ? "asking" : "ready" })
  }

  // the chat auto-scrolls when something new appears (like any chat)
  useEffect(() => {
    const el = chatScroll.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [s.phase, s.transcript, s.evaluation, s.coaching])

  if (ctx.isLoading) return <Skeleton className="h-64 w-full" />
  if (!ctx.data) return <p>No se pudo cargar el contexto.</p>
  const qs = ctx.data.questions
  const target = s.q?.duration ?? [60, 90]

  // Pick a question
  if (s.phase === "pick" || !s.q) {
    const groups: [string, Question[]][] = ctx.data.stages.filter((st) => st.stage !== "work_sample")
      .map((st) => [st.label, qs.filter((q) => q.stage === st.stage && q.format !== "exercise")] as [string, Question[]])
      .filter(([, list]) => list.length)
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Práctica por pregunta" subtitle={`Elegí una pregunta. Idioma: ${s.lang === "es" ? "español" : "inglés"}.`} />
        {!groups.length && <EmptyState name="ai-chat" title="Esta postulación todavía no tiene preguntas para practicar">Generalas desde Practicar → Banco de preguntas.</EmptyState>}
        {groups.map(([title, list]) => (
          <section key={title} aria-labelledby={title}>
            <h2 id={title} className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {list.map((q) => (
                <button
                  key={q.id}
                  onClick={() => dispatch({ type: "pick", q })}
                  className="flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <Badge variant="secondary" className="font-mono">{q.id}</Badge>
                  <span className="flex flex-col gap-1">
                    <span className="text-[15px]">{qText(q, s.lang)}</span>
                    <span className="text-xs text-muted-foreground">{ctx.data!.format_labels[q.format]} · {q.competency_label}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    )
  }

  const q = s.q
  const otherLang = s.lang === "es" ? "inglés" : "español"
  const chatStatus =
    s.phase === "recording" && !settings.devFile ? "recording"
    : s.phase === "processing" && !s.transcript ? "transcribing"
    : s.phase === "processing" ? (s.stage === "coaching" ? "coaching" : "evaluating")
    : null

  return (
    <div className="flex flex-col gap-3">
      <LiveRegion message={announce} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => { rec.discard(); dispatch({ type: "back" }) }}><ArrowLeftIcon /> Preguntas</Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary" className="font-mono">{q.id}</Badge>
          <Badge variant="outline">{ctx.data.format_labels[q.format]}</Badge>
          {s.followup && <Badge>Repregunta</Badge>}
          <Badge variant="outline">{s.lang === "es" ? "Español" : "Inglés"}</Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:h-[calc(100svh-9rem)] lg:grid-cols-[7fr_3fr]">
        {/* 70%: call chat */}
        <section aria-label="Chat de la llamada" className="flex min-h-[70svh] flex-col overflow-hidden rounded-2xl border bg-card/60 lg:min-h-0">
          <header className="flex items-center justify-between gap-2 border-b px-4 py-2.5 text-sm">
            <span className="flex items-center gap-2 font-medium"><MessageSquareIcon className="size-4 text-primary" aria-hidden /> Chat de la llamada</span>
            <span className="text-xs text-muted-foreground">Recruiter · {ctx.data.company || "la empresa"}</span>
          </header>
          <div ref={chatScroll} className="flex-1 overflow-y-auto p-4 lg:p-6">
            <div className="mx-auto max-w-3xl">
              <CallChat
                question={s.followup?.text ?? qText(q, s.lang)}
                transcript={s.transcript}
                metrics={s.metrics}
                evaluation={s.phase === "feedback" ? s.evaluation?.evaluation : null}
                coaching={s.phase === "coaching" ? s.coaching?.coaching : null}
                audioUrl={s.audioUrl}
                autoPlay={settings.voice}
                status={chatStatus}
                live={rec.recording ? { level: rec.level, speaking: rec.speaking, elapsed: rec.elapsed } : null}
                interviewerSpeaking={s.phase === "asking" && settings.voice}
                interviewer={`Recruiter · ${ctx.data.company || "la empresa"}`}
              />
            </div>
          </div>

          {/* bottom bar, like a chat composer: the controls for each moment */}
          <footer className="border-t bg-card p-3">
            {s.phase === "asking" && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-auto text-sm text-muted-foreground" role="status">{settings.voice ? "El entrevistador está preguntando…" : "Leé la pregunta."}</span>
                {settings.voice && <>
                  <Button variant="outline" size="sm" onClick={() => questionAudio.current?.pause()}>Pausar</Button>
                  <Button variant="ghost" size="sm" onClick={() => { if (questionAudio.current) { questionAudio.current.currentTime = 0; questionAudio.current.play() } }}>Repetir</Button>
                </>}
                <Button size="sm" onClick={() => { questionAudio.current?.pause(); settings.autostart ? startRecording() : dispatch({ type: "phase", phase: "ready" }) }}>Responder ya</Button>
              </div>
            )}
            {writing && (s.phase === "ready" || s.phase === "recording" || s.phase === "asking") && (
              <WrittenAnswer value={draft} onChange={setDraft} onSend={() => { if (draft.trim()) { submit({ text: draft.trim() }, false); setDraft("") } }}
                onCancel={() => setWriting(false)} />
            )}
            {s.phase === "ready" && !writing && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="mr-auto text-sm text-muted-foreground">Tomate el tiempo que necesites.</span>
                <Button size="lg" variant="outline" className="h-12" onClick={() => setWriting(true)}><KeyboardIcon /> Responder por escrito</Button>
                <Button size="lg" className="h-12 px-8" onClick={startRecording} autoFocus><MicIcon /> Empezar a responder</Button>
              </div>
            )}
            {s.phase === "recording" && settings.devFile && <FileAnswer onSubmit={(f, help) => submit(f, help)} />}
            {s.phase === "recording" && !settings.devFile && !writing && (
              <div className="flex flex-col gap-2">
                {rec.silenceS > 8 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-accent/60 px-3 py-2 text-sm" role="status">
                    <span>{rec.spoke ? "¿Perdiste el hilo? No pasa nada." : "Tomarse unos segundos para pensar es normal. ¿Te ayudo?"}</span>
                    <Button size="sm" variant="outline" onClick={() => finish(true)}>Sí, ayudame</Button>
                  </div>
                )}
                <DurationBand elapsed={rec.elapsed} target={target} />
                <div className="flex flex-wrap items-center gap-2">
                  <Button ref={stopRef} size="lg" className="h-12 px-8" onClick={() => finish(false)}><SquareIcon /> Terminé</Button>
                  <Button size="lg" variant="outline" className="h-12" onClick={() => finish(true)}><HelpCircleIcon /> Me quedé en blanco</Button>
                  <Button size="lg" variant="ghost" className="h-12" onClick={discard}><Trash2Icon /> Descartar</Button>
                  <Button size="lg" variant="ghost" className="h-12" onClick={() => { rec.discard(); mic.release(); setWriting(true) }}><KeyboardIcon /> Escribir en vez de hablar</Button>
                </div>
              </div>
            )}
            {s.phase === "processing" && (
              <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground" role="status">
                <span>Analizando tu respuesta… mirá el progreso a la derecha.</span>
                <Button variant="ghost" size="sm" onClick={() => s.turnId && api.cancelTurn(s.turnId)}>Cancelar</Button>
              </div>
            )}
            {(s.phase === "feedback" || s.phase === "coaching") && (
              <div className="flex flex-wrap items-center gap-2">
                {s.phase === "coaching" ? (
                  <Button onClick={() => dispatch({ type: "retryWithGuide" })}><RotateCcwIcon /> Reintentar con el esqueleto</Button>
                ) : (
                  <Button onClick={() => dispatch({ type: "phase", phase: "asking" })}><RotateCcwIcon /> Reintentar</Button>
                )}
                <Button variant="outline" onClick={() => dispatch({ type: "switchLang" })}><LanguagesIcon /> La misma en {otherLang}</Button>
                <Button variant="ghost" onClick={() => dispatch({ type: "back" })}><ListIcon /> Otra pregunta</Button>
                <Button variant="ghost" className="ml-auto" onClick={() => navigate(appPath(appId, "practicar"))}>Cambiar de modo</Button>
              </div>
            )}
            {s.phase === "error" && (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="mr-auto">{s.error}</span>
                <Button onClick={() => dispatch({ type: "phase", phase: "asking" })}><RotateCcwIcon /> Intentar de nuevo</Button>
              </div>
            )}
          </footer>
        </section>

        {/* 30%: what's being analyzed and the full answer; the rest, under "Detalles" */}
        <aside aria-label="Análisis" className="flex flex-col gap-4 lg:overflow-y-auto lg:pr-1">
          {(s.phase === "asking" || s.phase === "ready" || s.phase === "recording") && (
            <>
              {voiceFailed && (
                <div className="flex items-center gap-3 rounded-xl border p-3 text-label text-muted-foreground">
                  <Illustration name="ai-voice-interface" className="w-14 max-w-14" />
                  La voz del entrevistador no está disponible ahora: leé la pregunta en el chat.
                </div>
              )}
              {s.followup ? (
                <Card size="sm"><CardContent className="text-sm text-muted-foreground">Repregunta de práctica sobre tu respuesta anterior. Se evalúa el hilo completo: no hace falta repetir lo que ya dijiste.</CardContent></Card>
              ) : !settings.hintsOff ? <HintsPanel key={`${q.id}-${s.lang}`} q={q} /> : (
                <Card size="sm"><CardContent className="text-sm text-muted-foreground">Sin pistas: respondé como en la entrevista real. La devolución completa llega igual.</CardContent></Card>
              )}
              <p className="px-1 text-xs text-muted-foreground">Duración sugerida: {target[0]}–{target[1]} s.</p>
              {s.guide && <Card size="sm" className="bg-accent/40"><CardContent><CoachingView c={s.guide} compact /></CardContent></Card>}
              {s.reference && (
                <Card size="sm" className="bg-muted/50">
                  <CardHeader><CardTitle className="text-sm">Tu referencia en {s.reference.lang === "es" ? "español" : "inglés"}</CardTitle></CardHeader>
                  <CardContent className="text-sm leading-6 text-muted-foreground"><ExampleText text={s.reference.text} /></CardContent>
                </Card>
              )}
            </>
          )}

          {s.phase === "processing" && (
            <Card size="sm">
              <CardHeader><CardTitle className="text-sm">Analizando</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Illustration name={s.stage === "coaching" ? "chat-with-ai" : "ai-answers"} className="mx-auto max-w-36" />
                <StageProgress stages={s.stage === "coaching" ? COACH_STAGES : STAGES} current={s.stage} done={s.doneStages} etaS={s.eta} />
                {s.metrics && <MetricsStrip m={s.metrics} />}
              </CardContent>
            </Card>
          )}

          {s.phase === "feedback" && s.evaluation && (
            <>
              {s.comparison?.competency && s.comparison.competency.scores[0] != null && (
                <ImprovementNote label={s.comparison.competency.label} from={s.comparison.competency.scores[0]} to={s.comparison.competency.scores[1]} />
              )}
              <Reveal><CompetencyCard ev={s.evaluation.evaluation} onFollowup={s.followup ? undefined : (text) => dispatch({ type: "followup", text })} /></Reveal>
              <Reveal delay={0.08}><IdealAnswer text={s.evaluation.evaluation.model_answer} lang={s.lang} /></Reveal>
              <Collapsible className="rounded-xl border bg-card">
                <CollapsibleTrigger className="group flex w-full items-center justify-between p-4 text-left font-medium">
                  <span>Detalles <span className="font-normal text-muted-foreground">· calificación, cómo llegar al 5, cómo sonaste</span></span>
                  <ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="flex flex-col gap-6 px-4 pb-4">
                  {s.comparison && <ComparisonView c={s.comparison} />}
                  {s.evaluation.evaluation.feed_up && (
                    <p className="flex items-start gap-2 rounded-lg bg-accent/60 p-3 text-sm text-accent-foreground">
                      <TargetIcon className="mt-0.5 size-4 shrink-0" /> <span><strong>Qué evalúa esta pregunta:</strong> {s.evaluation.evaluation.feed_up}</span>
                    </p>
                  )}
                  <EvidencePanel ev={s.evaluation.evaluation} />
                  <ToFive criteria={s.evaluation.evaluation.criteria} lang={s.lang} />
                  <section aria-labelledby="forma" className="flex flex-col gap-2">
                    <h2 id="forma" className="text-lg font-semibold">Cómo sonaste</h2>
                    {s.metrics && <MetricsStrip m={s.metrics} />}
                    {s.metrics && <MetricsPanel m={s.metrics} />}
                  </section>
                  <Requirements ev={s.evaluation.evaluation} />
                </CollapsibleContent>
              </Collapsible>
              <FeedbackRating key={s.turnId} turnId={s.turnId} />
            </>
          )}

          {s.phase === "coaching" && s.coaching && (
            <Card size="sm"><CardContent><CoachingView c={s.coaching.coaching} /></CardContent></Card>
          )}
        </aside>
      </div>
    </div>
  )
}

/** Duration band: visual guide to the suggested range, not a limit. */
function DurationBand({ elapsed, target }: { elapsed: number; target: number[] }) {
  const max = Math.max(target[1] * 1.4, elapsed + 5)
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <div className="relative h-1.5 flex-1 rounded-full bg-muted" aria-hidden>
        <div className="absolute inset-y-0 rounded-full bg-accent" style={{ left: `${(target[0] / max) * 100}%`, width: `${((target[1] - target[0]) / max) * 100}%` }} />
        <div className="absolute -top-1 h-3.5 w-0.5 rounded bg-foreground transition-[left]" style={{ left: `${Math.min(100, (elapsed / max) * 100)}%` }} />
      </div>
      <span className="whitespace-nowrap">zona sugerida {target[0]}–{target[1]} s</span>
    </div>
  )
}

function Requirements({ ev }: { ev: EvaluationBody }) {
  if (!ev.job_requirements_addressed.length && !ev.job_requirements_missed.length && !ev.unsupported_claims_vs_cv.length) return null
  return (
    <section className="flex flex-col gap-2 text-sm">
      <h2 className="text-lg font-semibold">Contra el puesto</h2>
      {ev.job_requirements_addressed.length > 0 && <div className="flex flex-wrap items-center gap-1.5">Tocaste: {ev.job_requirements_addressed.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}</div>}
      {ev.job_requirements_missed.length > 0 && <div className="flex flex-wrap items-center gap-1.5">Podrías conectar también: {ev.job_requirements_missed.map((r) => <Badge key={r} variant="outline">{r}</Badge>)}</div>}
      {ev.unsupported_claims_vs_cv.length > 0 && <div>Ojo, no está en tu CV: {ev.unsupported_claims_vs_cv.join(" · ")}</div>}
    </section>
  )
}

function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-muted-foreground">{subtitle}</p>
    </div>
  )
}


/** Recording panel: always-visible state, level, target duration band (guide, not a cutoff). */
export function RecordingPanel({ elapsed, level, silenceS, spoke, target, onStop, onHelp, onDiscard, stopRef, helpLabel = "Me quedé en blanco" }: {
  elapsed: number; level: number; silenceS: number; spoke: boolean; target: number[]
  onStop: () => void; onHelp?: () => void; onDiscard?: () => void; stopRef?: React.RefObject<HTMLButtonElement | null>; helpLabel?: string
}) {
  const max = Math.max(target[1] * 1.4, elapsed + 5)
  const showHelpHint = onHelp && silenceS > 8
  return (
    <Card className="border-primary/40">
      <CardContent className="flex flex-col gap-5 py-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2 font-medium">
            <span className="relative flex size-3"><span className="absolute inline-flex size-full rounded-full bg-primary opacity-60 motion-safe:animate-ping" /><span className="relative inline-flex size-3 rounded-full bg-primary" /></span>
            Grabando
          </span>
          <span className="font-mono text-2xl tabular-nums" aria-label={`Tiempo: ${fmtTime(elapsed)}`}>{fmtTime(elapsed)}</span>
        </div>
        <LevelMeter db={level} />
        <div>
          <div className="relative h-2 rounded-full bg-muted" aria-hidden>
            <div className="absolute inset-y-0 rounded-full bg-accent" style={{ left: `${(target[0] / max) * 100}%`, width: `${((target[1] - target[0]) / max) * 100}%` }} />
            <div className="absolute -top-1 h-4 w-0.5 rounded bg-foreground transition-[left]" style={{ left: `${Math.min(100, (elapsed / max) * 100)}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">Zona sugerida: {target[0]}–{target[1]} s. Es una guía, no un límite.</p>
        </div>
        {showHelpHint && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-accent/60 p-3 text-sm" role="status">
            <span>{spoke ? "¿Perdiste el hilo? No pasa nada." : "Tomarse unos segundos para pensar es normal. ¿Te ayudo?"}</span>
            <Button size="sm" variant="outline" onClick={onHelp}>Sí, ayudame</Button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button ref={stopRef} size="lg" className="h-14 px-8 text-base" onClick={onStop}><SquareIcon /> Terminé</Button>
          {onHelp && <Button size="lg" variant="outline" className="h-14" onClick={onHelp}><HelpCircleIcon /> {helpLabel}</Button>}
          {onDiscard && <Button size="lg" variant="ghost" className="h-14" onClick={onDiscard}><Trash2Icon /> Descartar y empezar de nuevo</Button>}
        </div>
      </CardContent>
    </Card>
  )
}

/** Test mode: upload a file instead of recording. */
export function FileAnswer({ onSubmit, allowHelp = true }: { onSubmit: (f: { blob: Blob; filename: string }, help: boolean) => void; allowHelp?: boolean }) {
  const [file, setFile] = useState<File | null>(null)
  return (
    <Card className={cn("border-dashed")}>
      <CardContent className="flex flex-col gap-3 py-2">
        <label className="flex items-center gap-2 text-sm font-medium" htmlFor="answer-file"><UploadIcon className="size-4" /> Modo prueba: elegí un audio con tu respuesta</label>
        <input id="answer-file" type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
        <div className="flex gap-3">
          <Button disabled={!file} onClick={() => file && onSubmit({ blob: file, filename: file.name }, false)}>Enviar respuesta</Button>
          {allowHelp && <Button variant="outline" disabled={!file} onClick={() => file && onSubmit({ blob: file, filename: file.name }, true)}>Enviar como "me quedé en blanco"</Button>}
        </div>
      </CardContent>
    </Card>
  )
}
