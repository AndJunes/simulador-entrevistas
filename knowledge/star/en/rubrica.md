---
title: "STAR answer rubric — criteria with 1–5 descriptors"
interview_type: star
language: en
doc_kind: rubrica
competency: [star_situation, star_task, star_action, star_result, decisions_tradeoffs, learning, relevance, conciseness, job_alignment, cv_consistency]
sources: [K01, K02, K08, K09, K10, K11, K14, K18, K40, K42]
---

## How to use this rubric

Score each of the 10 criteria (or the applicable ones) from 1 to 5, and quote the transcript as evidence. Structured interviewing practice behind the scale:
- OPM recommends one proficiency scale for all criteria (typically 3–7 levels), with example answers for each level [K10].
- Google rates with four levels (poor, borderline, solid, outstanding), with shared examples so raters calibrate [K09].

Mapping used here: 1 = poor, 2 = borderline, 3 = acceptable, 4 = solid, 5 = outstanding.

⚠ sin fuente — heurística: the exact descriptor wording is the corpus author's synthesis of [K01][K02][K10]. It is not a published rubric.

## star_situation

The context: when, where, who. It should be enough to understand the example, and no more [K01][K02].

| Score | Descriptor |
|---|---|
| 1 | No situation. The answer is generic ("I usually…") or hypothetical, not a specific past event. |
| 2 | A specific event, but the context is confusing or missing key facts (what system, what problem). Or it is excessively long and crowds out the action. |
| 3 | A specific, understandable context, with some unnecessary detail. |
| 4 | Brief, specific context (project, system, stakes) in a few sentences. About 20 % of the answer [K01]. |
| 5 | As 4, and it frames the stakes, so the listener knows why the story matters before the action starts. |

## star_task

The goal or responsibility, and the candidate's role in it [K01][K02].

| Score | Descriptor |
|---|---|
| 1 | No task or role stated. Unclear what the candidate was responsible for. |
| 2 | The task is implied but not stated, or only the team's goal is given. |
| 3 | States the goal. The candidate's specific responsibility is somewhat clear. |
| 4 | Clearly states the goal and the candidate's own responsibility or ownership. |
| 5 | As 4, plus the constraint that made it hard (deadline, scope, unknown codebase), which sets up the action. |

## star_action

What the candidate personally did. This is the longest and most important part [K02], about 60 % [K01]. "I" statements are needed to judge individual contribution [K01][K02].

| Score | Descriptor |
|---|---|
| 1 | No concrete actions, or only "we" actions. The candidate's contribution cannot be identified. |
| 2 | A few vague actions ("I worked on it", "I fixed it") without steps or reasoning. |
| 3 | Concrete steps in "I" form, but thin on reasoning or on the skills the question targets. |
| 4 | Clear sequence of the candidate's own steps, with the reasoning behind key decisions. It demonstrates the competency asked about. |
| 5 | As 4, plus trade-offs or alternatives considered and how they collaborated or communicated. It pre-empts the "what was your role?" probe [K10]. |

## star_result

The outcome of the candidate's actions, quantified where possible, plus an optional lesson [K01][K02].

| Score | Descriptor |
|---|---|
| 1 | No result. The story stops at the action. |
| 2 | Vague result ("it went well", "the client was happy"). |
| 3 | A concrete outcome (shipped, fixed, adopted), but not measured. |
| 4 | A concrete, measured or verifiable outcome (latency, error rate, time saved, users), tied to the candidate's actions. |
| 5 | As 4, plus a lesson or a follow-up change (a test, an alert, a process), showing reflection. It answers the "anything you'd do differently?" probe [K10]. |

## decisions_tradeoffs

What the candidate decided and which alternatives they ruled out. OPM plans per-component probes to draw out that reasoning [K10]; here we score whether the candidate offers it unprompted. It comes from the question-bank review ("decisions and trade-offs" dimension).

| Score | Descriptor |
|---|---|
| 1 | No decisions: only facts. |
| 2 | Mentions a decision without the why. |
| 3 | Explains the why of the main decision. |
| 4 | Compares with at least one alternative and states the criterion used to choose. |
| 5 | As 4, and acknowledges the cost of the choice. |

## learning

What they learned or changed afterwards. **Applies only if the story allows it**: if there is no natural place for a lesson, mark it not applicable [K01].

| Score | Descriptor |
|---|---|
| 1 | Nothing, or a generic lesson ("I learned a lot"). |
| 2 | A vague lesson, loosely tied to the story. |
| 3 | A concrete lesson tied to the story. |
| 4 | Concrete lesson + what they do differently since. |
| 5 | As 4, with evidence they applied it elsewhere. |

## relevance

Does the story actually answer the question asked and show the targeted competency? Behavioral questions target specific job-related competencies [K10].

| Score | Descriptor |
|---|---|
| 1 | Does not answer the question (a different topic or competency), or no example is given. |
| 2 | Loosely related. The targeted competency appears only in passing. |
| 3 | Answers the question, but the competency is shown indirectly. |
| 4 | Directly answers the question. The competency is clearly demonstrated in the action. |
| 5 | Directly answers it, and the candidate explicitly connects the story back to the competency at the end. |

## conciseness

Delivery length and economy:
- The user's prep target is 60–90 s. ⚠ heurística: no external source for this exact range.
- A career-center handout caps STAR stories at about 2 minutes [K18].
- Rambling is a listed interview mistake [K14].

Use the deterministic duration metric from `form_targets.yaml` as an input.

| Score | Descriptor |
|---|---|
| 1 | Over ~2.5 min or under ~20 s, or repetitive and circling. |
| 2 | Clearly over 2 min, or so short that components are missing. The situation is padded. |
| 3 | About 90–120 s. Some padding, or a disproportionately long situation. |
| 4 | Within 60–90 s. Proportions roughly follow S20/T10/A60/R10 [K01]. |
| 5 | Within 60–90 s, no filler sentences, and the result lands clearly before the time is up. |

## job_alignment

Does the story show skills **this** job needs? The evaluator receives the posting with its requirements (R1…) and compares against them. Sources:
- MIT advises connecting examples to the skills in the job description [K01].
- UNI lists failing to connect your skills to the employer's needs as a mistake [K14].
- O*NET's developer tasks describe the target behaviors [K11].

| Score | Descriptor |
|---|---|
| 1 | The skills shown are unrelated to the role. |
| 2 | Broadly related, but distant from the role's requirements, with no bridge offered. |
| 3 | Relevant skills are shown, but the link to the role is left implicit. |
| 4 | Clearly shows skills from the posting's requirements (e.g. debugging a service, data modeling, testing). |
| 5 | As 4, and it highlights a capability that addresses a need the posting reveals (reliability, learning a technology fast, working remotely across time zones). |

## cv_consistency

Is the story consistent with the candidate's CV: dates, employers, roles, technologies and scale? Sources:
- MIT warns that exaggerated stories may not match the résumé or references [K01].
- SHRM tells recruiters to confirm dates and verify specific, quantified claims [K08].

The evaluator receives the CV in context and compares the two.

| Score | Descriptor |
|---|---|
| 1 | Contradicts the CV (a role, employer, technology or date that isn't there or conflicts with it). |
| 2 | Plausible, but inflated scale or scope relative to the CV (e.g. "I led the team" for an intern role). |
| 3 | Consistent, but hard to tie to a specific CV entry. |
| 4 | Clearly maps to a CV entry, with consistent dates, role and technologies. |
| 5 | Maps to a CV entry, and adds credible detail that strengthens it without overstating the candidate's scope. |
