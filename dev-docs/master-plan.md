# Aria Learn — Master Plan

**What this document is:** the full specification for turning Aria Learn from a question
generator into a real tutor. It is written in plain words on purpose. Anyone on the team —
engineer, teacher, parent, investor — should be able to read it end to end and know what we
are building and why.

**Status:** draft 1. Written 2026-08-21.

---

## 1. The vision, in plain words

In the novel *The Diamond Age*, a girl is given a book called *A Young Lady's Illustrated
Primer*. It looks like a book that teaches reading. It is much more than that. It knows her.
It tells her stories built out of her own life. It never gets tired, never gets impatient,
never runs out of time. She uses it for years, and it grows as she grows — from letters and
sounds, to reading, to reasoning, to hard questions about how to live.

That is the target.

The best education has always been one adult sitting with one child. Aristotle taught
Alexander. Almost no child gets that. A great tutor does not just drill facts — over months
and years they learn how a particular child's mind works, and that is what lets them teach
the things you cannot drill: how to think, how to reason, how to keep going when it is hard.

We cannot build the Primer today. We can start today. The first version is a product a
parent buys to teach their young child to **read, write, and do arithmetic** — at the
quality of a devoted private tutor, at a price ordinary families can pay.

This is not a replacement for a teacher. It is the thing that makes a teacher's job
possible: it handles the one-on-one time no school can afford.

### The one-sentence test

> A parent watches a session and says: *"That is better than the tutor I was paying $60 an
> hour for."*

If a change does not move us toward that sentence, it is not on the plan.

### Three things that must be true

1. **It knows the child.** Not "it stores scores." It remembers that Ali counts on his
   fingers for anything over 7, that he loves trucks, that he gives up when a question has
   more than two sentences, and that he cracked place value on a Tuesday in March after
   three weeks of struggle.
2. **It teaches, it does not test.** A quiz is a measurement. Teaching is explaining,
   showing, asking, listening, noticing the wrong idea underneath the wrong answer, and
   fixing *that*.
3. **It is never wrong about the subject.** A tutor who says 2 + 3 = 6 is not a tutor. Every
   fact a child sees must be checked before they see it.

---

## 2. Who uses it

| User | What they want | What they get |
|---|---|---|
| **Child (TK–8)** | To not feel stupid. To get through it. To have fun. | One screen. Aria talks. They answer. Nothing else to decide. |
| **Parent** | To know their child is actually learning, without becoming a teacher. | A weekly plain-language note from Aria, and the ability to just *ask* Aria how their child is doing. |
| **Teacher** | To know which of 28 children needs help with what, this week. | A class view, and the ability to tell Aria "work on fractions with these six". |

The child is the end user. Everything else serves them. When two of these three conflict,
the child wins.

---

## 3. Where we actually are today

Be honest about this, because the plan depends on it.

### What is built and works

- **Student session UI** (`frontend/src/session/`). One screen, three age bands
  (`band.ts`: early TK–2, middle 3–5, senior 6–8). The child picks a class, then Aria runs
  the session. There is no topic list, no mastery percentage, no menu of six activities.
  This is right and we keep it.
- **Curriculum** as JSON (`backend/src/main/resources/curriculum/`), math and English,
  with units, topics and objectives.
- **Auth**, parents, students, enrolment, JWT.
- **Question generation** with structural repair. `QuestionSanitizer.java` is a pure,
  deterministic gate: it fixes mechanical defects and rejects questions that stay
  unanswerable. `MathAnswerChecker.java` checks place value and plain arithmetic without
  the model.
- **Tutor personalities**, database-driven (`tutor_modes`). A new persona is one SQL row.
- **Desktop app.** Electron, with a bundled Java runtime, PostgreSQL, and Ollama. It runs
  fully offline. *(The bundled Ollama is being removed — see
  [`cloud-model-layer.md`](cloud-model-layer.md).)*
- **Progress, mastery, gamification, homework** — all present.

### What is not built, and the honest name for it

**There is no agent.** What we have is twelve one-shot JSON generators
(`GenerationService.java`: `PROMPT_KNOWLEDGE`, `PROMPT_PRACTICE`, `PROMPT_HINT`, and so on).
Each call is stateless. The context object passed to the model is:

