import { useCallback, useEffect, useRef, useState } from "react"
import { readSettings } from "./settings"

// Micrófono

export type MicError = "NotAllowedError" | "NotFoundError" | "NotReadableError" | "Timeout" | "Unknown"

export const MIC_ERROR_TEXT: Record<MicError, { title: string; body: string }> = {
  NotAllowedError: {
    title: "El navegador bloqueó el micrófono",
    body: "Hacé clic en el ícono de candado o de micrófono en la barra de direcciones, permití el acceso para este sitio y volvé a probar.",
  },
  NotFoundError: { title: "No encontramos un micrófono", body: "Conectá un micrófono o auriculares con micrófono y volvé a probar." },
  NotReadableError: {
    title: "El micrófono está ocupado",
    body: "Otra app lo está usando (Meet, Zoom, otra pestaña) o el sistema lo bloquea. Cerrala o revisá Ajustes del Sistema → Privacidad → Micrófono.",
  },
  Timeout: { title: "No respondiste el permiso", body: "El navegador está esperando que aceptes el acceso al micrófono. Buscá el aviso arriba a la izquierda." },
  Unknown: { title: "No pudimos abrir el micrófono", body: "Probá recargar la página. Si sigue, revisá los permisos del navegador." },
}

/**
 * Sin procesamiento de llamada: con cancelación de eco / AGC activos, Chrome en macOS pasa el audio a "modo
 * llamada" y procesa también lo que sale por los parlantes (bombeo, golpes); con auriculares Bluetooth con
 * micrófono, además baja a calidad telefónica. No hace falta: nunca grabamos mientras habla el entrevistador.
 */
export async function openMic(timeoutMs = 20000): Promise<MediaStream> {
  const p = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
  const t = new Promise<never>((_, rej) => setTimeout(() => rej(Object.assign(new Error("timeout"), { name: "Timeout" })), timeoutMs))
  try {
    return await Promise.race([p, t])
  } catch (e) {
    const name = (e as Error).name as MicError
    throw Object.assign(new Error(name), { micError: (name in MIC_ERROR_TEXT ? name : "Unknown") as MicError })
  }
}

// Medidor de nivel

/** Nivel del micrófono en dBFS (aprox.) muestreado ~20 veces por segundo. */
export function useLevel(stream: MediaStream | null) {
  const [db, setDb] = useState(-100)
  useEffect(() => {
    if (!stream) return
    const ctx = new AudioContext()
    const src = ctx.createMediaStreamSource(stream)
    const an = ctx.createAnalyser()
    an.fftSize = 1024
    src.connect(an)
    const buf = new Float32Array(an.fftSize)
    let raf = 0
    let last = 0
    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop)
      if (ts - last < 50) return
      last = ts
      an.getFloatTimeDomainData(buf)
      let sum = 0
      for (const v of buf) sum += v * v
      setDb(20 * Math.log10(Math.sqrt(sum / buf.length) + 1e-9))
    }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); src.disconnect(); ctx.close() }
  }, [stream])
  return db
}

// Grabador

export interface Recording { blob: Blob; filename: string; durationS: number }

function pickMime(): string {
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) if (MediaRecorder.isTypeSupported(m)) return m
  return ""
}

/**
 * Grabador con medición de silencio. `silenceS`: segundos desde la última vez que hubo voz
 * (o desde el inicio si todavía no hablaste) → para el "¿Te ayudo?" sin cortar la grabación.
 */
