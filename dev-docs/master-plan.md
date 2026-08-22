# Aria Learn — Master Plan

**What this document is:** the full specification for turning Aria Learn from a question
generator into a real tutor. It is written in plain words on purpose. Anyone on the team —
engineer, teacher, parent, investor — should be able to read it end to end and know what we
are building and why.

**Status:** draft 3. Written 2026-08-21, revised 2026-08-22 for the rewrite and the
proactive-tutor architecture.

**Read first:** [`rewrite.md`](rewrite.md) — the first version is frozen under `legacy/` and
the product is being rebuilt on React + TypeScript, Node + Express and PostgreSQL. This
document says what to build; `rewrite.md` says what we start from. The decisions here all
hold. Legacy class names are historical references, not modules that must be reproduced.

**Source of truth:** the behaviour in this document is authoritative. The existing student
session UI is the only implementation that carries forward, and it carries forward as a
visual and experiential starting point, not as a fixed architecture. Its components, state
machine, API contract and interaction flow may all change when the behaviour here requires
it. Everything else under `legacy/` is historical evidence and optional inspiration only:
it is never copied, imported or treated as a contract.

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

**The first version is frozen and the tree is empty.** Everything described below as
"built" was built in Java/Spring and now lives under `legacy/`. It runs nowhere, it is
never edited, and it is not a starting point. What we carry forward and what we rebuild is
set out in [`rewrite.md`](rewrite.md). Read that first.

### What exists, and what it is worth to us

| Built in the first version | Where it stands now |
|---|---|
| **Student session UI** — four screens, three age bands, class picker then Aria runs the session. No topic list, no mastery percentage, no menu. | **The only implementation that carries forward.** Keep its age-band design and child-focused simplicity where they serve this plan. Change its components, state machine and contracts whenever the new tutor requires it. See [`rewrite.md`](rewrite.md) §2. |
| **Question generation with structural repair** — `QuestionSanitizer`, `MathAnswerChecker`, `AnswerMatcher`. | Historical evidence only. The defect cases are useful inputs to new tests; the code and architecture do not carry forward. |
| **Curriculum JSON** — math and English, units, topics, objectives. | Reference material only. The new skill graph is authored and validated for this product rather than moved automatically. |
| **The data model** — 24 migrations that worked. | Reference material only. New migrations start at `001` from the requirements below. |
| **Auth, parents, students, enrolment, JWT.** | Rebuilt from current requirements. No old contract is presumed. |
| **Tutor personalities**, database-driven. | Inspiration only. The new relationship and voice design decides the shape. |
| **Progress, mastery, gamification, homework.** | Rebuilt to the plan below, not translated. |
| **Desktop app** — Electron, bundled JRE, PostgreSQL and Ollama, fully offline. | **On hold.** Cloud-only removed the offline argument. See [`rewrite.md`](rewrite.md) §6. |

### What was never built, and the honest name for it

These are the gaps the rewrite exists to close. Every one of them was true of the first
version and is still true today.

**There was no agent.** What we had was twelve one-shot JSON generators — knowledge,
practice, hint, and so on. Each call was stateless, and the context handed to the model was
subject, grade, topic and objectives. There was nothing about the child in it. Not their
age band, not their reading level, not what they got wrong an hour ago. The only per-child
input the model ever received was a personality string.

**A session was one question.** Guided practice generated exactly one `MEDIUM` question.
That was the whole lesson.

**Aria did not speak.** "Ask Aria" was answered by `sources/replies.ts::localReply()` — a
regular expression running in the browser that matched words like "stuck" and returned the
hint the grader had already sent. That file does not get copied into the new tree.

**Nothing was remembered.** No table recorded what happened in a session. When the child
closed the tab, everything except a score was gone.

**The model was not good enough.** `qwen2.5:7b` and `qwen2.5:3b` on Ollama, 6 to 38 seconds
per question. It wrote arithmetic that was wrong. It wrote HTML tags into question text. It
wrote Grade 7 vocabulary for a Grade 1 child, because it was never told the child was in
Grade 1. **This is why the new stack is hosted models only** — a tutor that is sometimes
wrong about 7 + 8 is not a tutor. See [`cloud-model-layer.md`](cloud-model-layer.md).