```java
GenerationContext(subjectName, gradeName, topicName, objectives)
```

There is nothing about the child in it. Not their age band, not their reading level, not
what they got wrong an hour ago. The only per-child input the model ever receives is a
personality string from `TutorModeService.styleForStudent()`.

**A session is one question.** `GuidedPracticeService.start()` generates exactly one
`MEDIUM` question. That is the whole lesson.

**Aria does not speak.** "Ask Aria" is answered by
`frontend/src/session/sources/replies.ts::localReply()` — a regular expression running in
the browser that matches words like "stuck" and returns the hint the grader already sent.

**Nothing is remembered.** There is no table that records what happened in a session. When
the child closes the tab, everything except a score is gone.

**The model is not good enough.** `qwen2.5:7b` and `qwen2.5:3b` on Ollama. It takes 6 to 38
seconds per question. It writes arithmetic that is wrong. It writes HTML tags into the
question text. It writes Grade 7 vocabulary for a Grade 1 child, because it is never told
the child is in Grade 1. **This is why we are moving to hosted models and dropping local
ones entirely** — a tutor that is sometimes wrong about 7 + 8 is not a tutor.

**A child who cannot read cannot use it.** The whole product is text on a screen. Our
youngest and most important user — the five-year-old learning to read — cannot use a
reading tutor that requires them to read.

### The nine gaps

| # | Gap | Today | Needed |
|---|---|---|---|
| 1 | **Model quality** | `qwen2.5:7b`, wrong math, HTML, 6–38s | Hosted models, pluggable by config; a quality gate that blocks bad output |
| 2 | **No conversation** | `localReply()` regex in the browser | A server turn where Aria actually talks |
| 3 | **No memory** | nothing recorded | Three memory layers, from this turn to this year |
| 4 | **No plan** | `chooseTopic()` picks the first unlocked topic | A skill graph and a scheduler that decides what is next |
| 5 | **No voice** | text only | Aria speaks; the child speaks back |
| 6 | **No real reading instruction** | multiple choice about text | Phonics ladder, decodable text, oral reading |
| 7 | **No real writing instruction** | multiple choice about grammar | The child writes; Aria coaches |
| 8 | **No parent or teacher agent** | static charts | Ask Aria a question, get a real answer |
| 9 | **No safety layer** | structural checks only | Content classifier, transcript review, crisis routing |

---

## 4. The architecture we are building toward

Five systems. Build them in this order.

```
                        ┌──────────────────────────┐
   child speaks/types → │      THE TUTOR LOOP      │ → Aria speaks/shows
                        │  (one turn at a time)    │
                        └────────────┬─────────────┘
                          reads      │      writes
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
      ┌───────────────┐     ┌───────────────┐      ┌───────────────┐
      │    MEMORY     │     │   CURRICULUM  │      │    CONTENT    │
      │ what we know  │     │  skill graph  │      │  problems,    │
      │ about a child │     │  + scheduler  │      │ stories, text │
      └───────────────┘     └───────────────┘      └───────┬───────┘
                                                           │ every item
                                                           ▼
                                                  ┌───────────────┐
                                                  │  QUALITY GATE │
                                                  │ correct? safe?│
                                                  │ right level?  │
                                                  └───────┬───────┘
                                                          ▼
                                                  ┌───────────────┐
                                                  │  MODEL LAYER  │
                                                  │ any provider  │
                                                  └───────────────┘
```

### 4.1 The tutor loop

**This is the heart of the product.** Right now the browser drives the session. It must
move to the server, because only the server can see the child's whole history.

One endpoint owns everything:

```
POST /api/v1/student/session/turn
```

The child sends one thing — an answer, a question, "I don't get it", a recording of them
reading aloud, or nothing at all (they just opened the app). Aria sends back one **move**.

**The moves Aria can make:**

