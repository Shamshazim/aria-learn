# P3-05 — Engagement state and adaptation

| | |
|---|---|
| **Phase** | 3 |
| **Track** | Backend + Frontend |
| **Depends on** | P1-06, P2H-05 |
| **Blocks** | P3-08 |
| **Parallel-safe with** | P3-01, P3-02, P3-03, P3-04 |
| **Size** | M |

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

- [ ] Estimator tests: every state reachable from documented signals; single signal never
      exceeds 0.4; explicit statement reaches 0.9.
- [ ] With confidence < 0.7 the policy emits CHECK_IN with reviewed wording and never a SAY
      that asserts the state — proven by a test that greps generated moves for state words
      ("tired", "frustrated", "bored") outside a question.
- [ ] With confidence ≥ 0.7 the documented adaptation is applied once; a second high-
      confidence hit escalates to a break offer.
- [ ] Every inference writes a `session_event` with signals and decision.
- [ ] `vocal_cue` without consent is dropped (test with a fake consent repository).
- [ ] Consolidation never promotes engagement kinds; `teaching_response` needs 3 sessions.
- [ ] Frontend: hiding the tab ≥30 s emits `idle`; CheckInChoices renders two tappable
      answers in the early band and accepts a spoken reply in voice sessions.
- [ ] The tutoring golden set "tired child" scenario passes the human rubric.

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
