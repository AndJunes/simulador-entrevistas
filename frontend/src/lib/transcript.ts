import type { Transcript, Word } from "./api"

const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}%']/gu, "")

/**
 * Palabras de una respuesta. La voz trae marcas de tiempo por palabra (STT); una respuesta escrita, o un informe que
 * solo guarda el texto, no: en ese caso se tokeniza el texto para poder ubicar las citas igual. `timed` indica si los
 * índices sirven para métricas que dependen del tiempo (pausas, muletillas, baja confianza).
 */
export function answerWords(t?: Transcript | null): { words: Word[]; timed: boolean } {
  if (t?.words?.length) return { words: t.words, timed: true }
  const words = (t?.text ?? "").split(/\s+/).filter(Boolean).map((word) => ({ word, start_s: 0, end_s: 0, prob: 1 }))
  return { words, timed: false }
}

/** Ubica una cita del evaluador en la respuesta: coincidencia exacta y, si no, por las primeras 3 palabras. */
export function anchor(words: { word: string }[], quote: string): [number, number] | null {
  const W = words.map((w) => norm(w.word))
  const Q = quote.split(/\s+/).map(norm).filter(Boolean)
  if (!Q.length) return null
  for (let i = 0; i + Q.length <= W.length; i++) {
    let ok = true
    for (let k = 0; k < Q.length; k++) if (W[i + k] !== Q[k]) { ok = false; break }
    if (ok) return [i, i + Q.length - 1]
  }
  const head = Q.slice(0, Math.min(3, Q.length))
  for (let i = 0; i + head.length <= W.length; i++) {
    if (head.every((h, k) => W[i + k] === h)) return [i, Math.min(W.length - 1, i + Q.length - 1)]
  }
  return null
}