| Move | When | Example |
|---|---|---|
| `SAY` | Teach or explain something | "A fraction is just a number of equal pieces. Watch." |
| `SHOW` | Put something visual on screen | A number line, a manipulative, a picture |
| `ASK` | Put a question to the child | "How many quarters make a whole?" |
| `LISTEN` | Ask the child to speak or read aloud | "Read this sentence out loud to me." |
| `HINT` | They got it wrong once | "Look at the bottom number first." |
| `RETEACH` | They got it wrong twice, the same way | Explain again, differently, simpler |
| `REVEAL` | They are done struggling productively | Show the answer with the reasoning |
| `PRAISE` | They got it | Specific, not "good job" |
| `SWITCH` | This skill is not working today | Move to something else, come back tomorrow |
| `BREAK` | Attention is gone | "Let's stop here. Same time tomorrow?" |
| `END` | Session complete | Wrap up, tell them what they learned |

**How Aria decides.** The turn is not one model call. It is a small loop with tools:

```
1. Load: learner model + skill state + last N events of this session
2. Ask the planner model: what is the right move now?
3. If the move needs content (a problem, a story, an explanation):
      a. Look in the content cache first
      b. If empty, generate it
      c. Run the QUALITY GATE — correctness, reading level, safety
      d. If it fails the gate, regenerate once, then fall back to cached content
4. Write the move and the child's input to session_event
5. Update skill state and any observation about the child
6. Return the move
```

**Hard rule: the child never waits for a model.** Step 3a exists so the common case is a
cache read. Pre-generation runs ahead of the child — while they are answering question 4,
questions 5 and 6 are already being made. If nothing is cached and generation is slow, Aria
fills the gap with something real to do (a fluency drill, a review item) rather than a
spinner.

**What this deletes:** `chooseTopic()` in `sources/apiSession.ts`, and
`sources/replies.ts::localReply()`. The frontend `SessionSource` contract stays — that was
designed for exactly this swap.

### 4.2 Memory — the thing that makes it a Primer

A tutor who forgets is not a tutor. Three layers, each built on the one below.

**Layer 1 — the turn log (raw, permanent).** Every single thing that happened, in order.

```
session_event: who spoke, what kind of move, the exact text, the skill,
               was it right, how many milliseconds until they answered
```

This is the ground truth. Everything else is derived from it and can be rebuilt. It is also
what the parent can read, and what we debug from.

**Layer 2 — skill state (numbers).** For each child and each skill: how strong is it, when
did we last see it, when is it due again, what is the current streak, which specific wrong
idea have we seen.

This drives the scheduler. It is spaced repetition, but for skills rather than flashcards:
a skill that is strong comes back in three weeks, a skill that is shaky comes back tomorrow.

**Layer 3 — the learner model (words).** A short written description of the child that the
tutor model reads at the top of every conversation. Written by the model, after each
session, from Layer 1 and Layer 2.

Example of what it should contain:

> Ali, 7, Grade 2. Reads at mid-Grade-1 level. Decodes CVC words reliably; still guesses on
> words with silent e. In arithmetic he knows facts to 5 instantly and counts on fingers
> above 7 — do not let this harden, keep pushing retrieval. Gives up when a question runs
> longer than two lines; keep the wording short. Loves trucks, his dog Rocky, and Minecraft
> — use these in word problems, they reliably re-engage him. Responds badly to "almost!" and
> well to being told plainly what to fix. Best sessions are 12 minutes, mornings.

That paragraph is the product. It is what a $60/hour tutor has in their head after two
months, and it is why they are worth $60 an hour.

**How it is written.** After every session, a summarizer call reads the session's events
plus the previous learner model and produces the next one. Old versions are kept, so we can
show a parent how their child changed, and so a bad summary can be rolled back.

**Time buckets.** The learner model is versioned by week, month, and school year, exactly as
you asked. A Grade 3 summary is a real artifact a parent can read at the end of the year.

**Rules that keep this safe:**
- The learner model is a description, never a judgement. No IQ, no labels, no diagnosis.
- The parent can read it, in full, at any time. If we would not show it to the parent, we
  do not write it.
- It never leaves the install unless the parent turns on a cloud model, and we say so
  plainly at that moment.

### 4.3 Curriculum — a skill graph, not a topic list

Today's curriculum JSON has units and topics. A topic like "Fractions" is too big to teach
or to measure. We need **skills**: the smallest thing a child can be good or bad at.

