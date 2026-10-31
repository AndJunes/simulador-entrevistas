import { useCallback, useState } from "react"
import type { Lang, Stage } from "./api"

// Selection-panel preferences. Remembered in this browser (convenience, not critical data).
export interface Settings {
  lang: Lang
  voice: boolean          // the interviewer speaks and the summary is played
  autostart: boolean      // recording starts automatically when the question ends (measures latency)
  showQuestion: boolean   // video call: question visible or hidden
  stage: Stage            // mock: which interview stage (recruiter, technical, behavioral/client)
  mixed: boolean          // mock: starts in Spanish and switches to English (if the role requires it)
  hintsOff: boolean       // practice: no hints before answering
  devFile: boolean        // test mode: use an audio file instead of the microphone
  voiceVolume: number     // 0–1 · voice volume (protects the speakers)
  voiceRate: number       // voice rate (without changing pitch)
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
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* storage unavailable */ }
      return next
    })
  }, [])
  return [settings, set] as const
}

export function readSettings(): Settings {
  return load()
}
