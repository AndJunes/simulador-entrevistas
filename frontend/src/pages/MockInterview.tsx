import { Illustration } from "@/components/illustration"
import { CaptionsIcon, CaptionsOffIcon, ClockIcon, KeyboardIcon, LoaderCircleIcon, MicIcon, PauseIcon, PhoneOffIcon, PlayIcon, RotateCcwIcon, SquareIcon, UploadIcon } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router"
import { toast } from "sonner"
import { LevelMeter, LiveRegion, StageProgress } from "@/components/common"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { api, appPath, followStages, type Lang, type MockLang, type MockStep } from "@/lib/api"
import { chime, fmtTime, playUrl, prefersReducedMotion, useOutputLevel, useRecorder } from "@/lib/audio"
import { useMic } from "@/lib/mic"
import { readSettings } from "@/lib/settings"
import { useAppContext, useAppId } from "@/lib/app"
import { cn } from "@/lib/utils"
import { WrittenAnswer } from "@/components/written-answer"
import { RecordingPanel } from "./Practice"

type Phase = "intro" | "starting" | "speaking" | "listening" | "thinking" | "ending" | "report" | "error"
interface Line { role: "interviewer" | "candidate"; text: string }

const BUY_TIME: Record<Lang, string> = {
  es: "Si necesitás un momento: “Buena pregunta, dejame pensarlo un segundo.” O pedí que la repita.",
  en: "If you need a moment: “That's a good question, let me think for a second.” Or ask: “Could you repeat the question?”",
}