```
skill: id, subject, strand, code, name, band, prerequisites[]
```

Example, arithmetic:
```
NUM.CNT.20      count to 20
NUM.CNT.SKIP5   skip count by 5
ADD.FACT.10     addition facts within 10, from memory
ADD.REGROUP.2D  two-digit addition with regrouping   ← needs ADD.FACT.10
FRAC.EQUAL      a fraction is equal pieces of a whole
FRAC.COMPARE    compare fractions with the same denominator ← needs FRAC.EQUAL
```

Example, reading:
```
PA.RHYME        hear rhyme
PA.BLEND        blend three sounds into a word
PH.CVC          decode consonant-vowel-consonant words   ← needs PA.BLEND
PH.SILENT_E     decode words with silent e               ← needs PH.CVC
FL.WCPM.60      read a decodable passage at 60 words/minute
CMP.RETELL      retell what happened in a short story
```

**Why this matters.** Prerequisites turn "the child is bad at fractions" into "the child
never understood that the pieces have to be equal." That is the difference between drilling
and teaching. The graph also lets the scheduler go *backwards* when a child is stuck, which
is what a good tutor does and what our current linear topic list cannot do.

**Misconceptions are first-class.** Each skill carries a list of known wrong ideas, with a
signature that lets us detect them from the child's answer, and a specific fix.

```
skill FRAC.COMPARE
  misconception "bigger denominator means bigger fraction"
    signature: chose 1/8 over 1/3
    fix: cut the same pizza into 3 and into 8; count what one piece looks like
```

When Aria sees the signature twice, she does not hint. She reteaches with the fix.

### 4.4 Content and the quality gate

Every piece of content a child sees — a problem, an explanation, a story, a passage — passes
through the same gate before it reaches the screen. `QuestionSanitizer.java` is the first
version of this and it should grow into the full gate.

**Four checks, in order. Any failure sends the item back or drops it.**

1. **Structural.** Options are separate, exactly one is correct, the key names a real
   option, no HTML, no leaked "(Correct)" markers. *Already built.*
2. **Correct.** For arithmetic, `MathAnswerChecker` solves it independently — no model
   involved. For anything a checker cannot solve, a second model call verifies it, and
   disagreement drops the item. **We would rather show four good questions than five with
   one wrong.**
3. **Right level.** The words in the item are checked against the band's word list and
   sentence-length limit. A Grade 1 item with a three-clause sentence fails. For decodable
   reading text this is a hard filter: the passage may only use phonics patterns already
   taught to *this* child.
4. **Safe.** A classifier pass. No violence, no adult content, no frightening material, no
   request for personal information, nothing that would upset a six-year-old.

**Content is cached and reused across children.** A verified Grade 2 regrouping problem is
good for every Grade 2 child. This is how latency and cost both come down. What is *not*
shared is anything personalised to a child's life — a word problem about Ali's dog Rocky is
generated for Ali and stays with Ali.

### 4.5 The model layer

**Cloud only. No local models.** Full detail in
[`cloud-model-layer.md`](cloud-model-layer.md); the summary follows.

`LlmProvider` stays as the single port, and `AiClient` stays its only caller. Behind it,
a **registry** routes each `ModelTier` to a configured hosted endpoint.

```yaml
app:
  ai:
    routing:
      TEACH: { endpoint: anthropic-sonnet, fallback: openai-gpt }
      FAST:  { endpoint: groq-llama,       fallback: anthropic-haiku }
    endpoints:
      anthropic-sonnet: { api: anthropic, model: claude-sonnet-5, api-key: ${ANTHROPIC_API_KEY} }
      openai-gpt:       { api: openai,    model: gpt-5,           api-key: ${OPENAI_API_KEY} }
      groq-llama:       { api: openai,    base-url: https://api.groq.com/openai/v1, ... }
```

**Two adapter classes cover nearly every vendor**, because most speak the OpenAI
chat-completions format. `api: openai` with a different `base-url` covers OpenAI, Groq,
Together, Fireworks, Mistral, DeepSeek, xAI, OpenRouter and Azure. `api: anthropic` covers
the Messages API, which differs enough to need its own adapter.

