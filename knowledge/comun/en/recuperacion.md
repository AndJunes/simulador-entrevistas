---
title: "Recovering when you go blank, don't know, or lose the thread"
interview_type: comun
language: en
doc_kind: recuperacion
competency: [recovery, composure, honesty]
sources: [K01, K02, K03, K04, K05, K07, K10, K11, K12, K14, K15, K23, K24, K33, K34, K35, K36, K37, K38, K39]
---

## Buying time honestly

**Pausing is allowed.**
- UT Austin's career guide advises taking a couple of seconds to collect your thoughts after each question. Doing so gives a more focused answer, avoids rambling, and helps calm nerves. If you worry about an awkward silence, simply ask for a moment [K07].
- MIT CAPD also says you can pause to think before answering [K02].
- Flinders University teaches a "Listen, Pause, Think" routine: note key words, ask for the question to be repeated if needed, work out what they're really looking for, then choose your example [K39].

**How long?** ⚠ sin fuente — heurística.
- In casual conversation, replies to yes/no questions usually start within a fraction of a second. Requests for information take longer [K23].
- Silences of around 700 ms or more tend to precede "dispreferred" answers [K24]. A long, unexplained silence can therefore read as trouble.
- On a phone or video call, the listener can't see you thinking. Duke's recruiters advise saying out loud what you're doing during a pause [K38].
- Working rule used by the simulator: up to about 3 s of silent thinking is comfortable. Beyond that, say a bridging phrase (see `backend/config/form_targets.yaml`).

**Asking to clarify or repeat is fine.** Duke's career center notes that asking for clarification shows critical thinking and avoids answering the wrong question [K38]. Flinders lists asking for a repeat as part of the first step [K39].

**Natural, honest phrases** (examples, not scripts):
- "That's a good question — let me take a second to think about the best example."
- "Just to make sure I answer the right thing: are you asking about X or Y?"
- "Could you repeat the last part of the question?"
- "Let me think about that for a moment."
- "There are a couple of examples I could use; I'll go with the one from my last project."
- "I'd like to give you a concrete case rather than a general answer, so give me a second."

## Choosing an example fast

The speed comes from preparation, not improvisation.

**Have a story bank.**
- MIT CAPD advises preparing 3–5 stories [K01].
- One experience can answer several different behavioral questions [K02].
- Powell & Bonaccio suggest anticipating typical situations (conflict, leadership, time management) and practicing concise STAR answers [K33].

**Map the question to a competency first.** Ask yourself which competency the question targets. Behavioral questions are designed around specific job competencies [K10]. Typical backend competencies come from the O*NET task list [K11]:
- debugging and fixing errors;
- performance;
- testing;
- working with other engineers;
- learning.

Company competency lists, such as Amazon's Leadership Principles, work the same way [K12].

**Then pick the story from the bank that best shows that competency.** ⚠ sin fuente — heurística: keep a one-line index of your stories (e.g. "double-charge bug → debugging, ownership, pressure"). Rehearse that index so retrieval takes seconds.

## Structuring on the fly

When you start speaking without a full plan, borrow a fixed skeleton.

**Behavioral questions → STAR** [K01][K10]:
1. **Situation:** one sentence of context.
2. **Task:** "My responsibility was…".
3. **Action:** "First I…, then I…, finally I…". This is the longest part [K01].
4. **Result:** "As a result…" plus a number or a fact, and optionally what you learned.

**"Tell me about yourself" → present, past, future** [K04]:
1. What you do now.
2. The relevant past experience and skills.
3. Why this role is the next step.

⚠ sin fuente — heurística: say the skeleton words out loud ("The situation was…", "What I did was…"). They keep you on track and also signal structure to the listener.

## When you genuinely don't know

This applies to technical or factual questions.

**Don't bluff.**
- UT Austin's guide says never to lie about or embellish your experience. It notes that skilled interviewers are trained to spot bluffing [K07].
- MIT notes that exaggeration may not match your résumé or references [K01].

**Don't stop at "I don't know" either.** UW Bothell's career services recommend three things [K37]:
- Attempt the problem anyway and talk through your reasoning, because employers want to see how you solve problems.
- Say something like "I don't have the precise answer, but here's how I'd work through it."
- Mention how you would use your team.

**A practical pattern:**
1. **Admit:** "I haven't worked with that directly."
2. **Reason:** what you do know, and how you'd approach or test it.
3. **Find out:** "I'd check the official docs and write a small test to confirm."
4. **Bridge:** "What I have done is something close: …"

For behavioral questions where you have no matching experience:
- Say so honestly.
- Then give the closest real example, or explain how you would handle it.
- Never invent a story. Recruiters verify specific claims (see `star/en/errores.md`).

## Losing the thread mid-answer

⚠ sin fuente — heurística for the specific techniques below. They follow from the evidence that **organized answers** are associated with better interview performance [K36], and from the warning that memorized answers break down when you forget parts [K14].

**Recovery moves:**
- **Pause and re-anchor.** Stop, take a breath, and restate the question to yourself: "So, the question was how I handled the outage."
- **Summarize what you've said:** "So far: the API was double-charging, and I was on call."
- **Jump to the point:** "The key thing I did was…", then go straight to the Action or Result.
- **Close and offer more:** "That's the short version; happy to go deeper into the debugging if useful." This also helps conciseness, and a recruiter can steer the next follow-up.

**Prevention.** Memorize the skeleton and key facts, not sentences. Texas Tech recommends a list of key words rather than a script [K05]. Rehearse out loud, because silent rehearsal doesn't match the real task [K15].

## Anxiety and composure — what the evidence says

**Anxiety does affect ratings, modestly.** Powell & Bonaccio summarize a meta-analysis of 30 studies (Powell, Stanley & Brown, 2018). It found an average correlation of about −0.19 between self-reported interview anxiety and interviewer-rated performance [K33].

**Reappraise rather than suppress.** Brooks (2014) studied karaoke, public speaking and math tasks. People who reappraised their anxiety as excitement, even through brief self-talk such as saying "I am excited", felt more excited and performed better than people who tried to calm down [K34].

**Slow breathing.** A systematic review of 15 studies in healthy adults found that slow breathing (under 10 breaths per minute) was associated with:
- greater relaxation and comfort;
- reduced anxiety and arousal;
- higher heart-rate variability [K35].

Practitioner versions you can use before the call:
- box breathing (4 s in, hold, 4 s out, hold) [K33];
- 4-second in/out breathing [K03].

These are applications of the general finding, not tested interview interventions.

**Preparation and practice.** In a field study of 213 candidates, those who attended coaching and used preparation strategies such as role-play performed better. The link ran through better-organized answers [K36]. Powell & Bonaccio also suggest:
- recording your answers to detect filler words;
- pausing and reflecting before answering when intrusive thoughts appear;
- treating each question as a fresh start [K33].

**Practical routine for the call:**
1. Do a few minutes of slow breathing before dialing in [K35][K33].
2. Tell yourself "I'm excited about this" instead of "calm down" [K34].
3. Start each question fresh, regardless of how the last one went [K33].