**A child who cannot read could not use it.** The whole product was text on a screen. Our
youngest and most important user — the five-year-old learning to read — cannot use a
reading tutor that requires them to read.

### The nine gaps

| # | Gap | First version | Needed |
|---|---|---|---|
| 1 | **Model quality** | `qwen2.5:7b`, wrong math, HTML, 6–38s | Hosted models, pluggable by config; a quality gate that blocks bad output |
| 2 | **No conversation** | `localReply()` regex in the browser | A server turn where Aria actually talks |
| 3 | **No memory** | nothing recorded | Evidence-backed memory, from this turn to this year |
| 4 | **No plan** | `chooseTopic()` picked the first unlocked topic | A skill graph and a scheduler that decides what is next |
| 5 | **No voice** | text only | Aria speaks; the child speaks back |
| 6 | **No real reading instruction** | multiple choice about text | Phonics ladder, decodable text, oral reading |
| 7 | **No real writing instruction** | multiple choice about grammar | The child writes; Aria coaches |
| 8 | **No parent or teacher agent** | static charts | Ask Aria a question, get a real answer |
| 9 | **No safety layer** | structural checks only | Content classifier, transcript review, crisis routing |

---

## 4. The architecture we are building toward

One relationship runtime, supported by memory, curriculum, verified content and models.
Arrival and conversation are not UI polish around the tutor loop; they are how the loop
begins and continues.

```
                        ┌──────────────────────────┐
 child arrives/speaks → │  PRESENCE + TUTOR LOOP   │ → Aria initiates/speaks/shows
       types/acts      → │ (events and safe moves) │
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

### 4.1 Presence and the tutor loop

**This is the heart of the product.** Aria is not a function the child invokes after
pressing her face. She is present when the child arrives, initiates the relationship, and
then runs the lesson one safe move at a time. The server owns that state because it is the
only place that can combine today's context with the child's history.

The relationship starts before a class is chosen:

```
1. The student home opens and sends ARRIVED.
2. Load the child's name, last session, due skills, active goals and recent preferences.
3. Return an immediate WELCOME, CHECK_IN and optional RECOMMENDATION.
4. The child chooses a class or accepts Aria's recommendation.
5. Create or resume the session and continue through the same event loop.
```

The welcome is prepared ahead of time or assembled from verified templates, so it does not
wait on a model. It should sound like continuity, not surveillance: "Welcome back, Ajmal.
Yesterday you stuck with regrouping even when it was hard. How are you feeling today?"

**Events Aria receives:**

| Event | Meaning |
|---|---|
| `ARRIVED` | The student home became active |
| `SUBJECT_CHOSEN` | The child picked a class or accepted a recommendation |
| `ANSWER` | A tap, drag, typed answer or final spoken answer |
| `QUESTION` | The child asks Aria something |
| `CONFUSED` | "I don't get it" or an equivalent signal |
| `SPEECH_PARTIAL` / `SPEECH_FINAL` | Live transcription while the child talks |
| `SILENCE` | The child has not responded within the age-appropriate window |
| `INTERRUPT` | The child starts talking while Aria is speaking |
| `PAUSE` / `RESUME` / `LEAVE` | Session lifecycle and recovery |

**Moves Aria can make:**

| Move | When | Example |
|---|---|---|
| `WELCOME` | The child arrives | "Welcome back, Ajmal. How are you today?" |
| `CHECK_IN` | Aria needs the child's preference or current state | "Do you want something easy to start, or are you ready for a challenge?" |
| `RECOMMEND` | Aria has a useful plan but the child still chooses the class | "Reading is due today. I think we should start there." |
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

These events and moves form a new shared protocol. The carried-forward UI renders them; it
does not dictate them. Its old `start/answer/hint/next/ask` contract is not preserved.

**How Aria decides.** A turn is a controlled loop with tools, not one unconstrained model
call:

```
1. Load: current session + relevant learner facts and episodes + skill state + active goals.
2. Apply deterministic policy first: safety, session limits, due skills and known fixes.
3. Ask the planner model for the next allowed move when judgement is required.
4. If the move needs content:
      a. Look in the verified content cache first.
      b. If empty, generate it.
      c. Run the QUALITY GATE — correctness, reading level and safety.
      d. If it fails, regenerate once, then use verified fallback content.