**Tiers route to different vendors.** A cheap fast model for hints and grading, a strong
model for teaching and for the quality gate. This is where most of the cost control lives.

**What being cloud-only costs us**, and what we must therefore build in the same phase:

- **The offline promise is gone.** Aria needs internet. The desktop app stops bundling
  Ollama, and an Aria account becomes mandatory so we can hold the vendor key.
- **Network failure is now normal.** Retry, a fallback endpoint, a circuit breaker, cached
  content, and one plain sentence for the child.
- **Tokens cost money.** Every call is priced and logged. Cost per child per month is a
  tracked number from day one.
- **Prompt text leaves the machine.** Never identifying data. The learner model is scrubbed
  before it is sent. The parent can read every prompt we sent. See §12.

### 4.6 Voice

Non-negotiable for TK–2. A five-year-old cannot read the interface of a reading tutor.

- **Aria speaks.** Every `SAY`, `ASK` and `HINT` is spoken aloud, with the text on screen
  for older children. Audio is cached by content hash, so a repeated sentence costs nothing.
- **The child speaks.** Their answer, their question, and — critically — **them reading
  aloud**.
- **Oral reading is assessed.** When the child reads a passage, we get back what they
  actually said, word by word, with timing. From that: words correct per minute, which words
  they missed, and which *phonics patterns* those words share. That last one feeds straight
  into skill state. This is the single most valuable signal in early reading and no
  screen-only product can get it.

For the early band, voice is the primary interface and typing is the fallback. For the
senior band it is the reverse.

---

## 5. What the child actually sees

The rule from the current UI holds and gets stronger: **the child makes one choice — which
class. Everything after that is Aria's job.**

### Early band (TK–2)

- Big. Loud. Spoken. Almost no text.
- Aria's face and voice lead. The child taps, drags, or talks.
- Sessions are 8–12 minutes. Aria ends them; the child never has to decide to stop.
- Answers are tapped pictures, dragged objects, or spoken words. Never typed.
- Every session ends with the child having *read something* or *counted something* out loud.

### Middle band (3–5)

- Text and voice together. Aria speaks; the words are on screen.
- Sessions are 15–20 minutes.
- The child starts writing — a sentence, then a paragraph.
- Aria shows her reasoning, so the child learns to reason.

### Senior band (6–8)

- Quiet, clean, adult. No cartoon owl. This age reads decoration as an insult.
- Text-first. Voice available but optional.
- Sessions are 20–30 minutes.
- The work shifts from "can you do it" to "why does it work" and "explain it to me".
- Aria argues with them a little. That is the point at this age.

### The one thing the child must feel

**Never stuck, never bored.** Two wrong answers must never happen twice in a row without
Aria changing what she is doing. If a child leaves a session feeling stupid, the product has
failed, no matter what the mastery number says.

---

## 6. The three subjects, in detail

### 6.1 Reading — the hardest and most valuable

This is what a parent buys. Get it right and nothing else matters as much.

**The ladder, in order. A child cannot skip a rung.**

1. **Sounds without letters.** Hearing rhyme, clapping syllables, hearing that "cat" starts
   with /k/. Pure listening — this is why voice is required.
2. **Letters to sounds.** Each letter and common pair makes a sound.
3. **Blending.** /k/ /a/ /t/ becomes "cat". This is the moment reading clicks, and it is
   where most struggling readers stall.
4. **Decodable text.** Real sentences built *only* from patterns the child has been taught.
5. **Fluency.** Reading smoothly and fast enough that the meaning survives.
6. **Comprehension.** Retelling, predicting, and eventually inferring.

**The hard constraint.** Decodable text is only decodable if every word uses a pattern this
child already knows. If Aria has taught CVC words and not yet silent e, the passage may not
contain "make". A model will break this rule constantly unless we enforce it in code. So we
do — the passage generator gets the child's taught-pattern list, and a deterministic filter
rejects any passage containing a word outside it. This is `QuestionSanitizer` for reading.

**Assessment is oral, not multiple choice.** The child reads aloud. We measure. Multiple
choice about a passage measures reading comprehension only after fluency exists — it is a
Grade 3+ tool, and today we use it at every age, which is wrong.

