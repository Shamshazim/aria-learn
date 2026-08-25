# P2H-05 — Free conversation: intent classification

| | |
|---|---|
| **Phase** | 2H |
| **Track** | Backend + Voice |
| **Depends on** | P2H-03 |
| **Blocks** | P2H-06, P3-05, P2H-14 |
| **Parallel-safe with** | P2H-04, P2H-07, P2H-08, P2H-10, P2H-12 |
| **Size** | M |
| **Status** | 🟡 Core implemented on branch `docs/harness-review-fixes` (commits `ab1ef4b`, `ccba913`), no PR yet. |

## Why

`apps/voice-worker/src/session/move-stream.ts:transcriptEvent` maps every final transcript to
`SPEECH_FINAL` (or `BACKCHANNEL`); the text turn maps typed input to `ANSWER`. So "I have a
cat" is graded as a wrong answer and earns a hint. The protocol already has `QUESTION` and
`CONFUSED`; nothing emits them. A human tutor first works out *what kind of thing* the child
just said.

## Scope

### Build
An `IntentClassifier` port with a deterministic first pass and a FAST-tier model second pass,
wired into both channels; policy handling for each intent.

### Do not build
No planner (P2H-06). No engagement state (P3-05). No new event kinds — intents map onto the
existing `TutorInputEvent` kinds plus an `intent` field on `SPEECH_FINAL`/`ANSWER`.

## Design

```
packages/shared/src/protocol/
  events.ts                     Intent = 'ANSWER'|'QUESTION'|'CONFUSED'|'CHAT'|'OFF_TOPIC'|
                                'STOP_REQUEST'|'PERSONAL_INFO'|'UNCLEAR'; ANSWER/SPEECH_FINAL gain intent?: Intent
packages/tutor/src/
  intent/intent.port.ts         IntentClassifier { classify(input): Promise<IntentResult> }
  intent/rules.ts               deterministic: stop words ("stop","I'm done"), question forms
                                ("what","why","how","is it"), confusion ("I don't get it"),
                                numeric/choice match against expects, personal-info patterns
  intent/intent.types.ts        IntentResult { intent, confidence, matchedRule? }
  policy/intent-policy.ts       intent -> allowed moves + default (table below)
apps/api/src/ai/intent/
  model-intent.classifier.ts    FAST tier, JSON, ≤ 300ms budget, falls back to rules result
  intent.prompt.ts              registered prompt
apps/api/src/services/tutor/
  tutor.service.ts              runs safety classifier -> intent -> policy, in that order
apps/voice-worker/src/session/
  move-stream.ts                transcriptEvent calls the classifier via the api (worker-turn)
```

**Order of checks, every child input**: (1) crisis/safety input classifier (P1-13) — if it
fires, no intent classification happens; (2) deterministic intent rules; (3) if rules say
`UNCLEAR` or confidence < 0.7 and the model is available, model classifier; (4) policy.

**Policy table** (`intent-policy.ts`):

| Intent | Aria does | Move(s) |
|---|---|---|
| ANSWER | grade as today | PRAISE / HINT / RETEACH / REVEAL |
| QUESTION | answer in ≤ 2 sentences, grounded in the skill or "I'm not sure, let's find out later", then re-ask the open item | SAY then ASK (two moves, one turn) |
| CONFUSED | as today | RETEACH / SHOW |
| CHAT | one warm sentence acknowledging it, then back to the item | SAY then ASK |
| OFF_TOPIC (3rd in a row) | offer a `SWITCH` or `CHECK_IN` | CHECK_IN |
| STOP_REQUEST | honour it | BREAK (early) / CHECK_IN "stop or five more minutes?" (middle, senior) |
| PERSONAL_INFO | fixed reviewed deflection, never stored, not in dialogue window | SAY (fixed text) |
| UNCLEAR | "I didn't catch that — say it again?" (varied) | ASK (`approach: 'confirm-spoken-answer'`) |

The *open item* (current `ASK` id) is preserved across a `QUESTION`/`CHAT` detour so the
re-ask is the same item, not a new one; `attempts` is not incremented by a detour.

### Edge cases
- Answer that is also a question ("is it seven?") → `ANSWER` with `confidence` lowered; graded.
- Question that contains the answer ("why is it seven?") → `ANSWER` if it matches the key,
  else `QUESTION`.
- Spoken answer with STT confidence < 0.6 → `UNCLEAR` regardless of content (rule).
- Three `UNCLEAR` in a row → `CHECK_IN` offering tap/choice input (voice may be failing).
- Child's question is about something unsafe → safety classifier already handled it (step 1).
- Child asks Aria a personal question ("where do you live?") → `CHAT` with a fixed persona
  answer ("I live in the computer!"), never a fabricated biography beyond the persona doc.
- Model classifier timeout → rules result stands; logged.
- `expects: 'tap' | 'choice'` and the child speaks → still classified (a spoken "the red one"
  is an `ANSWER` mapped to a choice by the grader if unambiguous).

## Status (2026-08-25)

- Done: rules classifier (`ANSWER`/`QUESTION`/`CONFUSED`/`CHAT`/`STOP_REQUEST`), wired into `teaching-policy` for text and voice, `QUESTION`/`CHAT` detours re-ask without counting an attempt, `STOP_REQUEST` → BREAK.
- Remaining: 60-utterance fixture, model classifier + budget fallback, `PERSONAL_INFO` path, safety-before-intent order test, golden scenario.

## Acceptance criteria

- [ ] Rules-only classification handles a 60-utterance fixture at ≥ 90% agreement with
      human labels; with the model, ≥ 95%.
- [ ] Voice and text channels emit identical intents for identical text (shared tests).
- [ ] A `QUESTION` produces a SAY followed by a re-ASK of the same item id; `attempts` unchanged.
- [ ] `STOP_REQUEST` in early band ends the session within one move.
- [ ] `PERSONAL_INFO` produces the fixed text, no model call (call count), no `session_event`
      text stored beyond a redaction marker, and no dialogue-window entry.
- [ ] Safety runs before intent: a crisis utterance never reaches the classifier (order test).
- [ ] Model classifier over budget → rules result used; metric incremented.
- [ ] P0-22 scenario "child asks a question mid-lesson" added and passing.

## Verification

```bash
npm run test -w @aria/tutor -- intent
npm run test -w @aria/api -- intent
npm run test -w @aria/voice-worker -- move-stream
npm run golden:tutoring -w @aria/api
```

## References

- `master-plan.md` §4.1 (events), §12 rule 4
- `realtime-agent-harness.md` — "IntentClassifier port", "Voice safety"
- P1-13, P2H-03