5. Write the input, decision, move and evidence to session_event.
6. Update skill state and evidence-backed observations.
7. Send the move through the text or real-time voice channel.
```

**Latency rule: the child never watches a model work.** Arrival, acknowledgement and common
teaching moves come from prepared plans, verified templates or cached content. Generation
runs ahead while the child is occupied. An arbitrary question can still require a model;
in that case Aria acknowledges it immediately and begins the first gated sentence as soon
as it is safe. The UI never shows a model spinner or claims that zero network latency is
possible.

**Safety rule: raw model tokens never go straight to a child.** Streaming may happen inside
the service, but a complete sentence-sized segment must pass the applicable correctness,
level and safety checks before it is displayed or spoken. Content that requires whole-item
verification is buffered until the entire item passes.

### 4.2 Memory — the thing that makes it a Primer

A tutor who forgets is not a tutor. A tutor who confidently remembers something false is
worse. Four layers, each evidence-backed and rebuildable from the one below.

**Layer 1 — the turn log (raw, retained until deletion).** Every single thing that happened,
in order.

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

**Layer 3 — relationship memory (facts and episodes).** Typed claims about the child, each
with source event IDs, confidence, first observed, last confirmed, sensitivity and an
optional expiry. Stable preferences ("likes trucks"), teaching responses ("shorter prompts
help"), goals and important episodes ("place value clicked after three weeks") are kept
separately. A temporary mood is never promoted into a stable trait without repeated
evidence.

The tutor retrieves only the facts and episodes relevant to the current moment. A parent or
child can correct them — "I don't like Minecraft anymore" — and a correction supersedes the
old claim without erasing its audit history.

**Layer 4 — the learner brief (words).** A short, parent-readable description that the tutor
reads at the top of a conversation. It is a generated view of Layers 1–3, never the
authoritative memory itself.

Example of what it should contain:

> Ali, 7, Grade 2. Reads at mid-Grade-1 level. Decodes CVC words reliably; still guesses on
> words with silent e. In arithmetic he knows facts to 5 instantly and counts on fingers
> above 7 — do not let this harden, keep pushing retrieval. Gives up when a question runs
> longer than two lines; keep the wording short. Loves trucks, his dog Rocky, and Minecraft
> — use these in word problems, they reliably re-engage him. Responds badly to "almost!" and
> well to being told plainly what to fix. Best sessions are 12 minutes, mornings.

That paragraph is one useful view of the product. The evidence beneath it is what keeps the
relationship trustworthy over months and years.

**How it is written.** After every session, consolidation proposes new facts and episodes
from that session's events. Deterministic rules and confidence thresholds decide what may
become durable. The learner brief is regenerated from current evidence, not recursively
summarised from the previous paragraph. It is also periodically rebuilt from the raw log so
summary drift can be detected. Old versions are kept so a parent can see change and a bad
version can be rolled back.

**Time buckets.** The learner brief is versioned by week, month and school year. A Grade 3
summary is a real artifact a parent can read at the end of the year.

**Rules that keep this safe:**
- The learner brief and relationship facts describe, never judge. No IQ, labels or diagnosis.
- The parent can read it, in full, at any time. If we would not show it to the parent, we
  do not write it.
- Account and identifying data stay inside Aria's service boundary. Only the minimum
  scrubbed teaching context is sent to a configured model vendor, and the parent is told
  that plainly at signup.
- Temporary engagement state expires; it is not a permanent label.

### 4.3 Engagement and affect

Aria adapts to how the child appears to be doing now, but she does not pretend to read a
mind. The safest signals come first: what the child explicitly says, repeated errors,
response latency, silence, shortened answers, requests to stop and optional vocal cues when
the parent has consented.

Each session has a temporary engagement state such as `ready`, `uncertain`, `frustrated`,
`tired` or `disengaged`, with evidence, confidence and an expiry. Low-confidence inferences
cause a check-in, not a declaration:

> "You seem a little tired. Do you want an easier five minutes, or should we stop for today?"

Aria may shorten a prompt, switch modality, offer a break or change subject. She never
diagnoses, stores a single mood as a personality trait, or uses camera-based emotion
recognition. The raw signal and Aria's response are logged so false inferences can be
measured.

### 4.4 Curriculum — a skill graph, not a topic list

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

### 4.5 Content and the quality gate

Every piece of content a child sees — a problem, an explanation, a story, a passage — passes
through the same gate before it reaches the screen. Build the gate from the requirements
below. The defects recorded by the legacy sanitizer are useful regression cases, not the
design or implementation to copy.

**Four checks, in order. Any failure sends the item back or drops it.**

1. **Structural.** Options are separate, exactly one is correct, the key names a real
   option, no HTML, no leaked "(Correct)" markers. Build these deterministic checks fresh.
2. **Correct.** For arithmetic, a deterministic checker solves it independently — no model
   involved. Other factual content is grounded in an approved curriculum source or reviewed
   content bank wherever possible. A second model may flag a problem, but agreement between
   two models is not proof; unsupported generated facts are dropped. **We would rather show
   four good questions than five with one wrong.**
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

### 4.6 The model layer

**Cloud only. No local models.** Full detail in
[`cloud-model-layer.md`](cloud-model-layer.md); the summary follows.

Build one `LlmProvider` port and make a new `AiClient` its only caller. Behind it, a
**registry** routes each `ModelTier` to a configured hosted endpoint.

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

- **The offline promise is gone.** Aria needs internet, and an Aria account becomes
  mandatory so we can hold the vendor key. Whether a desktop app survives at all is now an
  open question — see [`rewrite.md`](rewrite.md) §6.
- **Network failure is now normal.** Retry, a fallback endpoint, a circuit breaker, cached
  content, and one plain sentence for the child.
- **Tokens cost money.** Every call is priced and logged. Cost per child per month is a
  tracked number from day one.
- **Prompt text crosses the model-vendor boundary.** Never identifying data. Retrieved
  learner context is scrubbed before it is sent. The parent can inspect the child-facing
  transcript and the categories of learner context shared. See §12.

### 4.7 Voice

Non-negotiable for TK–2. A five-year-old cannot read the interface of a reading tutor.

- **Aria speaks.** Every `WELCOME`, `CHECK_IN`, `RECOMMEND`, `SAY`, `ASK` and `HINT` can be
  spoken, with text on screen for accessibility and older children. Reusable audio is
  cached by content hash; personalised dialogue is streamed.
- **The child speaks naturally.** Their answer, their question and — critically — **them
  reading aloud**. The normal flow is not "record, upload, wait, play a file".
- **Conversation is live and interruptible.** The transport supports streaming audio and
  partial transcripts, voice-activity detection, end-of-turn detection, barge-in, immediate
  cancellation of Aria's speech, silence handling and recovery after a dropped connection.
- **The product owns the conversation protocol.** WebRTC is preferred for browser audio;
  WebSocket is acceptable for events or as a fallback. Vendor-specific real-time APIs stay
  behind the model and speech ports so changing a provider does not rewrite the UI.
- **Oral reading is assessed.** When the child reads a passage, we get back what they
  actually said, word by word, with timing. From that: words correct per minute, which words
  they missed, and which *phonics patterns* those words share. That last one feeds straight
  into skill state. This is the single most valuable signal in early reading and no
  screen-only product can get it.

**Browser reality.** A first visit cannot be guaranteed to play audible speech before any
interaction: browsers commonly block autoplay with sound. The welcome therefore appears
visually immediately and Aria speaks automatically whenever the browser permits it. When
activation is required, the child's natural class selection or one clear "I'm ready" action
unlocks audio — never a demand to click Aria's face or mouth. The app detects playback
failure and recovers visibly. See the official [Chrome autoplay policy](https://developer.chrome.com/blog/autoplay/)
and [browser autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay).

Microphone permission, device selection, a short parent-friendly sound check, captions,
mute and a text/tap fallback are part of the voice feature, not onboarding cleanup.

For the early band, voice is the primary interface and typing is the fallback. For the
senior band it is the reverse.

---

## 5. What the child actually sees

The rule the session UI was built on holds and gets stronger: **the child makes one choice
— which class. Everything after that is Aria's job.** Aria greets the child before that
choice, may recommend a class and accepts a different choice without judgement.

The existing class picker and three age-band session layouts carry forward as the visual
starting point. Preserve their simplicity and age-appropriate design where it works. Their
components, controls, state machine and layout may change to support arrival, live speech,
interruption, dragging, multimodal teaching and any other behaviour required here. See
[`rewrite.md`](rewrite.md) §2.

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
rejects any passage containing a word outside it. It is a new deterministic reading gate.

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

**The child's writing is retained as part of their history until the parent deletes it.** It
is the most convincing evidence of growth a parent will ever see, and it is some of the best
raw material for learner memory.

### 6.3 Arithmetic

**Three different things, taught differently:**

1. **Number sense.** What numbers *mean*. Taught with the manipulatives we already have
   (`MathManipulative.tsx`) and with a number line. Never with drill.
2. **Facts to automaticity.** 7 + 8 must come back in under two seconds without counting.
   This *is* drill, spaced and timed, and it matters more than almost anything else, because
   a child who counts on fingers has no working memory left for the actual problem.
3. **Procedures and word problems.** Regrouping, long division, fractions. Here Aria works
   the problem *with* the child, one step at a time, and never gives the whole answer.

**Every arithmetic fact a child sees is verified by code, not by a model.** Build a new
deterministic solver for every supported arithmetic skill. The legacy checker's accepted and
refused examples may seed regression tests. Where the new solver cannot prove an answer, it
must defer rather than guess.

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

**Controls.** Session length, time of day, tutor personality, subjects, voice, microphone,
personalisation, retention and which optional relationship facts may be sent in scrubbed
form to the cloud model. Cloud inference itself is required for the product and is disclosed
at signup; there is no control that silently turns it off while implying the tutor still
works normally.

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
                   correct, latency_ms, evidence, payload
arrival_event      id, student_id, at, welcome_kind, recommendation, accepted

-- Memory
learner_fact       id, student_id, kind, value, confidence, first_observed_at,
                   last_confirmed_at, expires_at, sensitivity, superseded_by
learner_fact_evidence fact_id, source_kind, source_id, recorded_at
learner_episode    id, student_id, at, kind, summary, importance, source_session_id
learner_brief      id, student_id, period, version, written_at, body, superseded_by
observation        id, student_id, at, skill_id, kind, note, confidence,
                   expires_at, source_event_id

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

These are new tables in a new database. Migrations start at `001` — the 24 Flyway
migrations under `legacy/` are a reference for the shapes that worked, not a sequence to
continue. PostgreSQL throughout, so partial unique indexes and `TIMESTAMPTZ` are available
and used.

---

## 10. API surface to build

```
POST   /api/v1/student/arrival               welcome, check-in and class recommendation
POST   /api/v1/student/session               create a session and return its first moves
POST   /api/v1/student/session/turn          text and non-realtime fallback turns
GET    /api/v1/student/session/current       resume where they left off
POST   /api/v1/student/session/end
POST   /api/v1/student/session/{id}/realtime negotiate a short-lived live session
WS/WebRTC /api/v1/student/session/{id}/live  audio, transcript, events and interruptions
POST   /api/v1/student/writing               submit a draft, get one note