### 6.2 Writing

**The ladder:** letters → words → one sentence → several sentences → a paragraph → a short
piece with a beginning, middle and end.

**How Aria coaches.** Not a grade. Not a list of every error. **One specific improvement,
and a reason.**

> "Your story has a great beginning. One thing: every sentence starts with 'Then'. Pick two
> of them and start them a different way. Try it."

The child rewrites. Aria notices the change and says so. That loop — write, one note,
rewrite, be noticed — is the whole of writing instruction.

**The child's writing is kept forever.** It is the most convincing evidence of growth a
parent will ever see, and it is the best raw material for the learner model.

### 6.3 Arithmetic

**Three different things, taught differently:**

1. **Number sense.** What numbers *mean*. Taught with the manipulatives we already have
   (`MathManipulative.tsx`) and with a number line. Never with drill.
2. **Facts to automaticity.** 7 + 8 must come back in under two seconds without counting.
   This *is* drill, spaced and timed, and it matters more than almost anything else, because
   a child who counts on fingers has no working memory left for the actual problem.
3. **Procedures and word problems.** Regrouping, long division, fractions. Here Aria works
   the problem *with* the child, one step at a time, and never gives the whole answer.

**Every arithmetic fact a child sees is verified by code, not by a model.**
`MathAnswerChecker.java` already does this for place value and plain arithmetic. It must be
widened to cover every skill in the graph, and where it cannot solve something it must defer
rather than guess — as it already correctly does for negated and comparative questions.

---

## 7. The parent

A parent does not want a dashboard. They want to know their kid is okay.

**Weekly note from Aria.** Plain language, five sentences, no charts:

> Ali did four sessions this week, 48 minutes total. He finally got two-digit addition with
> regrouping — it took three weeks and he was frustrated on Tuesday, but Thursday he got
> nine in a row. His reading is behind where I'd like: he is guessing at words with silent e
> instead of decoding them. I am going to spend more time there next week. If you can, have
> him read the attached page to you on the weekend.

**Ask Aria anything.** A parent types "is he behind in reading?" and gets a real answer,
grounded in the actual event log, in plain words, with the honest version of the truth.

**Set a goal.** "He has a spelling test Friday." Aria works it into the plan.

**Read everything.** Full transcripts of every session, always available. Nothing about
their child is hidden from them.

**Controls.** Session length, time of day, tutor personality, subjects, and whether a cloud
model may be used.

## 8. The teacher

Same agent, wider view.

- **Class report.** Who is stuck, on what, this week. Sorted by who needs help most, not
  alphabetically.
- **Ask Aria.** "Which of my students don't understand equivalent fractions?"
- **Give a directive.** "Spend the next two weeks on fractions with these six students." The
  agent takes it and adapts each child's plan.
- **Aria reports back.** Unprompted, when something matters: "Three students in your class
  have the same misconception about place value. It looks like it came from the way it was
  introduced."

---

## 9. Data model — the tables to add

```sql
-- The tutor loop
session            id, student_id, grade_id, started_at, ended_at, plan, summary
session_event      id, session_id, seq, at, actor, move, text, skill_id,
                   correct, latency_ms, payload

-- Memory
learner_model      id, student_id, period, version, written_at, body,
                   interests, reading_level, attention_minutes, superseded_by
observation        id, student_id, at, skill_id, kind, note, source_event_id

-- Curriculum
skill              id, subject, strand, code, name, band, prerequisites
skill_state        student_id, skill_id, strength, attempts, correct_streak,
                   last_seen_at, next_due_at
misconception      id, skill_id, name, signature, remediation
student_misconception  student_id, misconception_id, seen_count,
                       first_seen_at, cleared_at

-- Content
content_item       id, kind, skill_id, band, body, quality_score,
                   source_model, verified_at, times_used
speech_asset       id, content_hash, voice, path, seconds
child_writing      id, student_id, at, prompt, draft, revision, aria_note

-- Reading
phonics_pattern    id, code, name, examples, band
student_phonics    student_id, pattern_id, taught_at, mastered_at
oral_reading       id, student_id, passage_id, at, wcpm, accuracy, missed_words

-- Safety and reporting
safety_flag        id, student_id, session_id, event_id, category,
                   severity, text, parent_notified_at
parent_digest      id, parent_id, student_id, period, body, sent_at
teacher_directive  id, teacher_id, class_id, student_ids, instruction,
                   active_from, active_until
```

