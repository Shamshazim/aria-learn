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
| `record_answer` / `end_session`                | `apps/voice-worker/src/session/talk-tools.ts`          |
| Sentence tap on Aria's output transcript       | `apps/voice-worker/src/session/talk-agent.ts`          |
| Worker → API client                            | `apps/voice-worker/src/api/talk-client.ts`             |
| `GET  /internal/voice/session/:id/brief`       | `apps/api/src/services/voice/talk-brief.service.ts`    |
| `POST /internal/voice/session/:id/heard`       | `apps/api/src/services/voice/talk-events.service.ts`   |
| `POST /internal/voice/session/:id/spoken`      | `apps/api/src/services/voice/talk-events.service.ts`   |
| Shared shapes                                  | `packages/shared/src/protocol/talk.ts`                 |

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

## Known gaps

- Aria's free speech is not shown as captions in the browser; the child hears it and the API
  records it, but the screen shows only the moves (the question, the choices).
- The rule-based unsafe-output check is narrow; the FAST-tier `classify-safety` prompt is not
  yet on this path.
- Retention: child audio reaches the realtime vendor. `voice-processor-map.md` carries the
  row; counsel review is required before any child who is not a consented tester hears it.
- The original spike's measurement (`voice:s2s-compare`, `s2s-metrics.ts`) still runs and
  still needs twenty rubric-scored sessions per arm before P2-01 records a provider decision.