GET    /api/v1/parent/children/{id}/digest
POST   /api/v1/parent/children/{id}/ask
POST   /api/v1/parent/children/{id}/goal
GET    /api/v1/parent/children/{id}/transcript
GET    /api/v1/parent/children/{id}/learner-memory
POST   /api/v1/parent/children/{id}/learner-memory/correct

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
| Non-math factual correctness | ≥ 99% on the human-graded set | Approved sources + deterministic rules where possible; model review is only an additional signal |
| Exactly one correct option | 100% | New deterministic structural gate |
| Reading level within band | ≥ 98% | Word list + sentence length check |
| No markup in child-facing text | 100% | New deterministic structural gate |
| Decodable text uses only taught patterns | 100% | Deterministic filter |
| Safety classifier pass | 100% | Every item, no exceptions |

**A golden set.** Start with 500 human-graded items across every band and the representative
skill families in the initial release scope. Before a new skill ships, its cases and quality
bar are added. Any prompt or model change reruns the set. A regression blocks the change.
This is the single most important piece of engineering infrastructure on the list, because
without it "the model got better" is just a feeling.

### Teaching quality

| Check | Bar |
|---|---|
| Child waits for content | < 1s at the 95th percentile |
| Two wrong answers without Aria changing approach | 0 |
| Sessions ended by the child in frustration | < 5% |
| Hint actually helps (next attempt correct) | > 60% |

