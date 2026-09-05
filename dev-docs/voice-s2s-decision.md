# Aria talks: the realtime model is Aria's voice (P2H-15, revised)

Status: **built 2026-08-28, replacing the scripted speech-to-speech spike.** The measurement
table of the original spike was never filled; the product decision was taken on the sound of
the thing instead: a tutor that recites planner sentences word for word is a robot however
fast the model behind it is.

## The decision

With `VOICE_S2S_PROVIDER=openai` the vendor's realtime model **is** Aria: it hears the child,
answers in its own voice from a brief the API wrote for this child and this topic, tells a
joke when asked, repeats the question when asked, and brings the child back to the work. The
API stays what it was for the text tutor — the curriculum, the grader, the skill state, the
memory, the crisis check — and reaches the model through two tools and three small endpoints.

The pipeline arm (STT → harness → TTS) is unchanged and is what a worker runs with the flag
unset.

| Piece                                          | Where                                                  |
| ---------------------------------------------- | ------------------------------------------------------ |
| Flag, model, voice, run log                    | `apps/voice-worker/src/session/s2s-config.ts`          |
| The session                                    | `apps/voice-worker/src/session/talk-session.ts`        |
| The brief → system prompt                      | `apps/voice-worker/src/session/talk-instructions.ts`   |
| `record_answer` / `move_on` / `end_session`    | `apps/voice-worker/src/session/talk-tools.ts`          |
| The stuck ladder and skips                     | `packages/tutor/src/policy/stuck-policy.ts`, `apps/api/src/services/tutor/session-counters.ts` |
| `show_on_screen`, answers from the screen      | `apps/voice-worker/src/session/talk-screen.ts`         |
| Sentence tap on Aria's output transcript       | `apps/voice-worker/src/session/talk-agent.ts`          |
| Worker → API client                            | `apps/voice-worker/src/api/talk-client.ts`             |
| `GET  /internal/voice/session/:id/brief`       | `apps/api/src/services/voice/talk-brief.service.ts`    |
| `POST /internal/voice/session/:id/heard`       | `apps/api/src/services/voice/talk-events.service.ts`   |
| `POST /internal/voice/session/:id/spoken`      | `apps/api/src/services/voice/talk-events.service.ts`   |
| `POST /internal/voice/session/:id/screen`      | `apps/api/src/services/voice/talk-screen.service.ts`   |
| Browser ↔ voice over the room                  | `apps/web/src/features/voice/hooks/useScreenBridge.ts` |
| Shared shapes                                  | `packages/shared/src/protocol/talk.ts`, `realtime.ts`  |

## What the model is given

The brief: the child's first name (only if the parent allowed it), grade and band; the
subject; the skill with its unit, lesson and learning objectives; the teacher's note where
the skill has one (P2H-10); the open question with its choices and — for the model's eyes
only — its answer key; what Aria remembers about the child, through the same scrubber every
prompt uses; and the minutes left. The prompt then says how Aria talks (short, specific,
one idea, reacts to what was said, answers questions and jokes briefly, comes back to the
work) and what she never does (ask for personal information, discuss violence or adult
topics, claim to be an AI).

## What stays with the API

- **Grading and progress.** `record_answer` is the pipeline's `ANSWER` turn: the same
  scorer, the model judge for spoken answers in other words, the same skill-state update, the
  same choice of next item. The tool returns the verdict, the sentences the curriculum would
  have said, and the next question; the model voices them in its own words but must keep the
  numbers and words of a question exact.
- **The transcript.** Every final child utterance is posted to `heard` and recorded as the
  `SPEECH_FINAL` the pipeline records; every sentence Aria says is posted to `spoken` and
  recorded as `SPOKEN`. Memory consolidation and the parent transcript see one kind of session.
- **Crisis.** `heard` runs the same detector and escalation as the pipeline; on a disclosure
  the worker interrupts the model and has it say the fixed crisis line, verbatim.
- **Unsafe output.** `spoken` applies the content path's unsafe-text rule; on a hit the
  worker interrupts and has the model apologise and return to the question. The cut is
  measured in sentences, not words: that is what a spoken conversation can offer, and it is
  the price of a tutor who can talk.
- **Silence and endings.** The P2H-01 ladder still runs; a rung is voiced in the model's
  words. `end_session` goes through the policy path a child saying "stop" reaches, so every
  ending is recorded like every other.

## The screen is part of the conversation

The voice and the screen stay in step both ways; nothing on either side is scripted around
the other.

- **Voice → screen.** Every question `record_answer` returns is already on the screen: the
  worker publishes the `ASK` on `aria.moves` and the browser renders it through the move
  registry, choices and all. For everything else Aria wants the child to see she calls
  `show_on_screen` with one of five surfaces — `writing` (a text area under her prompt),
  `text` (something to read), `number` (a problem with a number pad), `choices` (options to
  tap), `clear`. The API records the surface as a `SHOW` move with `display` and `expects`,
  queues it in the outbox, and returns it; the worker publishes it like any move.
