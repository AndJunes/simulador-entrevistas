import { Illustration } from "@/components/illustration"
import { IconBox, PageHeader, Panel, SectionHead } from "@/components/page"
import { CheckCircle2Icon, ChevronDownIcon, CodeIcon, MicIcon, MonitorIcon, RepeatIcon, SearchIcon, VideoIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { LevelMeter } from "@/components/common"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import type { Mode, Stage } from "@/lib/api"
import { MIC_ERROR_TEXT, playUrl, useLevel } from "@/lib/audio"
import { api } from "@/lib/api"
import { useMic } from "@/lib/mic"
import { useSettings } from "@/lib/settings"
import { appPath } from "@/lib/api"
import { useAppContext, useAppId } from "@/lib/app"

import { cn } from "@/lib/utils"

interface ModeInfo {
  id: Mode
  icon: React.ElementType
  title: string
  tagline: string
  expect: string[]
  duration: string
  feedback: string
  realism: 1 | 2 | 3
  route: string
}

const MODES: ModeInfo[] = [
  {
    id: "practice", icon: RepeatIcon, title: "Práctica por pregunta", tagline: "Para armar cada respuesta con calma.",
    expect: [
      "Elegís una pregunta del banco de esta postulación.",
      "Modo coach: las pistas aparecen de a una, solo si las pedís (o las apagás).",
      "Respondés y en ~25 s ves qué demostraste, qué falta y la repregunta que te harían.",
      "Podés reintentar y ver la comparación, o pasar la misma pregunta al otro idioma.",
      "Si te quedás en blanco, te orienta: frases para ganar tiempo, historias de tu CV y un esqueleto.",
    ],
    duration: "2–3 min por pregunta", feedback: "Inmediato, después de cada respuesta", realism: 1, route: "practica",
  },
  {
    id: "mock", icon: MonitorIcon, title: "Simulacro de corrido", tagline: "La entrevista completa, de corrido.",
    expect: [
      "Elegís la etapa: recruiter screen, técnica o conductual/cliente.",
      "Solo la pregunta: sin pistas ni lo que espera escuchar el entrevistador.",
      "Hasta 3 repreguntas por pregunta, solo si falta evidencia en tu respuesta.",
      "Al final, tus preguntas para el entrevistador. Informe por competencia al final.",
    ],
    duration: "Según la etapa", feedback: "Solo al final, en un informe", realism: 2, route: "simulacro",
  },
  {
    id: "videocall", icon: VideoIcon, title: "Videollamada realista", tagline: "El mismo simulacro, con más presión.",
    expect: [
      "Pantalla tipo Google Meet: el entrevistador y vos (sin cámara, solo audio).",
      "La pregunta NO se ve por defecto: la escuchás, como en la llamada real.",
      "Temporizador con la duración de la etapa a la vista.",
      "Podés mostrar la pregunta si la necesitás. Informe al final.",
    ],
    duration: "Según la etapa", feedback: "Solo al final, en un informe", realism: 3, route: "videollamada",
  },
  {
    id: "exercise", icon: CodeIcon, title: "Ejercicio práctico", tagline: "Una tarea escrita, parecida al trabajo real.",
    expect: [
      "Consigna, entregable y criterios a la vista desde el principio.",
      "Podés hacer preguntas aclaratorias: el entrevistador responde solo con los datos del ejercicio.",
      "Escribís código o un mensaje (el código nunca se ejecuta: se evalúa leyéndolo).",
      "Evaluación con la rúbrica de ejercicio: enfoque, corrección, fallos, tests y trade-offs.",
    ],
    duration: "15–40 min por ejercicio", feedback: "Al enviar", realism: 2, route: "ejercicio",
  },
]

const STAGE_INFO: Record<Stage, string> = {
  recruiter_screen: "Trayectoria, motivación, experiencia frente a los requisitos y logística. No es un examen técnico.",
  technical_screen: "Situaciones de trabajo sobre los requisitos técnicos obligatorios y un proyecto de tu CV. Pensá en voz alta.",
  behavioral_client: "Historias reales: entrega de punta a punta, un bug difícil, decisiones con datos, ambigüedad y comunicación.",
  work_sample: "",
}

export default function Lobby() {
  const appId = useAppId()
  const ctx = useAppContext()
  const [settings, set] = useSettings()
  const stages = (ctx.data?.stages ?? []).filter((s) => (ctx.data?.interview_stages ?? []).includes(s.stage))
  const stage = stages.find((s) => s.stage === settings.stage) ?? stages[0]
  const hasExercises = (ctx.data?.exercises.length ?? 0) > 0
  const [params] = useSearchParams()
  const [mode, setMode] = useState<Mode>(() => (MODES.some((m) => m.id === params.get("modo")) ? params.get("modo") as Mode : "practice"))
  const mic = useMic()
  const level = useLevel(mic.stream)
  const [primed, setPrimed] = useState(false)
  const navigate = useNavigate()
  const sel = MODES.find((m) => m.id === mode)!
  const isMock = mode === "mock" || mode === "videocall"
  const modes = MODES.filter((m) => m.id !== "exercise" || hasExercises)

  // the mic test closes on leaving the panel
  useEffect(() => () => mic.release(), [mic.release])   // eslint-disable-line react-hooks/exhaustive-deps

  async function enter() {
    if (isMock && stage && stage.stage !== settings.stage) set("stage", stage.stage)
    if (mode !== "exercise" && !settings.devFile && !mic.stream) {
      const s = await mic.request()   // confirms the permission
      if (!s) return
    }
    mic.release()
    if (mode === "videocall" && settings.showQuestion) set("showQuestion", false)
    navigate(appPath(appId, sel.route))
  }

  return (
    <div className="flex flex-col gap-7">
      <PageHeader eyebrow="Entrenamiento" title="Practicá a tu manera."
        intro="Elegí una sesión y empezá. Las pistas y los resultados se muestran según la modalidad, para que puedas concentrarte en responder." />

      {/* Modes: accessible radiogroup, whole card clickable, state visible via border + check + text */}
      <section aria-labelledby="modo-h">
        <h2 id="modo-h" className="sr-only">Modo de práctica</h2>
        <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="grid gap-3.5 min-[561px]:grid-cols-2" aria-labelledby="modo-h">
          {modes.map((m) => {
            const active = m.id === mode
            return (
              <Label key={m.id} htmlFor={`mode-${m.id}`}
                className={cn("flex cursor-pointer items-start gap-3.5 rounded-[18px] border bg-card p-5 font-normal transition-[transform,border-color,box-shadow] duration-[var(--dur-fast)] hover:-translate-y-0.5 hover:border-primary/50",
                  active && "border-2 border-primary bg-mint/30 p-[19px] shadow-[0_0_0_3px_rgba(8,126,128,.07)]")}>
                <IconBox><m.icon /></IconBox>
                <span className="min-w-0 flex-1">
                  <span className="mb-1.5 flex items-start justify-between gap-2">
                    <span className="text-[15px] font-bold tracking-[-0.02em]">{m.title}</span>
                    <RadioGroupItem id={`mode-${m.id}`} value={m.id} aria-label={m.title} />
                  </span>
                  <span className="block text-caption text-muted-foreground sm:text-label">{m.tagline}</span>
                  <span className="mt-2.5 block text-caption font-extrabold text-teal-dark">{m.duration} · Feedback: {m.feedback.toLowerCase()}</span>
                  {active && <span className="mt-1.5 flex items-center gap-1 text-caption font-bold text-teal-dark"><CheckCircle2Icon className="size-3.5" aria-hidden /> Seleccionado</span>}
                </span>
              </Label>
            )
          })}
        </RadioGroup>
        <Panel aria-labelledby="expect-h" className="mt-3.5">
          <h3 id="expect-h" className="mb-2 text-label font-bold">Qué vas a encontrar en {sel.title.toLowerCase()}</h3>
          <ul className="grid gap-1.5 text-caption text-muted-foreground sm:text-label min-[851px]:grid-cols-2">
            {sel.expect.map((e, i) => <li key={i} className="flex gap-2"><span aria-hidden className="text-primary">•</span>{e}</li>)}
          </ul>
        </Panel>
      </section>

      {isMock && stages.length > 0 && (
        <section aria-labelledby="etapa" className="flex flex-col gap-3">
          <h2 id="etapa" className="text-[19px] font-bold tracking-[-0.035em]">¿Qué etapa de la entrevista?</h2>
          <RadioGroup value={stage?.stage} onValueChange={(v) => set("stage", v as Stage)} className="grid gap-3 min-[851px]:grid-cols-3" aria-labelledby="etapa">
            {stages.map((st) => (
              <Label key={st.stage} htmlFor={`st-${st.stage}`} className={cn("flex cursor-pointer flex-col items-stretch gap-2 rounded-row border bg-card p-4 font-normal hover:border-primary/50", stage?.stage === st.stage && "border-2 border-primary bg-mint/30 p-[15px]")}>
                <span className="flex items-center justify-between gap-2"><span className="font-medium">{st.label}</span><RadioGroupItem id={`st-${st.stage}`} value={st.stage} /></span>
                <span className="text-sm text-muted-foreground">{STAGE_INFO[st.stage]}</span>
                <span className="text-xs text-muted-foreground">{st.question_ids.length} preguntas · real: {st.minutes[0]}–{st.minutes[1]} min · estimado acá: ~{Math.round(st.est_minutes)} min</span>
              </Label>
            ))}
          </RadioGroup>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section aria-labelledby="ajustes" className="flex flex-col gap-5 rounded-card border bg-card p-5">
          <h2 id="ajustes" className="text-[17px] font-bold tracking-[-0.03em]">Ajustes</h2>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium" id="lang-label">Idioma de la entrevista</span>
            <RadioGroup value={settings.lang} onValueChange={(v) => set("lang", v as "es" | "en")} className="flex gap-6" aria-labelledby="lang-label">
              <div className="flex items-center gap-2"><RadioGroupItem id="lang-es" value="es" /><Label htmlFor="lang-es">Español</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem id="lang-en" value="en" /><Label htmlFor="lang-en">Inglés</Label></div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              {settings.lang === "es" ? "En español se evalúa el contenido y la claridad, no tu inglés. Ideal para armar las respuestas primero." : "En inglés se evalúa también la comunicación en inglés (claridad, no acento)."}
            </p>
          </div>
          <Separator />
          <SettingSwitch id="voice" label="El entrevistador habla" hint="Escuchás la pregunta y el resumen del feedback. Siempre los tenés también en texto." checked={settings.voice} onChange={(v) => set("voice", v)} />
          {settings.voice && <VoiceControls volume={settings.voiceVolume} rate={settings.voiceRate} lang={settings.lang}
            onVolume={(v) => set("voiceVolume", v)} onRate={(v) => set("voiceRate", v)} />}
          <SettingSwitch id="autostart" label="La grabación arranca sola" hint="Cuando termina la pregunta suena un tono y empieza a grabar: así se mide cuánto tardás en arrancar. Si lo apagás, empezás vos cuando estés listo." checked={settings.autostart} onChange={(v) => set("autostart", v)} />
          {isMock && ctx.data?.english_required && (
            <SettingSwitch id="mixed" label="Cambio de idioma a mitad de la entrevista" hint="Arranca en español y el entrevistador pasa a inglés en la segunda mitad, como puede pasar en un rol que pide inglés." checked={settings.mixed} onChange={(v) => set("mixed", v)} />
          )}
          {mode === "practice" && (
            <SettingSwitch id="hintsoff" label="Sin pistas" hint="No se ofrecen pistas antes de responder: medís cómo respondés sin ayuda. Igual ves la devolución completa." checked={settings.hintsOff} onChange={(v) => set("hintsOff", v)} />
          )}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              Opciones avanzadas <ChevronDownIcon className="size-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <SettingSwitch id="devfile" label="Usar un archivo de audio (modo prueba)" hint="En lugar del micrófono, subís un audio grabado. Útil para probar la app." checked={settings.devFile} onChange={(v) => set("devFile", v)} />
            </CollapsibleContent>
          </Collapsible>
        </section>

        {/* Microphone: pre-permission screen (NN/g). The exercise is written: it doesn't need it. */}
        {mode !== "exercise" && <section aria-labelledby="mic" className="flex flex-col gap-4 rounded-card border bg-card p-5">
          <h2 id="mic" className="flex items-center gap-2 text-[17px] font-bold tracking-[-0.03em]"><MicIcon className="size-4" /> Micrófono</h2>
          {settings.devFile ? (
            <p className="text-sm text-muted-foreground">Modo prueba activo: no se usa el micrófono.</p>
          ) : mic.stream ? (
            <>
              <p className="text-sm">Decí algo en voz alta para ver el nivel.</p>
              <LevelMeter db={level} />
              <p className="text-xs text-muted-foreground">
                {level < -50 ? "Casi no te escucho: acercate al micrófono o subí la ganancia en Ajustes del Sistema → Sonido." : "Si la barra se mueve cuando hablás, estás listo."}
              </p>
            </>
          ) : !primed ? (
            <>
              <Illustration name="voice-assistant" className="mx-auto max-w-36" />
              <p className="text-sm">Para escuchar tus respuestas necesitamos el micrófono. Tu voz se transcribe <strong>en esta computadora</strong> y el audio se borra apenas se procesa.</p>
              <p className="flex items-center gap-2 text-caption text-muted-foreground"><Illustration name="security-on" className="w-12 max-w-12" /> Privacidad: el audio no sale de tu Mac; al evaluador solo va el texto.</p>
              <Button variant="outline" onClick={() => { setPrimed(true); mic.request() }} disabled={mic.asking}>Probar el micrófono</Button>
            </>
          ) : mic.error ? (
            <Alert>
              <Illustration name="secure-login" className="mb-2 max-w-32" />
              <AlertTitle>{MIC_ERROR_TEXT[mic.error].title}</AlertTitle>
              <AlertDescription>{MIC_ERROR_TEXT[mic.error].body}</AlertDescription>
              <Button className="mt-3 w-fit" variant="outline" size="sm" onClick={() => mic.request()}>Volver a intentar</Button>
            </Alert>
          ) : (
            <p className="text-sm text-muted-foreground" role="status">Esperando el permiso del navegador… buscá el aviso arriba a la izquierda.</p>
          )}
        </section>}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button variant="dark" size="cta" className="max-[560px]:w-full" onClick={enter} disabled={mic.asking}>
          {mic.asking ? "Esperando el permiso…" : `Empezar: ${sel.title.toLowerCase()} →`}
        </Button>
        <span className="text-sm text-muted-foreground">{isMock && stage ? `${stage.label} · ~${Math.round(stage.est_minutes)} min` : sel.duration} · {isMock && settings.mixed && ctx.data?.english_required ? "español → inglés" : settings.lang === "es" ? "en español" : "en inglés"}</span>
      </div>

      <QuestionBank />
    </div>
  )
}

/** Question bank: local search over the real questions; each one opens practice for that question. */
function QuestionBank() {
  const appId = useAppId()
  const ctx = useAppContext()
  const [settings] = useSettings()
  const [q, setQ] = useState("")
  const all = (ctx.data?.questions ?? []).filter((x) => x.format !== "exercise")
  const text = (x: (typeof all)[number]) => (settings.lang === "en" ? x.text_en : x.text_es) || x.text_es || x.text_en
  const norm = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
  const shown = all.filter((x) => !q || norm(`${x.id} ${text(x)} ${x.competency_label}`).includes(norm(q)))
  return (
    <Panel aria-labelledby="bank-h">
      <div className="mb-3.5 flex flex-wrap items-end justify-between gap-3">
        <SectionHead id="bank-h" className="mb-0" title="Banco de preguntas" sub={`${all.length} preguntas vinculadas a esta candidatura.`} />
        <label className="relative min-w-[200px] max-[560px]:w-full">
          <span className="sr-only">Buscar pregunta</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pregunta…" className="h-11 w-full rounded-[11px] border border-input bg-card pl-9 pr-3 text-label placeholder:text-muted-foreground" />
        </label>
      </div>
      <p role="status" className="sr-only">{shown.length} preguntas</p>
      {shown.length ? (
        <ul>
          {shown.slice(0, 8).map((x) => (
            <li key={x.id} className="flex items-center gap-3 border-b border-border/70 py-[13px] last:border-0">
              <IconBox className="num size-[35px] rounded-[11px] text-caption font-extrabold text-foreground">{x.id}</IconBox>
              <span className="min-w-0 flex-1">
                <strong className="block text-caption font-bold sm:text-label">{text(x)}</strong>
                <span className="text-caption text-muted-foreground">{ctx.data?.stage_labels?.[x.stage] ?? x.stage} · {x.competency_label}</span>
              </span>
              <Button asChild variant="soft" size="cta" className="shrink-0"><Link to={`${appPath(appId, "practica")}?q=${x.id}`} aria-label={`Practicar ${x.id}`}>Practicar</Link></Button>
            </li>
          ))}
        </ul>
      ) : <p className="rounded-xl bg-soft p-4 text-label text-muted-foreground">Ninguna pregunta coincide con "{q}". <button type="button" className="font-semibold text-teal-dark underline" onClick={() => setQ("")}>Limpiar búsqueda</button></p>}
      <Link to={appPath(appId, "preguntas")} className="mt-3 inline-block py-2 text-caption font-extrabold text-teal-dark hover:underline">
        {shown.length > 8 ? `Ver las ${shown.length} en el banco completo →` : "Revisar, editar o aprobar en el banco completo →"}
      </Link>
    </Panel>
  )
}

const RATES = [{ v: 1, label: "Normal" }, { v: 1.15, label: "Un poco más rápida" }, { v: 1.3, label: "Rápida" }]

function VoiceControls({ volume, rate, lang, onVolume, onRate }: {
  volume: number; rate: number; lang: "es" | "en"; onVolume: (v: number) => void; onRate: (v: number) => void
}) {
  const [testing, setTesting] = useState(false)
  async function test() {
    setTesting(true)
    try {
      const text = lang === "es" ? "Hola, así suena el entrevistador. Si está muy fuerte, bajá el volumen." : "Hi, this is how the interviewer sounds. If it's too loud, turn the volume down."
      const { audio_url } = await api.tts(text, lang, "interviewer")
      await playUrl(audio_url).done
    } catch { /* no voice available */ }
    setTesting(false)
  }
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-3">
      <div className="flex items-center gap-3">
        <Label htmlFor="vol" className="w-20 shrink-0 text-sm">Volumen</Label>
        <input id="vol" type="range" min={0.1} max={1} step={0.05} value={volume} onChange={(e) => onVolume(Number(e.target.value))}
          className="w-full accent-[var(--color-primary)]" aria-valuetext={`${Math.round(volume * 100)} por ciento`} />
        <span className="w-10 text-right font-mono text-xs tabular-nums">{Math.round(volume * 100)}%</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="w-20 shrink-0 text-sm" id="rate-label">Velocidad</span>
        <RadioGroup value={String(rate)} onValueChange={(v) => onRate(Number(v))} className="flex flex-wrap gap-4" aria-labelledby="rate-label">
          {RATES.map((r) => (
            <div key={r.v} className="flex items-center gap-2"><RadioGroupItem id={`rate-${r.v}`} value={String(r.v)} /><Label htmlFor={`rate-${r.v}`} className="text-sm">{r.label}</Label></div>
          ))}
        </RadioGroup>
      </div>
      <Button variant="outline" size="sm" className="w-fit" onClick={test} disabled={testing}>{testing ? "Reproduciendo…" : "Probar la voz"}</Button>
      <p className="text-xs text-muted-foreground">La velocidad no cambia el tono de la voz. El audio ya viene con margen para no saturar los parlantes.</p>
    </div>
  )
}

function SettingSwitch({ id, label, hint, checked, onChange }: { id: string; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