### Relationship and conversation quality

| Check | Bar |
|---|---|
| Visible personalised welcome after arrival | < 500ms at the 95th percentile |
| Audible welcome after audio is activated | Starts < 1s at the 95th percentile |
| Child interruption stops Aria's speech | < 250ms at the 95th percentile |
| Correct end-of-turn detection in the voice test set | ≥ 98% |
| Durable learner fact has supporting evidence | 100% |
| Parent corrections reflected in the next session | 100% |
| Low-confidence affect inference stated as fact | 0 |
| Human tutor rates the response warm, age-appropriate and pedagogically useful | ≥ 90% |

A second golden set covers multi-turn tutoring, not content items: arrival after an absence,
a tired child, an interruption, repeated confusion, a changed preference, a recalled
breakthrough, a safety disclosure and a resumed session. Model, prompt, memory and voice
changes rerun it. Before calling a phase successful, teachers and families observe real
children using the relevant slice; a model grading its own tutoring is not acceptance.

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
2. **Identifying data never crosses the model-vendor boundary.** Aria's own service must hold
   account and learner data to provide the product. A vendor prompt carries only the minimum
   skill, grade band, recent evidence and scrubbed learner context required for the turn. It
   never carries a full name, school, address or parent email. We use zero-retention API
   terms where a vendor offers them.
