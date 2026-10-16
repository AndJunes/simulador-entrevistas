---
title: "Work-sample exercise rubric — criteria with 1–5 descriptors"
interview_type: work_sample
language: en
doc_kind: rubrica
competency: [approach, technical_correctness, edge_cases_failures, testing_validation, tradeoffs_operability, written_communication]
sources: [K37, K38, K41, K42]
---

## How to use this rubric

For written exercises that resemble the real job: an endpoint, a schema and its query, a migration, a test, or a message to a client. Work samples reproduce tasks identical or very similar to the job, scored by observing performance or measuring the task outcome [K41].

**Rules:**
- Score each applicable criterion 1–5 with the anchored scale from the technical rubric, all weighing the same [K42]. A criterion that does not apply (e.g. tests in a client message) is not scored.
- **There is no single correct solution.** A valid, justified alternative is accepted even if it differs from the reference.
- **Code is never executed.** It is assessed by reading it: if something would not compile or would fail, point to the line and why.
- Asking clarifying questions before starting counts in favor: it shows critical thinking [K38]. The candidate's questions and assumptions are part of the answer.

⚠ no source — heuristic: the descriptors are our own synthesis.

## approach

Does the approach solve the stated problem, and is it explained?

| Score | Descriptor |
|---|---|
| 1 | Doesn't solve the task, or the approach can't be understood. |
| 2 | Solves part of it, with an approach that doesn't fit the requested case. |
| 3 | Solves the task with a reasonable, briefly explained approach. |
| 4 | Clear, justified approach. States assumptions and the clarifications asked for. |
| 5 | As 4, and prioritizes well: delivers the essentials first and notes what would come next. |

## technical_correctness

Is the code, query or plan correct?

| Score | Descriptor |
|---|---|
| 1 | Errors that keep it from working (syntax, core logic, non-existent API). |
| 2 | Would work on the happy path, with errors that show up quickly. |
| 3 | Correct for the requested case, with minor details. |
| 4 | Correct, idiomatic and consistent (types, status codes, transactions where they belong). |
| 5 | As 4, and simple: no unnecessary code. |

## edge_cases_failures

Does it handle errors, invalid input, duplicates or concurrency where they matter?

| Score | Descriptor |
|---|---|
| 1 | No error handling. |
| 2 | Generic handling (a `try/except` that swallows everything). |
| 3 | Handles the main errors with appropriate responses. |
| 4 | Main errors + input validation + one relevant edge case (duplicate, timeout, missing resource). |
| 5 | As 4, prioritized, without over-engineering. |

## testing_validation

Does it include or describe how to test it?

| Score | Descriptor |
|---|---|
| 1 | No tests or test plan. |
| 2 | One happy-path test, or "I'd test it manually". |
| 3 | Test for the main case and one error. |
| 4 | Tests with external dependencies isolated where it helps, and relevant error cases. |
| 5 | As 4, plus a regression test for the stated problem. |

## tradeoffs_operability

Does it say what was decided and what was left out, and how it would run?

| Score | Descriptor |
|---|---|
| 1 | No decisions mentioned. |
| 2 | Mentions a decision without justification. |
| 3 | Justifies the main decision. |
| 4 | Compares with an alternative and says what to measure in production. |
| 5 | As 4, and states the solution's limit and when to change it. |

## written_communication

Is what they wrote understandable? For client messages: clarity, transparency, options, risks and next step.

| Score | Descriptor |
|---|---|
| 1 | Can't be understood, or hides the problem from the client. |
| 2 | Understandable with effort. Key information missing (what happened, what's next). |
| 3 | Clear, with the main information. |
| 4 | Clear and short: status, cause, options with impact, and a dated next step. |
| 5 | As 4, with a tone that builds trust without downplaying risk. |
