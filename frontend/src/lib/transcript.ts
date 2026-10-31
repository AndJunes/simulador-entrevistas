import type { Transcript, Word } from "./api"

const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}%']/gu, "")

/**
 * Words of an answer. Voice brings per-word timestamps (STT); a written answer, or a report that
 * only stores the text, doesn't: then the text is tokenized so quotes can still be anchored. `timed` says whether the
 * indices work for time-dependent metrics (pauses, fillers, low confidence).
 */
export function answerWords(t?: Transcript | null): { words: Word[]; timed: boolean } {
  if (t?.words?.length) return { words: t.words, timed: true }
  const words = (t?.text ?? "").split(/\s+/).filter(Boolean).map((word) => ({ word, start_s: 0, end_s: 0, prob: 1 }))
  return { words, timed: false }
}

/** Locates an evaluator quote in the answer: exact match, else by the first 3 words. */
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