export function useRecorder(stream: MediaStream | null) {
  const rec = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const started = useRef(0)
  const lastVoice = useRef(0)
  const noise = useRef(-60)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [silenceS, setSilenceS] = useState(0)
  const [spoke, setSpoke] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const level = useLevel(stream)

  useEffect(() => {
    if (!recording) {
      noise.current = Math.min(noise.current * 0.98 + level * 0.02, -30)   // piso de ruido entre grabaciones
      return
    }
    const now = performance.now()
    const voice = level > Math.max(noise.current + 12, -55)
    if (voice) {
      lastVoice.current = now
      if (!spoke) setSpoke(true)
    }
    // "hablando" se sostiene 350 ms tras la última voz para no parpadear entre sílabas
    setSpeaking(voice || (lastVoice.current > 0 && now - lastVoice.current < 350))
    setElapsed((now - started.current) / 1000)
    setSilenceS((now - (lastVoice.current || started.current)) / 1000)
  }, [level, recording, spoke])

  const start = useCallback((override?: MediaStream | null) => {
    const st = override ?? stream
    if (!st) return
    const mime = pickMime()
    const r = new MediaRecorder(st, mime ? { mimeType: mime } : undefined)
    chunks.current = []
    r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data) }
    r.start(250)
    rec.current = r
    started.current = performance.now()
    lastVoice.current = 0
    setSpoke(false)
    setElapsed(0)
    setSilenceS(0)
    setRecording(true)
  }, [stream])

  const stop = useCallback(
    () =>
      new Promise<Recording | null>((resolve) => {
        const r = rec.current
        if (!r || r.state === "inactive") return resolve(null)
        r.onstop = () => {
          const type = r.mimeType || "audio/webm"
          const ext = type.includes("mp4") ? "m4a" : "webm"
          resolve({ blob: new Blob(chunks.current, { type }), filename: `answer.${ext}`, durationS: (performance.now() - started.current) / 1000 })
        }
        r.stop()
        setRecording(false)
      }),
    [],
  )

  const discard = useCallback(() => {
    const r = rec.current
    if (r && r.state !== "inactive") { r.onstop = null; r.stop() }
    chunks.current = []
    setRecording(false)
  }, [])

  return { start, stop, discard, recording, elapsed, silenceS, spoke, speaking: recording && speaking, level }
}

// Reproducción

/** Aplica volumen y velocidad elegidos por el usuario (la velocidad no cambia el tono). */
export function applyVoicePrefs(audio: HTMLAudioElement) {
  const s = readSettings()
  audio.volume = Math.min(1, Math.max(0, s.voiceVolume))
  audio.defaultPlaybackRate = s.voiceRate
  audio.playbackRate = s.voiceRate
  audio.preservesPitch = true
}

/** Reproduce un audio y resuelve al terminar (o al fallar). Devuelve el elemento para controles. */
export function playUrl(url: string, el?: HTMLAudioElement): { audio: HTMLAudioElement; done: Promise<void> } {
  const audio = el ?? new Audio()
  audio.src = url
  applyVoicePrefs(audio)
  const done = new Promise<void>((resolve) => {
    audio.onended = () => resolve()
    audio.onerror = () => resolve()
    audio.play().catch(() => resolve())
  })
  return { audio, done }
}

/** Sonido suave cuando se abre el micrófono (Google Conversation Design: avisar que ya podés hablar). */
export function chime() {
  try {
    const ctx = new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = "sine"
    o.frequency.value = 660
    g.gain.setValueAtTime(0.0001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.03)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35)
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.4)
    o.onended = () => ctx.close()
  } catch { /* sin audio */ }
}

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`

// Nivel de lo que suena (entrevistador)

const sources = new WeakMap<HTMLAudioElement, { ctx: AudioContext; an: AnalyserNode }>()

/**
 * Amplitud 0–1 de lo que está sonando en un <audio> (AnalyserNode, Baseline desde 2015). Con esto el indicador de
 * "hablando" se mueve con la voz REAL y se detiene en silencio (WCAG 2.2.2: nada de pulsos infinitos decorativos).
 */
export function useOutputLevel(audio: HTMLAudioElement | null, active: boolean) {
  const [level, setLevel] = useState(0)
  useEffect(() => {
    if (!audio || !active) { setLevel(0); return }
    let entry = sources.get(audio)
    try {
      if (!entry) {
        const ctx = new AudioContext()
        const src = ctx.createMediaElementSource(audio)
        const an = ctx.createAnalyser()
        an.fftSize = 512
        src.connect(an)
        an.connect(ctx.destination)
        entry = { ctx, an }
        sources.set(audio, entry)
      }
    } catch { return }
    if (entry.ctx.state === "suspended") entry.ctx.resume().catch(() => {})
    const buf = new Float32Array(entry.an.fftSize)
    let raf = 0, last = 0
    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop)
      if (ts - last < 33) return
      last = ts
      entry!.an.getFloatTimeDomainData(buf)
      let sum = 0
      for (const v of buf) sum += v * v
      setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 6))
    }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); setLevel(0) }
  }, [audio, active])
  return level
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
}
