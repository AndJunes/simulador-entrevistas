import { useCallback, useEffect, useRef, useState } from "react"
import { readSettings } from "./settings"

// Microphone

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
 * No call processing: with echo cancellation / AGC on, Chrome on macOS switches the audio to "call
 * mode" and also processes what comes out of the speakers (pumping, thumps); with Bluetooth headphones with
 * a mic it also drops to phone quality. Unnecessary: we never record while the interviewer speaks.
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

// Level meter

/** Mic level in dBFS (approx.) sampled ~20 times per second. */
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

// Recorder

export interface Recording { blob: Blob; filename: string; durationS: number }

function pickMime(): string {
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) if (MediaRecorder.isTypeSupported(m)) return m
  return ""
}

/**
 * Recorder with silence measurement. `silenceS`: seconds since voice was last heard
 * (or since the start if you haven't spoken yet) → for the "¿Te ayudo?" prompt without cutting the recording.
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
      noise.current = Math.min(noise.current * 0.98 + level * 0.02, -30)   // noise floor between recordings
      return
    }
    const now = performance.now()
    const voice = level > Math.max(noise.current + 12, -55)
    if (voice) {
      lastVoice.current = now
      if (!spoke) setSpoke(true)
    }
    // "speaking" holds for 350 ms after the last voice so it doesn't flicker between syllables
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

// Playback

/** Applies the user's chosen volume and rate (rate doesn't change pitch). */
export function applyVoicePrefs(audio: HTMLAudioElement) {
  const s = readSettings()
  audio.volume = Math.min(1, Math.max(0, s.voiceVolume))
  audio.defaultPlaybackRate = s.voiceRate
  audio.playbackRate = s.voiceRate
  audio.preservesPitch = true
}

/** Plays an audio and resolves when it ends (or fails). Returns the element for controls. */
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

/** Soft chime when the mic opens (Google Conversation Design: signal that you can speak now). */
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
  } catch { /* no audio */ }
}

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`

// Output level (interviewer)

const sources = new WeakMap<HTMLAudioElement, { ctx: AudioContext; an: AnalyserNode }>()

/**
 * 0–1 amplitude of what's playing in an <audio> (AnalyserNode, Baseline since 2015). With this the
 * "speaking" indicator moves with the REAL voice and stops in silence (WCAG 2.2.2: no infinite decorative pulses).
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
