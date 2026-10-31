// API client (proxy /api → FastAPI). Types aligned with backend/app.

export type Lang = "es" | "en"
export type QType = "star" | "screening" | "closing" | "technical" | "logistics" | "exercise"
export type Mode = "practice" | "mock" | "videocall" | "exercise"
export type MockLang = Lang | "mix"
export type Stage = "recruiter_screen" | "technical_screen" | "behavioral_client" | "work_sample"
export type QFormat = "biographical" | "motivation" | "behavioral" | "situational" | "technical_knowledge" | "debugging" | "design" | "exercise" | "logistics"
export type Priority = "must_have" | "important" | "nice_to_have"
export type EvidenceLevel = "profesional" | "proyecto" | "academico_hackathon" | "teorico" | "ninguna"

export interface ExerciseSpec { brief: string; deliverable: string; criteria: string[]; constraints: string[]; reference_facts: string[]; minutes: number }
export interface FollowupPolicy { triggers: { if_missing: string; ask: string }[]; max_followups: number; skip_if_covered: boolean }
export interface Hints { structure: string; cv_examples: string[]; watch_out: string }

/** A bank question. In the mock view (view=mock) the private fields are omitted. */
export interface Question {
  id: string
  text_es: string
  text_en: string
  type: Exclude<QType, "closing">
  stage: Stage
  format: QFormat
  primary_competency: string
  competency_label: string
  priority: Priority
  difficulty: "basic" | "intermediate" | "advanced"
  evidence_mode: "past_behavior" | "explanatory_knowledge" | "live_execution" | "situational_judgment"
  duration: [number, number]
  pitch: boolean
  followup: boolean
  // private (coach / editor)
  guidance?: string
  hints?: Hints
  objective?: string
  relevance?: string
  expected_evidence?: string[]
  weak_indicators?: string[]
  followup_policy?: FollowupPolicy
  candidate_evidence_ids?: string[]
  known_gaps?: string[]
  source_refs?: string[]
  secondary_competencies?: string[]
  confidence?: number | null
  validation?: { score: number | null; issues: string[]; critic?: Record<string, number | null> | null }
  approved?: boolean
  exercise?: ExerciseSpec | null
}

export interface StageInfo { stage: Stage; label: string; minutes: [number, number]; est_minutes: number; question_ids: string[]; english_check: boolean; competencies?: { id: string; label: string; priority: Priority }[] }

export interface Interview { title?: string; company?: string; type?: string | null; with?: string | null; when?: string | null; evaluates?: string | null; language?: string | null }

export interface Context {
  id: string
  title: string
  company: string
  candidate: string
  interview: Interview
  questions: Question[]
  view: "coach" | "mock"
  stages: StageInfo[]
  interview_stages: Stage[]
  exercises: string[]
  english_required: boolean
  stage_labels: Record<Stage, string>
  format_labels: Record<QFormat, string>
  criteria_labels: Record<string, string>
  status: { rag: unknown; stt: string }
}

export interface Source { kind: "file" | "text" | "url"; name?: string }
export interface Requirement {
  id: string; text: string; cv_evidence: string; gap?: string
  kind?: "technical" | "soft" | "experience" | "language" | "education" | "logistics"
  competency?: string; competency_label?: string; priority?: Priority; coverage?: "strong" | "partial" | "gap"
  evidence_ids?: string[]; source_quote?: string
}
export interface EvidenceItem {
  id: string; title: string; kind: "professional" | "freelance" | "project" | "academic" | "hackathon" | "volunteer"
  org: string; dates: string; technologies: string[]; responsibilities: string[]; achievements: string[]; quote: string
}
export interface CompanyFact { fact: string; source_quote: string; confidence: "alta" | "media" | "baja" }
export interface GenerationReport {
  version?: string; cost_usd?: number; candidates?: number; selected?: number
  discarded?: { slot_id: string; text_en: string; score: number; issues: string[] }[]
  duplicates_removed?: { text_en: string; dup_of: string }[]
  coverage?: { must_have_total: number; covered: string[]; uncovered: string[]; matrix: Record<string, string[]> }
  issues?: Record<string, string[]>
}
export interface AppSummary {
  id: string; title: string; company: string; status: "draft" | "generating" | "ready" | "error"; error: string | null
  candidate_name: string; interview: Interview; questions: number; created_at: string; updated_at: string
  counts: { practice?: number; mock?: number; videocall?: number; last?: string }
}
export interface Application extends Omit<AppSummary, "questions"> {
  cv_md: string; job_md: string; cv_source: Source; job_source: Source
  requirements: Requirement[]; questions: Question[]; glossary: string[]
  analysis: { seniority?: string; role_family?: string; is_technical?: boolean; english_required?: boolean; language_notes?: string
    responsibilities?: string[]; conditions?: string[]; ambiguities?: string[]; professional_summary?: string
    cv_ambiguities?: string[]; years_vs_competence?: string }
  evidence: EvidenceItem[]; blueprints: StageInfo[]; company_facts: CompanyFact[]
  generation_report: GenerationReport; generator_version: string
}
export interface Ingested { markdown: string; source: Source; warnings: string[] }