export default function MockInterview({ mode }: { mode: "mock" | "videocall" }) {
  const appId = useAppId()
  const ctx = useAppContext("mock")
  const company = ctx.data?.company || "la empresa"
  const settings = readSettings()
  const stages = (ctx.data?.stages ?? []).filter((s) => (ctx.data?.interview_stages ?? []).includes(s.stage))
  const stageInfo = stages.find((s) => s.stage === settings.stage) ?? stages[0]
  const mockLang: MockLang = settings.mixed && ctx.data?.english_required ? "mix" : settings.lang
  const LIMIT_S = (stageInfo?.minutes[1] ?? 15) * 60
  const interviewer = stageInfo?.stage === "technical_screen" ? `Ingeniería · ${company}` : `Recruiter · ${company}`
  const navigate = useNavigate()
  const mic = useMic()
  const rec = useRecorder(mic.stream)
  const [phase, setPhase] = useState<Phase>("intro")
  const [sid, setSid] = useState<string | null>(null)
  const [step, setStep] = useState<MockStep | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [showQ, setShowQ] = useState(mode === "mock" ? true : settings.showQuestion)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const [announce, setAnnounce] = useState("")
  const [reportProg, setReportProg] = useState<{ stage: string; done: number; total: number }>({ stage: "", done: 0, total: 0 })
  const [file, setFile] = useState<File | null>(null)
  // ONE <audio> for the whole interview: the AnalyserNode connects once (indicator driven by the real voice)
  const [voiceEl] = useState(() => new Audio())
  const audioRef = useRef<HTMLAudioElement | null>(voiceEl)
  const [paused, setPaused] = useState(false)
  const [showClock, setShowClock] = useState(true)
  const [writing, setWriting] = useState(false)
  const [draft, setDraft] = useState("")
  const voiceLevel = useOutputLevel(voiceEl, phase === "speaking" && !paused)
  const sidRef = useRef<string | null>(null)   // read by memoized callbacks (avoids a stale sid)
  const stopRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => () => { audioRef.current?.pause(); mic.release() }, [mic.release])   // eslint-disable-line react-hooks/exhaustive-deps

  const listen = useCallback(async () => {
    if (settings.devFile) { setPhase("listening"); return }
    const st = await mic.request()   // opens only to answer
    if (!st) { toast.error("No pudimos abrir el micrófono."); return }
    chime()
    rec.start(st)
    setPhase("listening")
    setAnnounce("Tu turno. Grabando.")
    setTimeout(() => stopRef.current?.focus(), 50)
  }, [mic, rec, settings.devFile])

  const speak = useCallback(async (st: MockStep) => {
    setStep(st)
    setLines((l) => [...l, { role: "interviewer", text: st.say }])
    setPhase("speaking")
    setAnnounce(`Entrevistador: ${st.say}`)
    setPaused(false)
    if (settings.voice && st.audio_url) {
      const { done } = playUrl(st.audio_url, voiceEl)
      await done
    } else {
      await new Promise((r) => setTimeout(r, 1200))
    }
    if (st.done) { finish(); return }
    if (settings.autostart) listen()
    else setPhase("listening")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.voice, settings.autostart, listen])

  async function begin() {
    if (!settings.devFile && !(await mic.request())) return   // confirms the permission…
    mic.release()                                             // …and closes it until it's your turn to answer
    setPhase("starting")
    try {
      const r = await api.startMock(appId, mode, mockLang, stageInfo?.stage ?? "recruiter_screen", { showQuestion: showQ, voice: settings.voice })
      setSid(r.session_id)
      sidRef.current = r.session_id
      setStartedAt(Date.now())
      speak(r)
    } catch (e) {
      toast.error(`No se pudo iniciar: ${(e as Error).message}`)
      setPhase("intro")
    }
  }

  async function sendAnswer(blob: Blob | null, filename: string, text?: string) {
    if (!sid) return
    setPhase("thinking")
    setAnnounce("El entrevistador está tomando nota.")
    try {
      const next = await api.mockAnswer(sid, blob, filename, text)
      setLines((l) => [...l, { role: "candidate", text: next.transcript || "(sin respuesta)" }])
      setFile(null)
      setDraft("")
      setWriting(false)
      speak(next)
    } catch (e) {
      toast.error(`Problema procesando tu respuesta: ${(e as Error).message}`)
      setPhase("listening")
    }
  }

  async function stopAndSend() {
    if (settings.devFile) { if (file) sendAnswer(file, file.name); return }
    const r = await rec.stop()
    mic.release()
    if (r) sendAnswer(r.blob, r.filename)
  }

  async function finish() {
    const sid = sidRef.current
    if (!sid) { navigate(appPath(appId, "practicar")); return }
    rec.discard()
    mic.release()
    audioRef.current?.pause()
    setPhase("report")
    setAnnounce("Preparando tu informe.")
    try {
      await api.finishMock(sid)
      followStages(`/api/mock/sessions/${sid}/report/events`, (e) => {
        if (e.stage === "progress") setReportProg({ stage: "evaluating", done: e.done, total: e.total })
        if (e.stage === "writing_report") setReportProg((p) => ({ ...p, stage: "writing" }))
        if (e.stage === "done") navigate(appPath(appId, `informe/${sid}`))
        if (e.stage === "error") { toast.error(e.message); setPhase("error") }
      })
    } catch (e) {
      toast.error((e as Error).message)
      setPhase("error")
    }
  }

  // WCAG 1.4.2: auto-playing voice can be paused/resumed and replayed, with controls FIRST in the bar
  const pauseVoice = () => { voiceEl.pause(); setPaused(true) }
  const resumeVoice = () => { voiceEl.play().catch(() => {}); setPaused(false) }
  const repeatVoice = () => { voiceEl.currentTime = 0; voiceEl.play().catch(() => {}); setPaused(false) }
  const canRepeat = !!step?.audio_url && settings.voice && !rec.recording && (phase === "speaking" || phase === "listening")
  const sendWritten = () => { if (draft.trim()) sendAnswer(null, "", draft.trim()) }
  const startWriting = () => { if (rec.recording) { rec.discard(); mic.release() } setWriting(true) }

  const elapsed = startedAt ? (now - startedAt) / 1000 : 0
  const pending = step?.pending
  const lang: Lang = pending?.lang ?? (mockLang === "mix" ? "es" : mockLang)
  const parentQ = ctx.data?.questions.find((q) => q.id === pending?.parent)
  const target = pending?.type === "closing" ? [20, 90] : pending?.is_followup ? [20, 75] : parentQ?.duration ?? [45, 90]
  const progressLabel = step ? (pending?.type === "closing" ? "Cierre" : `Pregunta ${step.progress.index} de ${step.progress.total}`) : ""
  const nQ = stageInfo?.question_ids.length ?? 0
  const langLabel = mockLang === "mix" ? "Español → inglés" : mockLang === "es" ? "Español" : "Inglés"

  // Intro (what you'll find)
  if (phase === "intro" || phase === "starting") {
    return (
      <div className={cn(mode === "videocall" && "mx-auto max-w-3xl px-4 py-10")}>
        <Card>
          <CardHeader>
            <CardDescription>{mode === "videocall" ? "Videollamada realista" : "Simulacro de corrido"} · {stageInfo?.label ?? "Entrevista"} · {langLabel} · {nQ} preguntas</CardDescription>
            <CardTitle className="text-2xl">Antes de empezar</CardTitle>
          </CardHeader>
          <Illustration name={phase === "starting" ? "nice-to-meet-you" : mode === "videocall" ? "video-call" : "business-chat"} eager className="mx-auto max-w-56 px-6" />
          <CardContent className="flex flex-col gap-4 text-[15px]">
            <ul className="flex flex-col gap-2">
              <li>• El entrevistador te saluda y hace {nQ} preguntas seguidas, sin feedback ni pistas en el medio (~{Math.round(stageInfo?.est_minutes ?? 15)} min acá; la real dura {stageInfo?.minutes[0]}–{stageInfo?.minutes[1]} min).</li>
              <li>• Si en tu respuesta falta evidencia importante, te repregunta: hasta 3 veces por pregunta, una a la vez. Si ya lo cubriste, sigue de largo.</li>
              {mockLang === "mix" && <li>• Arranca en español y, a mitad de la entrevista, el entrevistador pasa a inglés.</li>}
              <li>• Al final te pregunta si tenés preguntas: llevá 2 o 3 preparadas.</li>
              <li>• {settings.autostart ? "Después de cada pregunta suena un tono y empieza a grabar. Cuando termines, pulsá “Terminé”." : "Después de cada pregunta, empezás a grabar vos."}</li>
              {mode === "videocall" && <li>• La pregunta no se ve en pantalla (como en la llamada real). Podés activar los subtítulos si la necesitás.</li>}
              <li>• Podés terminar cuando quieras: igual recibís el informe con lo que respondiste.</li>
            </ul>
            <div className="flex items-center gap-3">
              <Button size="lg" className="h-12 px-8 text-base" onClick={begin} disabled={phase === "starting"}>
                {phase === "starting" ? <><LoaderCircleIcon className="motion-safe:animate-spin" /> Conectando…</> : "Empezar"}
              </Button>
              <Button variant="ghost" onClick={() => navigate(appPath(appId, "practicar"))}>Volver</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (phase === "report" || phase === "error") {
    return (
      <div className={cn(mode === "videocall" && "mx-auto max-w-2xl px-4 py-10")}>
        <LiveRegion message={announce} />
        <Card>
          <CardHeader><CardTitle>{phase === "error" ? "No se pudo generar el informe" : "Preparando tu informe"}</CardTitle>
            <CardDescription>{phase === "error" ? "Podés verlo después desde el historial." : "Evaluamos cada respuesta y buscamos patrones que se repiten."}</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Illustration name={phase === "error" ? "online-meeting" : "ai-response"} eager className="mx-auto max-w-44" />
            {phase === "report" && (
              <StageProgress
                stages={[{ key: "evaluating", label: `Evaluando respuestas${reportProg.total ? ` (${reportProg.done}/${reportProg.total})` : ""}` }, { key: "writing", label: "Escribiendo el informe" }]}
                current={reportProg.stage === "writing" ? "writing" : "evaluating"}
                done={reportProg.stage === "writing" ? ["evaluating"] : []}
                etaS={reportProg.stage === "writing" ? 20 : undefined}
              />
            )}
            {phase === "error" && <Button onClick={() => navigate(appPath(appId, "resultados?tab=simulacros"))}>Ir a resultados</Button>}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Interview in progress
  const speaking = phase === "speaking"
  const listening = phase === "listening"
  const thinking = phase === "thinking"
  const caption = step?.say ?? ""

  if (mode === "videocall") {
    return (
      <div className="flex min-h-svh flex-col bg-[oklch(0.2_0.015_235)] text-[oklch(0.95_0.01_220)]">
        <LiveRegion message={announce} />
        <div className="flex items-center justify-between px-6 py-3 text-sm opacity-80">
          <span>{company} · {stageInfo?.label ?? "Intro call"}</span>
          {showClock ? <span role="timer" aria-live="off" className="font-mono tabular-nums" aria-label={`Tiempo transcurrido ${fmtTime(elapsed)} de ${Math.round(LIMIT_S / 60)} minutos (guía, no límite)`}>{fmtTime(elapsed)} / {fmtTime(LIMIT_S)}</span> : <span />}
        </div>
        <div className="grid flex-1 content-center gap-4 px-6 md:grid-cols-2">
          <Tile name={interviewer} initials={interviewer[0]} active={speaking} amp={voiceLevel} label={speaking ? (paused ? "en pausa" : "hablando") : thinking ? "tomando nota…" : ""} />
          <Tile name="Vos" initials="Vos" active={listening && !settings.devFile && rec.level > -45} label={listening ? (settings.devFile ? "modo prueba" : "micrófono activo") : ""} level={listening && !settings.devFile ? rec.level : undefined} />
        </div>
        <div className="mx-auto w-full max-w-3xl px-6 py-4">
          {(showQ || speaking) && caption && (
            <p className={cn("rounded-lg bg-black/40 px-4 py-3 text-center text-lg leading-snug", !showQ && "sr-only")}>{caption}</p>
          )}
          {listening && rec.silenceS > 8 && <p className="mt-2 text-center text-sm opacity-80" role="status">{BUY_TIME[lang]}</p>}
          {listening && settings.devFile && <DevFile file={file} setFile={setFile} dark />}
          {listening && writing && <WrittenAnswer value={draft} onChange={setDraft} onSend={sendWritten} onCancel={() => setWriting(false)} dark />}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 border-t border-white/10 px-6 py-4">
          {speaking && settings.voice && step?.audio_url && (paused
            ? <Button variant="secondary" size="lg" onClick={resumeVoice}><PlayIcon /> Reanudar voz</Button>
            : <Button variant="secondary" size="lg" onClick={pauseVoice}><PauseIcon /> Pausar voz</Button>)}
          {canRepeat && <Button variant="secondary" size="lg" onClick={repeatVoice}><RotateCcwIcon /> Repetir pregunta</Button>}
          {listening && !writing && <Button variant="secondary" size="lg" onClick={startWriting}><KeyboardIcon /> Responder por escrito</Button>}
          <Button variant="secondary" size="lg" onClick={() => setShowQ((v) => !v)} aria-pressed={showQ}>
            {showQ ? <CaptionsOffIcon /> : <CaptionsIcon />} {showQ ? "Ocultar pregunta" : "Mostrar pregunta"}
          </Button>
          {listening ? (
            <Button ref={stopRef} size="lg" className="h-12 px-8" onClick={stopAndSend} disabled={settings.devFile && !file}><SquareIcon /> Terminé de responder</Button>
          ) : (
            <Button size="lg" className="h-12 px-8" disabled>
              {thinking ? <><LoaderCircleIcon className="motion-safe:animate-spin" /> Tomando nota…</> : <><MicIcon /> Escuchando al entrevistador…</>}
            </Button>
          )}
          {!settings.autostart && phase === "listening" && !rec.recording && !settings.devFile && <Button size="lg" variant="secondary" onClick={listen}>Empezar a responder</Button>}
          <Button size="lg" variant="destructive" onClick={finish}><PhoneOffIcon /> Terminar llamada</Button>
        </div>
      </div>
    )
  }

  // mock with the question visible
  return (
    <div className="flex flex-col gap-6">
      <LiveRegion message={announce} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{progressLabel}</Badge>
          {pending?.is_followup && <Badge variant="outline">Repregunta {pending.followup_n}{pending.followup_max ? ` de ${pending.followup_max}` : ""}</Badge>}
          {mockLang === "mix" && pending?.lang && <Badge variant="outline">{pending.lang === "es" ? "ES" : "EN"}</Badge>}
        </div>
        <div className="flex items-center gap-3">
          {showClock && <span role="timer" aria-live="off" className="font-mono text-sm tabular-nums text-muted-foreground" aria-label={`Tiempo transcurrido ${fmtTime(elapsed)} (guía, no límite)`}>{fmtTime(elapsed)}</span>}
          <Button variant="ghost" size="sm" aria-pressed={!showClock} onClick={() => setShowClock((v) => !v)}><ClockIcon /> {showClock ? "Ocultar reloj" : "Mostrar reloj"}</Button>
          <Button variant="ghost" size="sm" onClick={finish}>Terminar simulacro</Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex items-start gap-4 py-2">
          <Avatar initials={interviewer[0]} active={speaking} amp={voiceLevel} />
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">{interviewer} {speaking ? "· hablando" : thinking ? "· tomando nota…" : ""}</span>
            <p className="text-xl leading-snug">{caption}</p>
          </div>
        </CardContent>
      </Card>

      {(speaking || canRepeat || listening) && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Controles de la voz y de la respuesta">
          {speaking && settings.voice && step?.audio_url && (paused
            ? <Button variant="outline" onClick={resumeVoice}><PlayIcon /> Reanudar voz</Button>
            : <Button variant="outline" onClick={pauseVoice}><PauseIcon /> Pausar voz</Button>)}
          {canRepeat && <Button variant="outline" onClick={repeatVoice}><RotateCcwIcon /> Repetir pregunta</Button>}
          {listening && !writing && <Button variant="outline" onClick={startWriting}><KeyboardIcon /> Responder por escrito</Button>}
        </div>
      )}
      {listening && writing && <WrittenAnswer value={draft} onChange={setDraft} onSend={sendWritten} onCancel={() => setWriting(false)} />}
      {listening && !settings.devFile && rec.recording && !writing && (
        <RecordingPanel elapsed={rec.elapsed} level={rec.level} silenceS={rec.silenceS} spoke={rec.spoke} target={target} onStop={stopAndSend} stopRef={stopRef} />
      )}
      {listening && !settings.devFile && !rec.recording && !writing && (
        <div className="flex justify-center"><Button size="lg" className="h-14 px-10 text-base" onClick={listen} autoFocus>Empezar a responder</Button></div>
      )}
      {listening && rec.silenceS > 8 && <p className="text-center text-sm text-muted-foreground" role="status">{BUY_TIME[lang]}</p>}
      {listening && settings.devFile && (
        <div className="flex flex-col items-center gap-3"><DevFile file={file} setFile={setFile} /><Button disabled={!file} onClick={stopAndSend}>Enviar respuesta</Button></div>
      )}
      {thinking && <p className="flex items-center justify-center gap-2 text-muted-foreground" role="status"><LoaderCircleIcon className="size-4 motion-safe:animate-spin" /> El entrevistador está tomando nota…</p>}

      <Collapsible>
        <CollapsibleTrigger className="text-sm text-muted-foreground hover:text-foreground">Ver la conversación ({lines.length})</CollapsibleTrigger>
        <CollapsibleContent className="mt-3 flex flex-col gap-2">
          {lines.map((l, i) => (
            <div key={i} className={cn("max-w-[85%] rounded-lg px-3 py-2 text-sm", l.role === "interviewer" ? "self-start bg-muted" : "self-end bg-accent")}>
              <span className="sr-only">{l.role === "interviewer" ? "Entrevistador: " : "Vos: "}</span>{l.text}
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

/** Avatar with a halo following the REAL voice amplitude (amp 0–1). With reduced motion: fixed halo, no scaling. */
function Avatar({ initials, active, amp = 0, size = "md" }: { initials: string; active?: boolean; amp?: number; size?: "md" | "lg" }) {
  const d = size === "lg" ? "size-28 text-3xl" : "size-14 text-lg"
  const still = prefersReducedMotion()
  const on = active && amp > 0.04
  return (
    <span className="relative flex shrink-0 items-center justify-center">
      {on && <span aria-hidden className={cn("absolute rounded-full bg-primary/40 transition-transform duration-75", d)}
        style={still ? undefined : { transform: `scale(${1 + Math.min(amp, 1) * 0.3})` }} />}
      <span className={cn("relative flex items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground", d)}>{initials}</span>
    </span>
  )
}

function Tile({ name, initials, active, label, level, amp }: { name: string; initials: string; active?: boolean; label?: string; level?: number; amp?: number }) {
  return (
    <div className={cn("relative flex min-h-[22svh] flex-col items-center justify-center gap-4 rounded-2xl md:min-h-[45svh] bg-white/5 ring-1 ring-white/10", active && "ring-2 ring-[oklch(0.72_0.09_195)]")}>
      <Avatar initials={initials} active={active} amp={amp ?? (level !== undefined ? Math.max(0, Math.min(1, (level + 60) / 45)) : 0)} size="lg" />
      {level !== undefined && <div className="w-40"><LevelMeter db={level} /></div>}
      <div className="absolute bottom-3 left-4 text-sm">{name}{label ? <span className="opacity-70"> · {label}</span> : null}</div>
    </div>
  )
}

function DevFile({ file, setFile, dark }: { file: File | null; setFile: (f: File | null) => void; dark?: boolean }) {
  return (
    <label className={cn("mt-2 flex items-center justify-center gap-2 text-sm", dark && "opacity-90")}>
      <UploadIcon className="size-4" /> Modo prueba:
      <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="Elegí un audio con tu respuesta" />
      {file && <span className="opacity-70">{file.name}</span>}
    </label>
  )
}