3. **Every child-facing output passes the safety classifier.** No exceptions, no fast path.
4. **Aria never asks for personal information.** Not address, not school, not full name, not
   a photo. If a child volunteers something sensitive, it is not promoted into durable
   learner memory.
5. **Crisis language routes to a human immediately.** If a child writes something that
   suggests harm or abuse, Aria does not attempt to counsel. She responds gently, and the
   parent is alerted at once. This path is tested and never model-dependent.
6. **The parent sees and can correct the learner memory.** Full transcripts, learner facts,
   episodes and briefs are available. Corrections take effect in the next session.
7. **No advertising, ever. No selling data, ever.** Not now, not at scale.
8. **Learner memory describes, it never labels.** No diagnosis, no IQ, no "gifted", no
   "slow".
9. **Delete means delete.** A parent can erase a child's entire history, and it is gone.

---

## 13. The plan, in phases

Each phase has an exit test. Do not start the next one until it passes.

### Phase 0 — Foundation *(now)*
Full plan: [`cloud-model-layer.md`](cloud-model-layer.md).

- Scaffold the workspace and bring the student session UI across as the visual starting
  point. See [`rewrite.md`](rewrite.md) §5.
- Replace its old question-oriented interface with shared event and move types that express
  arrival, proactive moves, live voice, interruption and multimodal teaching. A scripted
  source drives every event before the backend exists.
- Provider registry, cloud only: any hosted model plugs in by config. Built fresh in
  TypeScript — there is nothing to delete, because no local-provider code is written.
- Retry, fallback endpoint, circuit breaker, and one plain failure sentence for the child.
- Cost accounting: an `ai_cost` migration, price per call, a per-child daily cap.
- The content golden set: 500 human-graded items, and the harness that runs them.
- The multi-turn tutoring golden set and its human-review rubric.
- A small verified fallback-content cache and ahead-of-turn generation interface. These are
  reliability primitives, not Phase 7 optimisations.
- Define the bounded initial skill inventory used by both golden sets.
- Implement a new deterministic arithmetic checker for every arithmetic skill in that
  initial inventory, using legacy defect cases only as optional regression inputs. Adding a
  later arithmetic skill requires its checker and golden cases before release.

> **Exit:** the four session screens render in all three bands in the new frontend;
> scripted arrival, conversation and interruption events render without the old
> `SessionSource` contract; switching model providers is a one-line config change; and both
> golden sets report quality, latency and cost with no code change.

