# P3-05 — Engagement state and adaptation

| | |
|---|---|
| **Phase** | 3 |
| **Track** | Backend + Frontend |
| **Depends on** | P1-06, P2H-05 |
| **Blocks** | P3-08 |
| **Parallel-safe with** | P3-01, P3-02, P3-03, P3-04 |
| **Size** | M |

## Status

**Code complete 2026-11-10** on `feat/P3-05-engagement-state`, pending review. Stacked on
P3-04 (#34), which is stacked on P3-01 (#33): it touches the same policy and context files.

- **Protocol 1.2.0.** `ENGAGEMENT_SIGNAL` carries only what a browser or the voice worker can
  see: `tab_hidden`, `idle`, `vocal_cue`. Everything else is derived from the session log, so a
  client cannot claim a child is tired. The one-version window now keeps 1.1.0, not 1.0.0.
- **Its own endpoint: `POST /student/session/engagement`.** A turn's response must carry at
  least one move, and a signal usually changes nothing a child should see; rather than loosen
  that rule, an engagement signal has an exchange whose answer may be empty, and
  `/session/turn` refuses the event. A failed report is swallowed in the browser — a lost "the
  tab was hidden" is not an outage notice.
- **Single passive signals weigh 0.3, below the 0.4 at which Aria asks** (`idle` is 0.4).
  Otherwise one slow answer, or the third wrong answer, would interrupt the hint → reteach →
  step-back ladder with a check-in. Two that agree are 0.6, three 0.8, a statement 0.9.
- **What acting means:** tired → `BREAK` (any `BREAK` ends the session as a break, so an
  offered break is a stop for today); frustrated and uncertain → an easier question;
  disengaged → `SWITCH` to another strand or the next topic, else a visual reteach. The
  stuck-twice invariant still runs after it.
- **A check-in reply is never graded.** Tapped (`choiceId`), its id typed, or spoken; "stop"
  and "I'm fine / keep going" are honoured from any check-in. A denial is written as
  `engagementDenied` + `engagementFalsePositive`, and that state is not inferred again.
- **Statements are first-person patterns**, not a model: "I'm so tired", "this is boring";
  "the tired dog" is not one, and "I'm not tired" is a denial.
- **`vocal_cue` needs a granted voice consent naming the `vocal_cues` category.** The parent
  consent screens cannot grant it yet (P2-14), so every vocal cue is dropped and logged today.
- **Consolidation refuses `engagement` and the state kinds outright, and a `teaching_response`
  needs three observations** (one per consolidated session), whatever
  `MEMORY_REPETITIONS_FOR_DURABLE_FACT` says. P3-02's `sensitivity.ts` does not exist yet, so
  the guard is in `decide/thresholds.ts`.
- **Not done:** the "tired child" golden scenario still passes its machine invariants, but
  the human rubric round is a person's job. Nothing here proposes a `teaching_response`; the
  guard only makes sure one cannot be kept early.

## Why

`master-plan.md` §4.3: each session has a temporary engagement state (`ready`, `uncertain`,
`frustrated`, `tired`, `disengaged`) with evidence, confidence and expiry; low confidence
"causes a check-in, not a declaration"; Aria "may shorten a prompt, switch modality, offer a
break or change subject"; she "never diagnoses, stores a single mood as a personality trait,
or uses camera-based emotion recognition". P2H-01 fixed the silence ladder; this ticket is
the general model behind it and the §11 bar "Low-confidence affect inference stated as
fact: 0".

## Scope

### Build
An in-session, expiring engagement estimator fed by safe signals only; check-in moves;
adaptation policies; logging of signal, inference and response for false-inference
measurement; frontend signals (tab hidden, idle) and the CHECK_IN reply UI.

### Do not build
No camera, no facial or voice-emotion model. No persistence beyond the session except the
log. No parent-facing report of mood (Phase 6 may summarise *sessions*, never moods).

## Design

```
packages/tutor/src/engagement/
  signals.ts        EngagementSignal union: latency_slow | errors_repeated | silence |
                    short_answers | stop_request | said_tired | said_bored | said_frustrated |
                    vocal_cue (only when voice_consent.vocal_cues = true) | tab_hidden | idle
  estimator.ts      fold(signals, prev) -> EngagementState {kind, confidence, evidence[], expiresAt}
  thresholds.ts     per band: latency bar, error window, silence count, answer-length floor
  adaptation.ts     adapt(state, context) -> AdaptationDecision
                    {kind: 'none'|'shorten'|'switch_modality'|'offer_break'|'change_subject'|'check_in'}
  check-in.ts       reviewed CHECK_IN wording per state and band (fixed copy, model-free)
  types.ts
packages/tutor/src/policy/teaching-policy.ts     consult adaptation before defaultPlan
packages/shared/src/protocol/events.ts           ENGAGEMENT_SIGNAL event {signal, at}
                                                  (client-originated: tab_hidden, idle;
                                                   others are derived server-side)
apps/api/src/services/tutor/context.loader.ts    loads current state from session_event log
apps/web/src/features/session/hooks/useEngagementSignals.ts   visibility + idle -> events
apps/web/src/features/session/components/CheckInChoices.tsx   two big buttons / spoken reply
```

Rules:
- **Confidence is computed from evidence count and agreement**, never from a model:
  one signal → ≤0.4; two agreeing within the window → 0.6; three → 0.8; an explicit
  statement ("I'm tired") → 0.9. Contradicting signals subtract.
- **Below 0.7 Aria asks; at or above she acts.** `check-in.ts` wording is reviewed fixed
  text per state and band, e.g. tired/early: "Do you want an easy one, or should we stop for
  today?" Never "You are tired."
- **Adaptation is bounded**: one adaptation per state per session; a second time the same
  state fires with high confidence, the decision escalates to `offer_break`.
- Every state change writes a `session_event` with `actor: 'system'`, `move: 'ENGAGEMENT'`,
  `evidence: {signals, confidence, decision}` so false inferences can be counted later
  (child answered "I'm fine" to a tired check-in = false positive).
- State expires 5 minutes after its last supporting signal, or on the child's next correct
  answer with normal latency for `uncertain`.
- `vocal_cue` is accepted only when the worker attaches it *and* consent is recorded;
  otherwise the signal is dropped and logged.
- Nothing from this ticket may be proposed to `learner_fact` — P3-02's `sensitivity.ts`
  rejects kind `engagement`; a `teaching_response` fact ("shorter prompts help") may be
  proposed only after the same adaptation helped in ≥3 sessions.

### Edge cases
- Child says "I'm not tired" after a check-in: state cleared, confidence 0, logged as
  false-positive; no further tired check-in this session.
- Child says "stop": `stop_request` is 0.9 confidence → BREAK/END path immediately;
  never a check-in that argues.
- Conflicting explicit statements within a minute: latest wins.
- Latency signal during a SHOW that legitimately takes time (manipulative): thresholds use
  the move's `expects` and band; `expects: 'none'` moves never produce latency signals.
- Tab hidden for < 3 s (notification banner): ignored; ≥ 30 s → `idle`.
- Voice session with backchannel/short answers by design ("yes"): `short_answers` requires
  the move to have asked an open question.
- Estimator receives signals out of order after reconnect: fold is order-insensitive within
  the window (sorted by `at`).

## Acceptance criteria

- [x] Estimator tests: every state reachable from documented signals; single signal never
      exceeds 0.4; explicit statement reaches 0.9.
- [x] With confidence < 0.7 the policy emits CHECK_IN with reviewed wording and never a SAY
      that asserts the state — proven by a test that greps generated moves for state words
      ("tired", "frustrated", "bored") outside a question.
- [x] With confidence ≥ 0.7 the documented adaptation is applied once; a second high-
      confidence hit escalates to a break offer.
- [x] Every inference writes a `session_event` with signals and decision.
- [x] `vocal_cue` without consent is dropped (test with a fake consent repository).
- [x] Consolidation never promotes engagement kinds; `teaching_response` needs 3 sessions.
- [x] Frontend: hiding the tab ≥30 s emits `idle`; CheckInChoices renders two tappable
      answers in the early band and accepts a spoken reply in voice sessions.
- [ ] The tutoring golden set "tired child" scenario passes the human rubric. *(Machine
      invariants pass; the rubric round needs a reviewer.)*

## Verification

```bash
npm run test -w @aria/tutor -- engagement policy
npm run test -w @aria/api -- services/tutor services/memory
npm run test -w @aria/web -- session
npm run golden:tutoring -w @aria/api -- --scenario tired-child
```

## References

- `master-plan.md` §4.3, §11 (relationship bars), §12.8, §14
- `P2H-01` (silence ladder — this generalises it), `P2H-05` (intent: STOP_REQUEST), `P2-14` (vocal-cue consent)
