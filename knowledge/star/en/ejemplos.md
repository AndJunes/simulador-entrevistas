---
title: "STAR examples — strong vs weak (illustrative, junior backend engineer)"
interview_type: star
language: en
doc_kind: ejemplos
competency: [star_situation, star_task, star_action, star_result, relevance, conciseness, job_alignment, cv_consistency]
sources: [K01, K02, K10, K11, K18]
---

## About these examples

**ILLUSTRATIVE — invented examples.** The candidate, company, system and numbers below are fictional. They model a generic junior backend engineer. They are not taken from any real person's CV.

All examples answer the same question:

> "Tell me about a time you solved a difficult bug in production."

This question targets the O*NET developer task of modifying software to correct errors [K11].

Word counts help estimate speaking time. ⚠ sin fuente — heurística: about 130–150 words per minute.

## Strong example (ILLUSTRATIVE)

> **[S]** "Last year I was working on the orders API of a delivery startup, a Node.js service with Postgres. One Friday, support reported that some customers were being charged twice.
>
> **[T]** I was on call that week, so it was my job to find the cause and stop the double charges, without taking the checkout down.
>
> **[A]** First, I checked the payment logs and saw that duplicates came in pairs a few hundred milliseconds apart. They always came from mobile clients on slow connections. My hypothesis was that the app retried the request after a timeout, and our endpoint wasn't idempotent. I reproduced it locally by adding artificial latency. Then I added an idempotency key: the client sends a unique ID per payment attempt, and the API stores it with a unique constraint, so a retry returns the original result instead of charging again. I wrote an integration test for the retry case and asked a senior colleague to review the change before deploying it.
>
> **[R]** After the deploy, duplicate charges went from about a dozen a day to zero over the next month. We refunded the affected customers. I also added an alert on duplicate payment IDs. What I took from it is to check retry behavior whenever an endpoint has side effects."

About 230 words, which is roughly 90–100 s.

**Rubric notes**
- **star_situation 4.** Specific system and stakes in two sentences [K01].
- **star_task 5.** Explicit ownership (on call) plus a constraint (no downtime).
- **star_action 5.** "I" steps, hypothesis → reproduction → fix → test → review, with the reasoning shown. It covers the "what was your role?" probe [K10].
- **star_result 5.** A measured result (about a dozen per day down to zero), a follow-up alert and a lesson [K01][K02].
- **relevance 5, job_alignment 5.** Debugging a Node.js production service and API idempotency are core backend skills [K11].
- **conciseness 4.** At the upper edge of 90 s, still under the ~2-minute ceiling [K18]. Tightening the Action by one sentence would put it inside the 60–90 s target.
- **cv_consistency.** Score it against the real CV. In a real answer, the dates, company and stack must match.

## Weak example (ILLUSTRATIVE)

> "Yeah, so, we had a lot of bugs in that project, it was a big project with many microservices and the architecture was kind of messy because the previous team didn't document anything. There was this one bug with payments, I think, that the users complained about. So we looked at it, we checked the code, we talked a lot as a team, and in the end we fixed it. It was difficult because the code was bad. But we fixed it and the client was happy. I learned that teamwork is very important."

About 100 words, which is roughly 40–45 s.

**Rubric notes**
- **star_situation 2.** The context is about the messy architecture and the previous team, not about the specific bug. It also blames others.
- **star_task 1.** No role or responsibility stated.
- **star_action 1.** Only "we" actions ("we looked", "we checked"). The individual contribution can't be assessed [K01].
- **star_result 2.** "Fixed it, the client was happy" is vague and unmeasured [K01].
- **relevance 3.** It does talk about a bug, but the difficulty and the debugging are never shown.
- **job_alignment 2.** Backend skills are implied but never demonstrated.
- **conciseness 3.** Short, but short because components are missing, not because it is efficient.

## How to rewrite a weak answer into a strong one

Practical steps the simulator can suggest:

1. **Choose one specific incident**, not "a lot of bugs".
2. **State your role in one sentence:** "I was responsible for…" [K01].
3. **List 3–4 "I" actions** in order, each with a reason ("I checked X because Y") [K01][K02].
4. **End with a number or a verifiable fact,** plus one lesson [K01].
5. **Cut the blame and background** until the Situation is 2–3 sentences [K01].

Then say it aloud and time it. Practicing aloud to keep under about 2 minutes is the CUNY handout's advice [K18].