export interface Word { word: string; start_s: number; end_s: number; prob: number }
export interface Transcript { text: string; words: Word[]; language?: string }

export interface Metrics {
  first_word_latency_s: number
  speech_duration_s: number
  duration_target_s: [number, number]
  duration_target_source: string[] | string | null
  duration_status: "corta" | "larga" | "en rango"
  words: number
  wpm: number
  long_pause_threshold_s: number
  long_pauses: { at_s: number; dur_s: number }[]
  fillers: Record<string, number>
  filled_pauses: Record<string, number>
  markers_overused: Record<string, number>
  filler_word_idx: number[]
  fillers_per_min: number
  repetitions: string[]
  stretched_words: string[]
  low_confidence_idx: number[]
  mic_level_db: number | null
}

export interface Criterion { id: string; label: string; score: number; applicable?: boolean; evidence_quote: string; justification: string; missing: string; ideal: string }
export interface CompetencyScore { id: string; label: string; score: number; evidence_level: EvidenceLevel; confidence: "alta" | "media" | "baja"; rationale: string; scored?: boolean; evidence_source?: "ejercicio" | "respuesta" }
export interface EvidenceCheck { expected: string; status: "demostrado" | "parcial" | "no_demostrado"; quote: string }
export interface ExperienceClaim { claim: string; level: EvidenceLevel; quote: string }
export interface Annotation { quote: string; kind: "bien" | "mejorar"; comment: string; fix: string }
export interface Improvement { issue: string; why: string; example: string }
export interface EvaluationBody {
  feed_up: string
  criteria: Criterion[]
  job_requirements_addressed: string[]
  job_requirements_missed: string[]
  unsupported_claims_vs_cv: string[]
  red_flags: string[]
  strengths: string[]
  improvements: Improvement[]
  annotations: Annotation[]
  model_answer: string
  spoken_summary: string
  confidence: "alta" | "media" | "baja"
  // explainable evaluation (old evaluations lack these)
  competency?: CompetencyScore
  secondary_competencies?: CompetencyScore[]
  evidence_check?: EvidenceCheck[]
  experience_claims?: ExperienceClaim[]
  facts?: string[]
  inferences?: string[]
  not_demonstrated?: string[]
  provisional_assessment?: string
  next_practice_followup?: string
  recommended_exercise?: string
  uncertainty?: string
}
export interface Evaluation {
  ok: boolean
  evaluation: EvaluationBody
  latency_s: number
  cost_usd: number
  rubric_sourced: boolean
  retrieved_chunks: string[]
}

export interface Coaching {
  coaching: {
    calm_down: string
    buy_time_phrases: string[]
    approach: string
    cv_examples: { title: string; why_it_fits: string }[]
    skeleton: string[]
    if_you_truly_dont_know: string
    spoken_summary: string
  }
  reason: string
}

export interface Comparison {
  metrics: Record<string, [number | null, number | null]>
  criteria: Record<string, [number | null, number]>
  competency?: { id: string; label: string; scores: [number | null, number]; levels: [EvidenceLevel | null, EvidenceLevel | null] }
}

