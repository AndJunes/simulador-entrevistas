import type { Application, Priority, ProgressDay, Question, Requirement } from "./api"

/**
 * "Tu próximo paso": regla DETERMINISTA con datos reales (sin porcentajes inventados). Gana el primer nivel que aplica.
 *  N0 estado de la postulación · N1 primer requisito sin practicar (obligatorios sin evidencia primero) ·
 *  N2 competencia obligatoria con última nota ≤3 · N3 ejercicio pendiente · N4 simulacro de la primera etapa.
 */
export type NextStep =
  | { level: "N0"; kind: "generating" | "error" | "no_questions"; title: string; reason: string }
  | { level: "N1" | "N2"; kind: "question"; title: string; reason: string; qid: string; requirement?: Requirement; minutes: number; seconds: [number, number] }
  | { level: "N3"; kind: "exercise"; title: string; reason: string; qid: string; minutes: number }
  | { level: "N4"; kind: "mock"; title: string; reason: string; stage: string; minutes: number }

export const FEEDBACK_S = 40   // devolución medida (~40 s)

const PRIO: Record<Priority, number> = { must_have: 0, important: 1, nice_to_have: 2 }
const COV: Record<string, number> = { gap: 0, partial: 1, strong: 2 }
export const EVIDENCE_LABEL: Record<string, string> = { gap: "Sin evidencia", partial: "Evidencia parcial", strong: "Evidencia fuerte" }
export const PRIORITY_SHORT: Record<Priority, string> = { must_have: "Obligatorio", important: "Importante", nice_to_have: "Deseable" }

const rnum = (r: Requirement) => Number(r.id.slice(1)) || 99

/** Orden de lectura de los requisitos (posición serial): obligatorio sin evidencia → parcial → fuerte → importante → deseable. */
export function requirementOrder(a: Requirement, b: Requirement): number {
  const pa = PRIO[a.priority ?? "important"], pb = PRIO[b.priority ?? "important"]
  if (pa !== pb) return pa - pb
  const ca = COV[a.coverage ?? "partial"], cb = COV[b.coverage ?? "partial"]
  if (ca !== cb) return ca - cb
  return rnum(a) - rnum(b)
}

/** Competencias con al menos una evaluación y su última nota. */
export function practiceState(days: ProgressDay[]): { practiced: Set<string>; last: Record<string, number> } {
  const practiced = new Set<string>(), last: Record<string, number> = {}
  for (const d of days) for (const [k, v] of Object.entries(d.competencies ?? {})) {
    if (v.avg != null) { practiced.add(k); last[k] = v.avg }
  }
  return { practiced, last }
}

export function questionsFor(r: Requirement, qs: Question[]): Question[] {
  return qs.filter((q) => (q.source_refs ?? []).includes(r.id) && q.format !== "exercise")
}

const minutesFor = (q: Question) => Math.max(1, Math.ceil((q.duration[1] + FEEDBACK_S) / 60))

export function nextStep(a: Pick<Application, "status" | "requirements" | "questions" | "blueprints">, days: ProgressDay[],
  opts: { exerciseDone: boolean }): NextStep {
  if (a.status === "generating") return { level: "N0", kind: "generating", title: "Estamos armando tu entrevista", reason: "Analizamos el puesto y tu CV, y validamos cada pregunta." }
  if (a.status === "error") return { level: "N0", kind: "error", title: "No pudimos generar las preguntas", reason: "Podés reintentar la generación." }
  if (!a.questions.length) return { level: "N0", kind: "no_questions", title: "Todavía no hay preguntas", reason: "Generá el banco de preguntas para empezar a practicar." }

  const { practiced, last } = practiceState(days)
  const reqs = a.requirements.filter((r) => r.kind !== "language" && r.kind !== "logistics")
  const groups = [
    reqs.filter((r) => r.priority === "must_have" && r.coverage !== "strong"),
    reqs.filter((r) => r.priority === "important" && r.coverage !== "strong"),
    reqs.filter((r) => r.priority === "must_have" && r.coverage === "strong"),
    reqs.filter((r) => !(r.priority === "must_have" || (r.priority === "important" && r.coverage !== "strong"))),
  ].map((g) => [...g].sort(requirementOrder))

  for (const g of groups) for (const r of g) {
    const q = questionsFor(r, a.questions).find((x) => !practiced.has(x.primary_competency))
    if (q) {
      return { level: "N1", kind: "question", qid: q.id, requirement: r, minutes: minutesFor(q), seconds: q.duration,
        title: `Practicá: ${r.text}`,
        reason: `${PRIORITY_SHORT[r.priority ?? "important"]} · ${EVIDENCE_LABEL[r.coverage ?? "partial"]}${r.gap ? `: ${r.gap}` : ""}` }
    }
  }

  const weak = a.questions
    .filter((q) => q.priority === "must_have" && q.format !== "exercise" && last[q.primary_competency] != null && last[q.primary_competency] <= 3)
    .sort((x, y) => last[x.primary_competency] - last[y.primary_competency])[0]
  if (weak) {
    return { level: "N2", kind: "question", qid: weak.id, minutes: minutesFor(weak), seconds: weak.duration,
      title: `Reintentá: ${weak.competency_label}`, reason: `Tu última respuesta en esta competencia tuvo ${Math.round(last[weak.primary_competency])}/5.` }
  }

  const ex = a.questions.find((q) => q.format === "exercise" && q.exercise)
  if (ex && !opts.exerciseDone) {
    return { level: "N3", kind: "exercise", qid: ex.id, minutes: ex.exercise!.minutes, title: "Hacé un ejercicio práctico",
      reason: `${ex.competency_label}: una tarea escrita parecida al trabajo real.` }
  }

  const st = a.blueprints.find((b) => b.stage !== "work_sample")
  return { level: "N4", kind: "mock", stage: st?.stage ?? "recruiter_screen", minutes: Math.round(st?.est_minutes ?? 15),
    title: `Hacé un simulacro: ${st?.label ?? "entrevista"}`, reason: "Ya practicaste las competencias clave por separado: ahora, de corrido." }
}