Flyway migrations continue from V25. All PostgreSQL — the desktop app bundles a real
PostgreSQL server so partial unique indexes and `TIMESTAMPTZ` keep working.

---

## 10. API surface to add

```
POST   /api/v1/student/session/turn          the whole tutor loop
GET    /api/v1/student/session/current       resume where they left off
POST   /api/v1/student/session/end
POST   /api/v1/student/speech/say            text  → audio  (cached)
POST   /api/v1/student/speech/hear           audio → text + timing
POST   /api/v1/student/writing               submit a draft, get one note

GET    /api/v1/parent/children/{id}/digest
POST   /api/v1/parent/children/{id}/ask
POST   /api/v1/parent/children/{id}/goal
GET    /api/v1/parent/children/{id}/transcript
GET    /api/v1/parent/children/{id}/learner-model

GET    /api/v1/teacher/classes/{id}/report
POST   /api/v1/teacher/classes/{id}/ask
POST   /api/v1/teacher/classes/{id}/directive
```

---

## 11. How we know it is good

Opinions do not count. These numbers do.

### Content quality (blocks release)

| Check | Bar | How |
|---|---|---|
| Arithmetic correctness | 100% | Every item solved independently by code |
| Non-math factual correctness | ≥ 99% | Second-model verification + human spot check |
| Exactly one correct option | 100% | `QuestionSanitizer`, already enforced |
| Reading level within band | ≥ 98% | Word list + sentence length check |
| No markup in child-facing text | 100% | `QuestionSanitizer`, already enforced |
| Decodable text uses only taught patterns | 100% | Deterministic filter |
| Safety classifier pass | 100% | Every item, no exceptions |

**A golden set.** 500 human-graded items across every band and skill, checked in to the
repo. Any prompt change or model change reruns it. A regression blocks the change. This is
the single most important piece of engineering infrastructure on the list, because without
it "the model got better" is just a feeling.

### Teaching quality

| Check | Bar |
|---|---|
| Child waits for content | < 1s at the 95th percentile |
| Two wrong answers without Aria changing approach | 0 |
| Sessions ended by the child in frustration | < 5% |
| Hint actually helps (next attempt correct) | > 60% |

### Learning (the only one that really counts)

- Growth on a standard external measure, per child, per term. Not our own score — our own
  score is easy to game and worthless to a parent.
- Words correct per minute, tracked monthly, against grade norms.
- Arithmetic fact retrieval speed, tracked monthly.

### Retention

- Does the child come back tomorrow without being made to? That is the real product-market
  fit signal, and it is the one the Primer passes and every worksheet app fails.

---

## 12. Safety and privacy — rules, not aspirations

1. **We say plainly that Aria uses a cloud model.** At signup, in plain words: what is
   sent, to which vendor, and why. Not buried in a terms page. Aria needs internet, and we
   never imply otherwise.
2. **Identifying data never leaves the machine.** A prompt carries a skill, a grade band,
   recent errors, and the scrubbed learner-model paragraph. It never carries a full name, a
   school, an address, or a parent's email. We use zero-retention API terms where a vendor
   offers them.
3. **Every child-facing output passes the safety classifier.** No exceptions, no fast path.
4. **Aria never asks for personal information.** Not address, not school, not full name, not
   a photo. If a child volunteers something sensitive, it is not written to the learner
   model.
5. **Crisis language routes to a human immediately.** If a child writes something that
   suggests harm or abuse, Aria does not attempt to counsel. She responds gently, and the
   parent is alerted at once. This path is tested and never model-dependent.
6. **The parent sees everything.** Full transcripts, the full learner model, always.
7. **No advertising, ever. No selling data, ever.** Not now, not at scale.
8. **The learner model describes, it never labels.** No diagnosis, no IQ, no "gifted", no
   "slow".
