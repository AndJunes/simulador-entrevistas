---
title: "STAR method for behavioral interview answers"
interview_type: star
language: en
doc_kind: metodologia
competency: [star_situation, star_task, star_action, star_result, relevance, conciseness]
sources: [K01, K02, K09, K10, K11, K18, K36]
---

## What a behavioral question is and why STAR exists

Behavioral questions ask about something you actually did, for example:
- "Tell me about a time when…"
- "Give me an example of…"
- "Describe a situation in which…"

They rest on the premise that past behavior in similar circumstances is the best predictor of future behavior on the job [K10]. Google's structured interviewing guide makes the same distinction:
- **Behavioral questions** ask about past achievements.
- **Hypothetical questions** ("What would you do if…") present a job scenario [K09].

STAR gives the interviewer the three pieces of information that U.S. OPM says a structured question should elicit [K10]:
- the context (situation or task);
- what was actually done (action);
- the consequence (result).

## The four components

**Situation**
- Give only the context needed to understand the example: when, where and who was involved [K01][K02].
- You don't need every detail [K01].

**Task**
- State the goal or responsibility you had, briefly [K01][K02].
- Make your role explicit. This separates "the team's problem" from "my job in it".

**Action**
- Describe what **you** did, and which skills or traits the question is about [K01].
- MIT CAPD calls this the longest part of the answer, the part that directly answers the question [K02].
- Use "I" for your own contribution, even in team work, so the interviewer can assess you [K01][K02].

**Result**
- Explain the outcome of your actions [K01].
- Quantify it where possible. When choosing between stories, prefer the one with more concrete, measurable results [K02].
- Optionally add what you learned [K01].

## Time allocation and length

MIT CAPD suggests a rough split, which it describes as a guide and not an exact rule [K01]:

| Part | Share | In a 75 s answer |
|---|---|---|
| Situation | ~20 % | ~15 s |
| Task | ~10 % | ~8 s |
| Action | ~60 % | ~45 s |
| Result | ~10 % | ~8 s |

**Total length**
- A CUNY career-services handout says a STAR story should be about 2 minutes, and that you should practice aloud so you don't go over [K18].
- The user's preparation target for this interview is **60–90 s**. ⚠ sin fuente — heurística: no external source found for 60–90 s specifically. It sits inside the ~2-minute ceiling of [K18] and suits a 15-minute screen, where several questions must fit.

The most common distortion is a long Situation and a short Action. The simulator should flag answers where the context takes more time than what the candidate did.

## Follow-up probes the interviewer may use

Structured interviews often plan follow-up probes for each component. OPM's examples [K10]:
- **Situation/Task:** Who was involved? What led up to the situation?
- **Action:** How did you respond? What was your role?
- **Result:** What was the outcome? Would you do anything differently?

Google's example behavioral question has three planned follow-ups [K09]:
- your goal and why;
- how teammates responded;
- your next steps.

A complete STAR answer pre-empts most of these probes. A missing component predicts which probe will come next. The simulator can use this to generate realistic follow-ups.

## Building a story bank

- Prepare 3–5 stories before the interview [K01].
- One experience can answer several different behavioral questions [K02]. A good production-bug story, for example, can cover problem solving, ownership, pressure and learning.
- Pick stories that match the job's competencies. MIT advises cross-referencing the job posting with your CV [K02]. For a backend developer, O*NET's core tasks suggest themes [K11]:
  - analyzing requirements;
  - working with other engineers on interfaces and performance;
  - modifying software to fix errors or improve performance;
  - testing.
- Practice telling them aloud [K02]. In a study of 213 candidates, those who attended interview coaching and prepared (for example, through role-play) gave better-organized answers, and that organization was linked to better interview performance [K36].
- Don't memorize scripts word for word. MIT notes that scripted stories limit adaptability and can sound unnatural [K01].

## Answering closed or "yes/no" behavioral questions

Some questions sound closed ("Have you ever led a team?"). MIT recommends a "yes, and…" approach: answer, then give an example [K01]. CUNY's handout makes the same point. A closed question is a chance to tell a STAR story, not to stop at "yes" [K18].

## Honesty and consistency

- Describe what actually happened, including real behaviors and emotions [K01].
- Exaggeration can sound insincere, and it may not match your CV or what your references say [K01].
- In the simulator, the `cv_consistency` criterion checks the story against the candidate's CV: dates, roles, technologies and scale.
