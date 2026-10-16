import { describe, expect, it } from "vitest"
import type { Application, ProgressDay, Question, Requirement } from "./api"
import { nextStep, requirementOrder } from "./nextStep"

const q = (id: string, comp: string, refs: string[], extra: Partial<Question> = {}): Question => ({
  id, text_es: id, text_en: id, type: "technical", stage: "technical_screen", format: "technical_knowledge",
  primary_competency: comp, competency_label: comp, priority: "must_have", difficulty: "intermediate",
  evidence_mode: "explanatory_knowledge", duration: [60, 120], pitch: false, followup: true, source_refs: refs, ...extra,
})
const r = (id: string, priority: Requirement["priority"], coverage: Requirement["coverage"], kind: Requirement["kind"] = "technical"): Requirement =>
  ({ id, text: `req ${id}`, cv_evidence: "", gap: "falta algo", priority, coverage, kind })

const base = (over: Partial<Application> = {}) => ({
  status: "ready" as const, blueprints: [{ stage: "recruiter_screen" as const, label: "Recruiter screen", minutes: [15, 20] as [number, number], est_minutes: 13, question_ids: [], english_check: true }],
  requirements: [r("R1", "must_have", "partial"), r("R2", "must_have", "gap"), r("R3", "must_have", "strong"), r("R4", "important", "gap"), r("R5", "must_have", "gap", "language")],
  questions: [q("Q1", "python", ["R1"]), q("Q2", "async", ["R2"]), q("Q3", "api", ["R3"]), q("Q4", "rag", ["R4"]),
    q("Q9", "ex", ["R2"], { format: "exercise", exercise: { brief: "b", deliverable: "", criteria: [], constraints: [], reference_facts: [], minutes: 30 } })],
  ...over,
})
const day = (comps: Record<string, number>): ProgressDay => ({ day: "2026-10-15", answers: 1, first_word_latency_s: null, wpm: null,
  fillers_per_min: null, in_range_pct: null, criteria: {}, competencies: Object.fromEntries(Object.entries(comps).map(([k, v]) => [k, { avg: v, levels: [] }])) })

describe("nextStep", () => {
  it("N0 mientras se genera", () => {
    expect(nextStep(base({ status: "generating" }), [], { exerciseDone: false }).level).toBe("N0")
  })
  it("N1: obligatorio sin evidencia primero (R2 antes que R1), ignora idioma", () => {
    const s = nextStep(base(), [], { exerciseDone: false })
    expect(s.level).toBe("N1")
    if (s.kind === "question") { expect(s.qid).toBe("Q2"); expect(s.reason).toMatch(/Obligatorio · Sin evidencia/); expect(s.minutes).toBe(3) }
  })
  it("N1 salta lo ya practicado: después de async va python (obligatorio parcial)", () => {
    const s = nextStep(base(), [day({ async: 4 })], { exerciseDone: false })
    expect(s.kind === "question" && s.qid).toBe("Q1")
  })
  it("orden: obligatorio(gap, partial) → importante(gap) → obligatorio fuerte", () => {
    const s1 = nextStep(base(), [day({ async: 4, python: 4 })], { exerciseDone: false })
    expect(s1.kind === "question" && s1.qid).toBe("Q4")
    const s2 = nextStep(base(), [day({ async: 4, python: 4, rag: 4 })], { exerciseDone: false })
    expect(s2.kind === "question" && s2.qid).toBe("Q3")
  })
  it("N2: todo practicado → la competencia obligatoria más floja (≤3)", () => {
    const s = nextStep(base(), [day({ async: 2, python: 4, rag: 4, api: 3 })], { exerciseDone: false })
    expect(s.level).toBe("N2")
    expect(s.kind === "question" && s.qid).toBe("Q2")
  })
  it("N3 ejercicio y N4 simulacro", () => {
    const all = [day({ async: 4, python: 4, rag: 4, api: 4 })]
    expect(nextStep(base(), all, { exerciseDone: false }).level).toBe("N3")
    const s = nextStep(base(), all, { exerciseDone: true })
    expect(s.level).toBe("N4")
    expect(s.kind === "mock" && s.minutes).toBe(13)
  })
  it("requirementOrder ordena por prioridad, evidencia y número", () => {
    const sorted = base().requirements.slice(0, 4).sort(requirementOrder).map((x) => x.id)
    expect(sorted).toEqual(["R2", "R1", "R3", "R4"])
  })
})