export type StageEvent =
  | { stage: "received" | "done" | "cancelled" | "waiting_evaluations"; t: number }
  | { stage: "transcribing" | "evaluating" | "coaching_started" | "writing_report" | "reading" | "generating" | "saving"
      | "analyzing_job" | "extracting_evidence" | "mapping" | "designing" | "validating"; t: number; eta_s?: number; reason?: string }
  | { stage: "transcribed"; t: number; transcript: Transcript; metrics: Metrics; low_conf_words: string[] }
  | { stage: "evaluated"; t: number; evaluation: Evaluation; comparison: Comparison | null }
  | { stage: "coaching"; t: number; coaching: Coaching }
  | { stage: "tts_ready"; t: number; audio_url: string }
  | { stage: "tts_failed"; t: number; message: string }
  | { stage: "progress"; t: number; done: number; total: number }
  | { stage: "error"; t: number; message: string; code?: string; mic_level_db?: number }
  | { stage: "done"; t: number; report?: MockReport }

export interface Pending { qid: string; text: string; type: QType; is_followup: boolean; parent: string; lang?: Lang; followup_n?: number; followup_max?: number }
export interface MockStep {
  session_id?: string
  say: string
  audio_url: string | null
  pending?: Pending
  done: boolean
  progress: { index: number; total: number }
  transcript?: string
  turn_id?: string
  stage?: Stage
  minutes?: number
}

export interface FollowupDecision { after: number; ask: boolean; reason: string; skip_reason: string; question: string; missing: string[] }
export interface ReportTurn {
  qid: string; question: string; type: QType; is_followup: boolean; turn_id: string; lang?: Lang
  transcript: string; metrics: Metrics | null; evaluation: EvaluationBody | null
  followups?: { qid: string; question: string; turn_id: string; transcript: string; flag: "redundant" | "useful" | null }[]
  decisions?: FollowupDecision[]; covered?: string[]; missing?: string[]
}
export interface MockReport {
  llm: {
    summary: string
    strengths: string[]
    patterns: { pattern: string; evidence: string }[]
    actions: { action: string; question_id: string; example: string }[]
    candidate_questions_feedback: string
    spoken_summary: string
    competency_notes?: { competency: string; observed: string; gaps: string; next_action: string }[]
    logistics_alignment?: string
    uncertainty?: string
  }
  aggregates: Aggregates
  previous: Aggregates | null
  turns: ReportTurn[]
  closing?: { qid: string; question: string; turn_id: string; transcript: string }[]
  lang: MockLang
  stage?: Stage
  audio_url?: string
}
export interface Aggregates {
  metrics: { first_word_latency_s: number | null; wpm: number | null; fillers_per_min: number | null; in_range_pct: number | null; long_pauses: number }
  criteria: Record<string, { avg: number | null; label: string }>
  competencies?: Record<string, { label: string; avg: number | null; n: number; evidence_levels: (EvidenceLevel | null)[] }>
}

export interface SessionSummary { id: string; application_id: string | null; mode: Mode; lang: MockLang; status: string; turns: number; created_at: string; has_report: boolean }
export interface TurnRecord {
  id: string; session_id: string; question_id: string; question_text: string; question_type: QType; lang: Lang
  kind: "evaluation" | "coaching"; is_followup: boolean; attempt_of: string | null; status: string; transcript: Transcript | null
  metrics: Metrics | null; evaluation: Evaluation | null; coaching: Coaching | null; audio_url: string | null
  created_at: string; input_mode?: "voice" | "written"; parent_turn_id?: string | null; feedback_rating?: 1 | -1 | null
  followup_flag?: "redundant" | "useful" | null; extra?: { clarifications?: Clarification[]; elapsed_s?: number; decisions?: FollowupDecision[] }
}
export interface Clarification { q: string; a: string; specified: boolean }
export interface SessionDetail { id: string; application_id: string | null; mode: Mode; lang: MockLang; settings?: { stage?: Stage; plan?: unknown[] }; status: string; report: MockReport | null; created_at: string; turns: TurnRecord[] }
export interface ProgressDay {
  day: string; answers: number; first_word_latency_s: number | null; wpm: number | null
  fillers_per_min: number | null; in_range_pct: number | null; criteria: Record<string, number | null>
  competencies?: Record<string, { avg: number | null; levels: (EvidenceLevel | null)[] }>
}