### Phase 1 — The proactive tutor loop, text first
- `arrival_event`, `session` and `session_event` tables.
- `learner_fact`, `learner_fact_evidence`, a minimal `skill`/`skill_state` graph and active
  goals, so the first real tutor loop does not pretend to load memory that does not exist.
- `POST /student/arrival`: personalised welcome, check-in and a class recommendation before
  the child chooses.
- The event/move tutor loop with verified fallback content and generation ahead of need.
- Text and tap input first; the UI shows exactly when Aria is thinking, listening or ready.
- Real explanation, hints, reteaching, switching and session endings.

> **Exit:** Aria greets a returning child from evidence, recommends what to do, accepts a
> different class, and conducts a complete multi-turn session. A child can say "I don't get
> it" and receive a genuinely different explanation. Returning tomorrow, Aria accurately
> recalls at least one supported fact from today.

### Phase 2 — Real-time voice
- The live session transport designed in Phase 0: streaming input and output, partial
  transcripts, voice activity, end-of-turn detection and reconnect.
- Spoken arrival after browser activation, with visible fallback when autoplay is blocked.
- Barge-in: the child can interrupt Aria and playback stops immediately.
- Microphone permission, sound check, captions, mute, device recovery and text/tap fallback.
- Oral-reading timing events are captured, even before the full reading curriculum lands.

> **Exit:** a five-year-old who cannot read can complete a full session alone, can interrupt
> Aria naturally, and never needs to press Aria's face to make her speak.

### Phase 3 — Durable relationship memory and engagement
- `learner_episode`, `learner_brief` and correction history, expanding the evidence-backed
  facts established in Phase 1.
- Consolidation after each session, relevant-memory retrieval per turn, expiry and conflict
  resolution, plus periodic rebuilding from raw events.
- The full skill graph and scheduler: spaced repetition, prerequisites and misconceptions.
- Temporary, confidence-scored engagement state with check-ins and adaptation policies.
- Weekly, monthly and school-year learner briefs.

> **Exit:** the tutor opens already knowing the child without inventing facts; every durable
> claim links to evidence; a parent can correct it; and Aria changes approach when a child
> appears tired or frustrated without turning a temporary state into a permanent label.

### Phase 4 — Reading and writing to the real bar
- The phonics ladder and the decodable-text constraint filter.
- Oral reading assessment feeding phonics and skill state.
- The writing coach loop: draft → one note → revision → acknowledgement.

> **Exit:** a non-reader reaches decoding CVC text entirely inside the product, and we can
> show the parent the week it happened.

### Phase 5 — The Primer
- `narrative_thread`: a continuing story, built from this child's current interests, that
  carries the lessons instead of merely framing them.
- The child's own life shows up only through consented, current relationship facts.

> **Exit:** the child asks to use it.

### Phase 6 — Parent and teacher agents
- Weekly digest, ask-Aria, goals, transcripts and memory correction.
- Class reports, directives and unprompted alerts with explicit notification rules.

> **Exit:** a parent renews without being asked because they can see it working.

### Phase 7 — Scale
- Expand and share verified non-personalised content across children; optimise the cache and
  pre-generation that have existed since Phase 0.
- Tier routing: cheap model for hints and grading, strong model for teaching and gating.
- Cost per child per month measured and driven down.

> **Exit:** unit economics work at a consumer price without weakening the quality bars.

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

1. **Define the new event/move contract and prove model quality.** The existing UI is the
   visual starting point, not the tutor architecture. Nothing else matters while the tutor
   can say 2 + 3 = 6.
2. **Make Aria present.** Arrival, a proactive welcome, a recommendation, a real text-first
   tutor loop, minimal evidence-backed memory and verified fallback content ship together.
3. **Make the conversation live.** Add streaming voice, natural turn detection,
   interruption and browser-permission recovery so a five-year-old can use it.
4. **Make the relationship durable.** Add evidence-backed facts and episodes, retrieval,
   correction, engagement adaptation and weekly-to-yearly briefs.
5. **Then teach reading and writing to the real bar** — because that is what a parent will
   pay for and what changes a life.

Everything else is a consequence of those five. A release that has a speaking quiz but no
arrival, interruption or trustworthy memory has not completed step 2 or 3.
