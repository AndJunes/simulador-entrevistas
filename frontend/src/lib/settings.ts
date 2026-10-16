import { useCallback, useState } from "react"
import type { Lang, Stage } from "./api"

// Preferencias del panel de selección. Se recuerdan en este navegador (comodidad, no datos críticos).
export interface Settings {
  lang: Lang
  voice: boolean          // el entrevistador habla y el resumen se reproduce
  autostart: boolean      // la grabación arranca sola al terminar la pregunta (mide la latencia)
  showQuestion: boolean   // videollamada: pregunta visible u oculta
  stage: Stage            // simulacro: qué etapa de la entrevista (recruiter, técnica, conductual/cliente)
  mixed: boolean          // simulacro: arranca en español y pasa a inglés (si el rol lo pide)
  hintsOff: boolean       // práctica: sin pistas antes de responder
  devFile: boolean        // modo prueba: usar un archivo de audio en lugar del micrófono
  voiceVolume: number     // 0–1 · volumen de la voz (protege los parlantes)
  voiceRate: number       // velocidad de la voz (sin cambiar el tono)
}

const DEFAULTS: Settings = { lang: "es", voice: true, autostart: true, showQuestion: false, stage: "recruiter_screen", mixed: false, hintsOff: false, devFile: false, voiceVolume: 0.7, voiceRate: 1.15 }
const KEY = "simulador.settings.v1"

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function useSettings() {
  const [settings, setState] = useState<Settings>(load)
  const set = useCallback(<K extends keyof Settings>(k: K, v: Settings[K]) => {
    setState((s) => {
      const next = { ...s, [k]: v }
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* almacenamiento no disponible */ }
      return next
    })
  }, [])
  return [settings, set] as const
}

export function readSettings(): Settings {
  return load()
}
