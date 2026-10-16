---
title: "Technical question rubric — criteria with 1–5 descriptors"
interview_type: technical
language: en
doc_kind: rubrica
competency: [technical_correctness, reasoning, edge_cases_failures, testing_validation, security_permissions, tradeoffs_operability, clarity_structure, directness, clarifies_assumptions, uncertainty_transparency]
sources: [K09, K37, K38, K40, K42]
---

## How to use this rubric

For technical knowledge, debugging and design questions answered out loud (not written code: that is the work-sample rubric).

**Rules:**
- Score each criterion 1–5 against fixed descriptors ("benchmarks of proficiency"), the same for every answer, and quote the transcript fragment [K40].
- OPM uses a 1–5 proficiency scale per competency and recommends equal weights unless a documented justification exists [K42]. Here every applicable criterion weighs the same.
- A criterion that does **not apply** to the question (e.g. security in a question with no data or permissions) is marked not applicable: it is not scored and not averaged.

**Anchored scale** (the same for every criterion):

| Score | Anchor |
|---|---|
| 1 — Insufficient | Misses the goal, contains central errors, or shows no evidence. |
| 2 — Weak | Part of the idea is right, but important elements are missing and there is little evidence. |
| 3 — Competent | Correct for the role's level, with enough reasoning and evidence. |
| 4 — Strong | Explains decisions, trade-offs, validation and limits clearly. |
| 5 — Excellent | Rigorous, specific and well prioritized. Anticipates relevant failures without over-engineering. |

⚠ no source — heuristic: the per-criterion descriptors are our own synthesis on top of the scale above. They are not a published rubric.

**Not scored:** accent, speaking speed, apparent confidence or length. Communication is scored on clarity and effectiveness, not on sounding native.

**Experience vs. knowledge.** Explaining a concept well does not prove having used it in production. The evaluator reports the evidence level separately: professional, project, academic/hackathon or theoretical.

## technical_correctness

Is what the candidate says technically correct for the role's level?

| Score | Descriptor |
|---|---|
| 1 | Central error (e.g. "async makes CPU-bound code faster"), or does not address the technical part. |
| 2 | Broadly right, with inaccuracies that would change the implementation. |
| 3 | Correct for the level. No errors that change the solution. |
| 4 | Correct and precise. Uses the right terms and separates close concepts (concurrency vs. parallelism, threads vs. asyncio). |
| 5 | As 4, and points out where the general rule does not apply. |

## reasoning

Does the candidate show how they get to the answer? In technical interviews, thinking out loud and showing how the problem would be approached is what gets assessed [K37].

| Score | Descriptor |
|---|---|
| 1 | A conclusion with no reasoning, or a list of technologies with no flow. |
| 2 | Partial reasoning: skips steps or does not connect cause and effect. |
| 3 | Clear end-to-end reasoning for the main case. |
| 4 | Clear, ordered reasoning, with hypotheses ruled out by evidence. |
| 5 | As 4, and prioritizes: says what to do first and why. |

## edge_cases_failures

Does the candidate consider failures, edge cases and degradation?

| Score | Descriptor |
|---|---|
| 1 | Happy path only. |
| 2 | Says something can fail without saying what or how it is handled. |
| 3 | Identifies the main failures (timeout, partial failure, duplicates) and how to handle them. |
| 4 | Main failures + a concrete strategy (bounded retries, idempotency, timeouts, rollback). |
| 5 | As 4, prioritizing the most likely or costly failures without over-engineering. |

## testing_validation

How would they know it works? How would they verify or test it?

| Score | Descriptor |
|---|---|
| 1 | No mention of verification. |
| 2 | "I'd write tests", without saying which or what they cover. |
| 3 | Concrete tests for the main case and at least one error case. |
| 4 | Separates unit and integration tests, isolates external dependencies only where it helps, covers failures. |
| 5 | As 4, plus verification in real use (metrics, logs, traces) or a regression test. |

## security_permissions

Applies only if the question involves user data, permissions, secrets or untrusted input.

| Score | Descriptor |
|---|---|
| 1 | Ignores an obvious risk (another user's data, secrets in code, unvalidated input). |
| 2 | Says "security" without a concrete control. |
| 3 | Names the main control (per-resource authorization, input validation, secret handling). |
| 4 | Concrete controls and where they apply in the flow. |
| 5 | As 4, and how they would verify the control works. |

## tradeoffs_operability

Does the candidate compare alternatives and think about running the system (cost, latency, monitoring)?

| Score | Descriptor |
|---|---|
| 1 | One option, no alternatives or costs. |
| 2 | Mentions alternatives with no criterion to choose. |
| 3 | Chooses with a reasonable criterion (simplicity, cost, latency). |
| 4 | Compares at least two options with explicit criteria and says what they would measure in operation. |
| 5 | As 4, and says when they would change the decision (scale, cost, team). |

## clarity_structure

Can it be understood on one listen? Does it have an order?

| Score | Descriptor |
|---|---|
| 1 | Disordered: cannot be followed. |
| 2 | Understandable with effort. Topic jumps. |
| 3 | Recognizable order, with some detours. |
| 4 | Clear structure (approach → steps → risks), easy to follow. |
| 5 | As 4, and signposts the structure up front ("I see three parts…"). |

## directness

Does the candidate answer what was asked, without detours?

| Score | Descriptor |
|---|---|
| 1 | Does not answer the question. |
| 2 | Answers sideways or late. |
| 3 | Answers, with some filler. |
| 4 | Answers directly from the start. |
| 5 | Answers directly and closes by tying back to the question. |

## clarifies_assumptions

Asking for clarification shows critical thinking [K38]. Applies when the question leaves data open (volume, constraints, context).

| Score | Descriptor |
|---|---|
| 1 | Silently assumes key facts and the answer depends on them. |
| 2 | Assumes silently, though the answer is still reasonable. |
| 3 | States at least one important assumption. |
| 4 | Makes key assumptions explicit, or asks about them before going on. |
| 5 | As 4, and explains how the solution would change under a different assumption. |

## uncertainty_transparency

Is the candidate honest about what they don't know or haven't used? Don't stop at "I don't know": show how you would solve it [K37].

| Score | Descriptor |
|---|---|
| 1 | Invents or confidently states something wrong, or stops at "I don't know". |
| 2 | Unsure without saying so; mixes knowledge with guesses. |
| 3 | Separates what they know from what they assume. |
| 4 | Admits the limit and says how they would find out or test it. |
| 5 | As 4, and bridges to the closest real experience without overstating it. |