- **The open question owns the screen.** The browser keeps the latest `ASK` as the open
  question until a verdict (`PRAISE`, `REVEAL`), a `SWITCH`, a `BREAK` or an `END` closes it,
  and the answer control on screen is always the open question's, keyed by its id
  (`screen-composition.ts`). A hint, a picture or something Aria put up to read is a card
  beside it, never a replacement; the one thing that changes the control is a writing pad
  Aria opened for a question answered in words, which dresses that question so what is
  written in it is graded as its answer. The worker enforces the same rule on the tool side:
  while a question is open, `show_on_screen` allows one `text` beside it and one `writing`
  pad for a text question, and refuses `choices`, `number`, `clear` and repeats with an
  instruction that tells the model the screen stays as it is. Before this the model put its
  own surfaces over the question after it had already spoken, so the screen changed several
  times per question and lagged the voice; now a question's screen is set the moment
  `record_answer` returns, before Aria says it, and holds until the child answers.
- **Screen → voice.** Where the worker announced `WORKER_READY { talks: true }`, the browser
  sends what the child taps or types as `SCREEN_ANSWER { moveId, text }` over the room
  instead of to the API. An answer to the open `ASK` is graded by the same path
  `record_answer` takes, and the model is told what the child chose and how it was graded;
  anything else (a paragraph in the writing pad) is posted to `heard` with `via: screen` for
  the transcript and the crisis check, then given to the model as words the child typed.
  "End session" on the screen sends `LEAVE`, and Aria says goodbye instead of carrying on.
- **What either side said.** The worker publishes `CAPTION` for each sentence Aria says and
  `HEARD` for each final child transcript; the browser shows both under the voice controls.
- With the flag unset the pipeline worker ignores `SCREEN_ANSWER` and `LEAVE`, and the
  browser never sends them, because `talks` is false.

## A child who is stuck, or done with a question

The first build could only re-ask. "I don't know" was classified as confusion, confusion earned
a reteach, and a reteach re-asked the same question — so a child who shrugged three times
heard the same question four times, and the realtime model, told never to invent a question
and never to move on, had nothing else to do. Two things changed (2026-09-04).

- **The policy counts turns that went nowhere, per item.** `consecutiveStuck` in
  `@aria/tutor` is the number of wrong answers, "I don't know"s and skips since the current
  question was first asked. It drives one ladder for all of them: a hint, then the idea
  another way, then the answer (`REVEAL:move-on`) and a fresh question. It starts again at
  zero on a new item, which the old wrong-answer count never did — the first miss on a new
  question could be met with the answer. "Skip", "next one", "I give up" is its own intent
  (`SKIP_REQUEST`) and its own event (`SKIP`), honoured at once. Three right in a row with a
  next topic in the grade is a `SWITCH:next-topic`, and the commit moves the session onto it;
  before this a `SWITCH` announced a change of step and kept asking about the old skill.
- **The voice has a third tool.** `move_on(reason)` sends `SKIP` through the same turn path;
  `record_answer` is now called for anything the child says in response to the question,
  including "I don't know", so the API's ladder decides what comes next rather than the
  model. The prompt says so in words as well: never a fourth asking, never word-for-word,
  call `move_on` when the child asks or has stopped engaging. When a turn switches topic the
  worker fetches the brief again and rewrites the agent's instructions around it.
- **The screen has a skip button** (`SessionControls`), which reaches the voice as
  `SCREEN_SKIP` where Aria talks and the API as `SKIP` otherwise.

## The screen follows the voice

Three things kept the screen and the voice out of step, all fixed the same day.

- The browser ran its own silence countdown beside the worker's, from a status line that
  said "explaining" from the moment a spoken move arrived until the next tap. Two timers on
  one child meant two nudges and two re-askings of the question under new ids, after which
  the worker's idea of the open question was stale and a tap on the screen was read to the
  model as typed words. The browser's timer is now suspended while a voice worker is
  connected, and the status line follows the worker: `AGENT_STATE` (`listening`,
  `thinking`, `speaking`) is published on every agent state change and reduced into the
  session state (`VOICE_STATE`); the pipeline's `SPEECH_FINISHED` does the same. With no
  voice at all a move is "explained" the moment it is on screen (`SPEECH_SETTLED`).
- The screen showed the move's stored line while Aria said something else. Where she talks,
  the layouts now show her own words as she says them (`LiveSpeech`, fed by `CAPTION` and
  reset on each new `speaking`), keep a question's exact text, and drop the stored line and
  its duplicate text body from a hint, praise or reveal card.
- The ordering rule stands: a question's screen is set the moment `record_answer` or
  `move_on` returns, before Aria says it, and holds until the child answers or skips.

Prior art looked at while designing this: Khan Academy's Khanmigo (Socratic by design, and
the published finding that its refusal to move on is where students disengage), the
TutorBot-DPO work from UMass (AIED 2025) on strategic hinting and withholding as trainable
pedagogical principles, and OATutor's multi-path hint ladders. None ship a "move on" rule; the
ladder here is the one a human tutor follows.

## Known gaps

- The rule-based unsafe-output check is narrow; the FAST-tier `classify-safety` prompt is not
  yet on this path.
- Retention: child audio reaches the realtime vendor. `voice-processor-map.md` carries the
  row; counsel review is required before any child who is not a consented tester hears it.
- The original spike's measurement (`voice:s2s-compare`, `s2s-metrics.ts`) still runs and
  still needs twenty rubric-scored sessions per arm before P2-01 records a provider decision.
