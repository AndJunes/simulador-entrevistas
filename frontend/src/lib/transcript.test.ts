import { describe, expect, it } from "vitest"
import { anchor, answerWords } from "./transcript"

const written = { text: "Lo resolví con una restricción única en la base y una transacción.", words: [] }

describe("answerWords", () => {
  it("usa las palabras con marcas de tiempo cuando existen", () => {
    const w = [{ word: "Hola", start_s: 0, end_s: 0.4, prob: 0.9 }]
    expect(answerWords({ text: "Hola", words: w })).toEqual({ words: w, timed: true })
  })
  it("tokeniza el texto de una respuesta escrita", () => {
    const r = answerWords(written)
    expect(r.timed).toBe(false)
    expect(r.words.map((x) => x.word)).toEqual(["Lo", "resolví", "con", "una", "restricción", "única", "en", "la", "base", "y", "una", "transacción."])
  })
  it("sin transcripción devuelve una lista vacía", () => {
    expect(answerWords(null)).toEqual({ words: [], timed: false })
  })
})

describe("anchor", () => {
  const { words } = answerWords(written)
  it("ubica una cita exacta en una respuesta escrita, ignorando mayúsculas y puntuación", () => {
    expect(anchor(words, "lo resolví con una restricción única")).toEqual([0, 5])
    expect(anchor(words, "una transacción")).toEqual([10, 11])
  })
  it("si la cita no es literal, la ubica por sus primeras palabras", () => {
    expect(anchor(words, "restricción única en la tabla de turnos")).toEqual([4, 10])
  })
  it("devuelve null si la cita no está en la respuesta", () => {
    expect(anchor(words, "cero turnos duplicados")).toBeNull()
  })
})