9. **Delete means delete.** A parent can erase a child's entire history, and it is gone.

---

## 13. The plan, in phases

Each phase has an exit test. Do not start the next one until it passes.

### Phase 0 — Foundation *(now)*
Full plan: [`cloud-model-layer.md`](cloud-model-layer.md).

- Provider registry, cloud only: any hosted model plugs in by config. Delete Ollama, the
  desktop supervisor, and every mention of it in the docs.
- Retry, fallback endpoint, circuit breaker, and one plain failure sentence for the child.
- Cost accounting: `V25__ai_cost.sql`, price per call, a per-child daily cap.
- The golden set: 500 human-graded items, and the harness that runs them.
- Widen `MathAnswerChecker` to cover every arithmetic skill in the graph.

> **Exit:** switching model providers is a one-line config change; running the golden set
> against a new endpoint reports correctness, latency and cost with no code change; and no
> file in the repository mentions Ollama.

### Phase 1 — The tutor loop
- `session` and `session_event` tables.
- `POST /student/session/turn`, with the eleven moves.
- Delete `chooseTopic()` and `localReply()` from the frontend.
- Aria talks: real explanation, real hints, real reteaching.

> **Exit:** a session is a conversation, not a quiz. A child can say "I don't get it" and
> get a genuinely different explanation.

### Phase 2 — Memory
- `skill`, `skill_state`, `misconception` tables; the skill graph for arithmetic and reading.
- The scheduler: spaced repetition over skills, with prerequisites.
- `learner_model`, written after every session, read at the top of every turn.

> **Exit:** the tutor opens a session already knowing this child, and a parent reading the
> learner model says "yes, that's him."

### Phase 3 — Voice
- Aria speaks. Audio cached by content hash.
- The child speaks, including reading aloud.
- Oral reading assessment feeding skill state.

> **Exit:** a five-year-old who cannot read can complete a full session alone.

### Phase 4 — Reading and writing to the real bar
- The phonics ladder and the decodable-text constraint filter.
- The writing coach loop: draft → one note → revision → acknowledgement.

> **Exit:** a non-reader reaches decoding CVC text, entirely inside the product, and we can
> show the parent the week it happened.

### Phase 5 — The Primer
- `narrative_thread`: a continuing story, built from this child's interests, that carries
  the lessons instead of framing them.
- The child's own life shows up in the material — their dog, their game, their questions.

> **Exit:** the child asks to use it.

### Phase 6 — Parent and teacher agents
- Weekly digest, ask-Aria, goals, transcripts.
- Class reports, directives, unprompted alerts.

> **Exit:** a parent renews without being asked, because they can see it working.

### Phase 7 — Scale
- Content cache across children, pre-generation ahead of the child.
- Tier routing: cheap model for hints and grading, strong model for teaching and gating.
- Cost per child per month measured and driven down.

> **Exit:** unit economics work at a consumer price.

---

## 14. What we deliberately do not build

Saying no is most of the plan.

- **A menu.** The child does not choose a topic, a difficulty, or an activity. They pick a
  class. That is all. Every menu we add is a decision a seven-year-old has to make and will
  make badly.
- **Mastery percentages shown to the child.** A number that goes down is a reason to quit.
- **Leaderboards or comparison to other children.** Never.
- **A streak that punishes.** Missing a day must never cost anything. Families have lives.
- **Video lessons.** That is Khan Academy and they are better at it. Our advantage is that
  Aria responds to *this* child.
- **A school-district sales motion, yet.** A parent buys this for their own child first.
- **Replacing teachers.** We say this plainly and mean it.
- **Grades.** We report growth, not marks.

---

## 15. The order to build in, if you only read one section

1. **Make the model good enough, and prove it with a golden set.** Nothing else matters
   while the tutor says 2 + 3 = 6.
2. **Move the loop to the server so Aria can actually talk.**
3. **Give her memory, so she knows the child tomorrow.**
4. **Give her a voice, so the five-year-old can use her.**
5. **Then teach reading properly** — because that is the thing a parent will pay for and
   the thing that changes a life.

Everything else is a consequence of those five.