export interface Quality {
  generator: { questions: number; approved_pct: number | null; with_issues_pct: number | null; unsupported_premises: number; multi_part: number
    leading: number; duplicates_removed: number; must_have_coverage_pct: number | null; uncovered: string[]; apps_v2: number; apps_total: number; cost_usd: number }
  interviewer: { main_questions: number; followups: number; followups_per_question: number | null; decisions: number; justified_skips: number
    redundant_pct: number | null; flagged: number; max_per_question: number }
  evaluator: { evaluations: number; unsupported_claims_pct: number | null; confidence: Record<string, number>; evidence_levels: Record<string, number>
    feedback_rated: number; feedback_useful_pct: number | null; retry_competency_delta: number | null; retries: number }
  session_coverage: { session_id: string; stage: Stage | null; planned: number; answered_pct: number | null; must_have_answered_pct: number | null }[]
  evals: { generator: EvalSummary | null; consistency: EvalSummary | null }
}
export interface EvalSummary { file: string; created_at?: string; [k: string]: unknown }

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, init)
  if (!r.ok) {
    let detail = r.statusText
    try { detail = (await r.json()).detail ?? detail } catch { /* no body */ }
    throw new Error(detail)
  }
  return r.json() as Promise<T>
}
const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })

export const api = {
  health: () => req<{ ok: boolean; rag: unknown; stt: string }>("/api/health"),
  // applications
  ingest: (kind: "cv" | "job", input: { file?: File; text?: string; url?: string }) => {
    const fd = new FormData()
    fd.append("kind", kind)
    if (input.file) fd.append("file", input.file, input.file.name)
    if (input.text) fd.append("text", input.text)
    if (input.url) fd.append("url", input.url)
    return req<Ingested>("/api/ingest", { method: "POST", body: fd })
  },
  createApplication: (b: { cv_md: string; job_md: string; cv_source: Source; job_source: Source }) => req<{ id: string }>("/api/applications", json(b)),
  applications: () => req<AppSummary[]>("/api/applications"),
  application: (id: string) => req<Application>(`/api/applications/${id}`),
  patchApplication: (id: string, b: Partial<Pick<Application, "title" | "company" | "candidate_name" | "cv_md" | "job_md" | "cv_source" | "job_source" | "interview" | "questions" | "requirements">>) =>
    req<Application>(`/api/applications/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }),
  regenerate: (id: string) => req<{ id: string }>(`/api/applications/${id}/regenerate`, { method: "POST" }),
  deleteApplication: (id: string) => req<{ deleted: boolean }>(`/api/applications/${id}`, { method: "DELETE" }),
  appContext: (id: string, view: "coach" | "mock" = "coach") => req<Context>(`/api/applications/${id}/context?view=${view}`),
  tts: (text: string, lang: Lang, role: "interviewer" | "coach" = "interviewer") =>
    req<{ audio_url: string }>("/api/tts", json({ text, lang, role })),
  newPracticeSession: (appId: string, lang: Lang, settings: object) => req<{ session_id: string }>("/api/practice/sessions", json({ application_id: appId, lang, settings })),
  submitTurn: (f: { audio?: Blob; filename?: string; text?: string; session_id: string; question_id: string; lang: Lang; help_requested: boolean; attempt_of?: string | null; followup_of?: string | null; followup_text?: string | null }) => {
    const fd = new FormData()
    if (f.audio) fd.append("audio", f.audio, f.filename ?? "answer.webm")
    if (f.text != null) fd.append("text", f.text)
    fd.append("session_id", f.session_id)
    fd.append("question_id", f.question_id)
    fd.append("lang", f.lang)
    fd.append("help_requested", String(f.help_requested))
    if (f.attempt_of) fd.append("attempt_of", f.attempt_of)
    if (f.followup_of && f.followup_text) { fd.append("followup_of", f.followup_of); fd.append("followup_text", f.followup_text) }
    return req<{ turn_id: string }>("/api/practice/turns", { method: "POST", body: fd })
  },
  cancelTurn: (id: string) => req<{ cancelled: boolean }>(`/api/turns/${id}/cancel`, { method: "POST" }),
  turn: (id: string) => req<TurnRecord>(`/api/turns/${id}`),
  rateTurn: (id: string, rating: 1 | -1 | null) => req<{ ok: boolean }>(`/api/turns/${id}/rating`, json({ rating })),
  flagFollowup: (id: string, flag: "redundant" | "useful" | null) => req<{ ok: boolean }>(`/api/turns/${id}/followup-flag`, json({ flag })),
  startMock: (appId: string, mode: "mock" | "videocall", lang: MockLang, stage: Stage, settings: object) =>
    req<MockStep & { session_id: string; plan: string[] }>("/api/mock/sessions", json({ application_id: appId, mode, lang, stage, settings })),
  newExerciseSession: (appId: string, lang: Lang) => req<{ session_id: string }>("/api/exercise/sessions", json({ application_id: appId, lang })),
  clarify: (sid: string, question_id: string, question: string) => req<Clarification>(`/api/exercise/sessions/${sid}/clarify`, json({ question_id, question })),
  submitExercise: (sid: string, question_id: string, text: string, elapsed_s: number) =>
    req<{ turn_id: string }>(`/api/exercise/sessions/${sid}/submit`, json({ question_id, text, elapsed_s })),
  quality: (appId?: string) => req<Quality>(`/api/quality${appId ? `?application_id=${appId}` : ""}`),
  mockAnswer: (sid: string, audio: Blob | null, filename: string, text?: string) => {
    const fd = new FormData()
    if (audio) fd.append("audio", audio, filename)
    if (text != null) fd.append("text", text)
    return req<MockStep>(`/api/mock/sessions/${sid}/answer`, { method: "POST", body: fd })
  },
  finishMock: (sid: string) => req<{ channel: string }>(`/api/mock/sessions/${sid}/finish`, { method: "POST" }),
  sessions: (appId?: string, mode?: Mode) => req<SessionSummary[]>(`/api/sessions?${new URLSearchParams({ ...(appId ? { application_id: appId } : {}), ...(mode ? { mode } : {}) })}`),
  session: (id: string) => req<SessionDetail>(`/api/sessions/${id}`),
  progress: (appId?: string) => req<{ days: ProgressDay[]; labels: Record<string, string>; competency_labels?: Record<string, string> }>(`/api/progress${appId ? `?application_id=${appId}` : ""}`),
}

/** Follows a stage SSE channel. Returns a function to close it. */
export function followStages(url: string, onEvent: (e: StageEvent) => void): () => void {
  const es = new EventSource(url)
  es.addEventListener("stage", (m) => {
    const e = JSON.parse((m as MessageEvent).data) as StageEvent
    onEvent(e)
    if (e.stage === "done" || e.stage === "error" || e.stage === "cancelled") es.close()
  })
  es.onerror = () => { /* EventSource retries on its own; the backend resends the channel history */ }
  return () => es.close()
}

export const qText = (q: Pick<Question, "text_es" | "text_en">, lang: Lang) => (lang === "es" ? q.text_es : q.text_en)

export const LEVEL_LABEL: Record<EvidenceLevel, string> = {
  profesional: "Profesional", proyecto: "Proyecto propio", academico_hackathon: "Académico / hackathon", teorico: "Teórico (sin uso demostrado)", ninguna: "Sin evidencia",
}
export const PRIORITY_LABEL: Record<Priority, string> = { must_have: "Obligatorio", important: "Importante", nice_to_have: "Deseable" }

export const appPath = (appId: string, sub = "") => `/p/${appId}${sub ? `/${sub}` : ""}`
export const KIND_LABEL: Record<EvidenceItem["kind"], string> = {
  professional: "Profesional", freelance: "Freelance (pago)", project: "Proyecto propio", academic: "Académico", hackathon: "Hackathon", volunteer: "Voluntariado",
}
