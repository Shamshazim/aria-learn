# P2H-01 — Silence and disengagement escalation

| | |
|---|---|
| **Phase** | 2H (make Aria human) |
| **Track** | Frontend + Backend |
| **Depends on** | — (P1-06, P1-08, P2-05 are on `main`) |
| **Blocks** | P2H-13, P2H-14 |
| **Parallel-safe with** | P2H-02, P2H-03, P2H-08, P2H-10, P2H-12 |
| **Size** | S |
| **Status** | 🟡 Core implemented on branch `docs/harness-review-fixes` (commits `ab1ef4b`, `ccba913`), no PR yet. |

## Why

Today a quiet child hears "Take your time. I am ready." forever. `useSilenceEvent`
(`apps/web/src/features/session/hooks/useTutorSession.ts:256`) re-arms whenever the current
move `expects !== 'none'`; the policy (`packages/tutor/src/policy/teaching-policy.ts`) maps
`SILENCE` → `LISTEN`; `LISTEN` expects speech; the timer re-arms. Infinite loop, identical
sentence, no change of approach. `master-plan.md` §5: *never stuck, never bored* — Aria must
change what she is doing, and §4.3 says silence is an engagement signal, not a prompt to repeat.

## Scope

### Build
A per-session silence counter in the tutor state, an escalation ladder in policy, a
silence-timer contract in the UI and the voice worker that does not re-arm on `LISTEN`, and a
no-verbatim-repeat guard.

### Do not build
No engagement/affect model (P3-05). No model-generated silence text (P2H-03 supplies prompts;
this ticket ships reviewed template variants). No change to the `SILENCE` event shape.

## Design

```
packages/tutor/src/
  policy/silence-ladder.ts        pure: (band, consecutiveSilences, lastMoveKind) -> rung
  policy/silence-ladder.test.ts
  policy/teaching-policy.ts       SILENCE branch delegates to the ladder (edit, ≤ 20 lines)
  types.ts                        SessionTurnState gains consecutiveSilences: number
packages/shared/src/protocol/
  session.ts                      SessionState.consecutiveSilences (persisted in session.plan)
apps/api/src/services/tutor/
  commit.service.ts               resets counter on any non-SILENCE child event; increments on SILENCE
apps/api/src/services/content/
  turn-fallback.ts                LISTEN/CHECK_IN silence variants move to silence-variants.data.ts
  silence-variants.data.ts        ≥ 4 reviewed variants per rung per band; picker never returns
                                  the text used in the previous silence move of this session
apps/web/src/features/session/hooks/
  useSilenceEvent.ts              extracted from useTutorSession.ts; new arming rules below
  useSilenceEvent.test.ts
apps/voice-worker/src/session/
  silence-timer.ts                same rules server-side for the voice channel
```

**The ladder** (`consecutiveSilences` counts `SILENCE` events since the last child input):

| Rung | Early (TK–2) | Middle (3–5) | Senior (6–8) |
|---|---|---|---|
| 1 | `ASK` again, shorter (`approach: 'reask-short'`) | same | same |
| 2 | `HINT` if a question is open, else `SAY` one concrete nudge | `HINT` | `HINT` |
| 3 | `CHECK_IN` "Are you still there? Tap the star if you are." (`expects: 'tap'`) | `CHECK_IN` (`expects: 'choice'`: keep going / stop) | same |
| 4 | `BREAK` (session ends gently, `expects: 'none'`) | `BREAK` | `BREAK` |

`REVEAL` is allowed at rung 2 only when `attempts >= 1` on the open item (policy limits stay
authoritative). The ladder is a pure function; the policy calls it and it is the only place
the `SILENCE` → move mapping lives. `allowed-moves.ts` `SILENCE` row becomes
`['ASK','HINT','SAY','REVEAL','CHECK_IN','BREAK','SWITCH']` (`LISTEN` is removed from it —
`LISTEN` is for read-aloud and speaking prompts, not for waiting).

**Timer arming rules** (UI and worker, identical):
- Arm only when the current move `expects !== 'none'` **and** Aria has finished speaking
  (`SPEECH_ENDED` / playback complete). While Aria speaks, no timer.
- Never arm for a move of kind `LISTEN` produced by the ladder (`meta.reason === 'silence'`);
  the ladder's `CHECK_IN` arms once, and its expiry sends `SILENCE` which produces `BREAK`.
- Pause the timer while `document.visibilityState === 'hidden'`, while the mic permission
  dialog is open, and while `connection.state !== 'connected'`; resume with the remaining time.
- `INTERRUPT`, `SPEECH_STARTED`, `SPEECH_PARTIAL`, `ANSWER`, `QUESTION`, `CONFUSED` clear the
  timer and reset the counter. `BACKCHANNEL` ("mm-hm") clears the timer but does **not** reset
  the counter.
- Exactly one `SILENCE` per armed window; `afterMoveId` must equal the current move id or the
  server ignores it (stale timer after reconnect).

**No verbatim repeat**: `record.ts` keeps the last 20 child-facing texts of the session in
`session.plan.recentTexts`; the fallback picker and (after P2H-03) the prompt renderer receive
them; a candidate equal to any of them is rejected once and re-picked.

### Edge cases
- Child speaks during rung-3 `CHECK_IN` → counter resets, lesson resumes at the open item.
- Rung 4 `BREAK` in early band: session ends, `END` summary still spoken (P2H-11).
- Two `SILENCE` events arrive for the same move (double timer after HMR/reconnect) → second is
  a no-op, counter increments once (dedupe by `afterMoveId`).
- Silence right after `WELCOME` before a class is chosen: ladder is not applied; the arrival
  screen never times out (children look at the picker for a long time).
- Voice channel: STT emits an empty final transcript → treated as `SILENCE`, not `SPEECH_FINAL`.
- Tab hidden for 10 minutes then visible → timer resumes with remaining time, does not fire
  immediately; if hidden > session max, `PAUSE` is sent instead.
- Provider outage: variants are static and reviewed, so the ladder needs no model.

## Status (2026-08-25)

- Done: `silenceRung` ladder (reask → HINT → check-in → BREAK), `consecutiveSilences` in the session snapshot, `SILENCE` row without `LISTEN`, approach-aware fallbacks, policy tests.
- Remaining: per-band scripted session tests, no-two-identical-texts fuzz, UI/worker timer does not arm on `LISTEN` or while Aria speaks, `BACKCHANNEL`/`SPEECH_PARTIAL` timer semantics, stale-`SILENCE` handling, rung in `session_event.evidence`.

## Acceptance criteria

- [ ] A scripted session with no child input produces moves in the order ASK → HINT/SAY →
      CHECK_IN → BREAK and never a fifth silence move, for every band (three tests).
- [ ] No two consecutive Aria texts in a session are identical; asserted over the P0-22
      scenarios and a 50-turn silence fuzz.
- [ ] A `LISTEN` move never arms the silence timer in the UI (hook test) or the worker.
- [ ] The timer does not run while Aria is speaking or the tab is hidden (fake timers test).
- [ ] `BACKCHANNEL` clears the timer without resetting the counter; `SPEECH_PARTIAL` resets it.
- [ ] Stale `SILENCE` (`afterMoveId` ≠ current) is ignored and logged.
- [ ] `allowed-moves.ts` `SILENCE` row no longer contains `LISTEN`; `teaching-policy.test.ts`
      updated accordingly.
- [ ] The `SILENCE` → move decision is recorded in `session_event.evidence` with the rung.

## Verification

```bash
npm run test -w @aria/tutor -- silence
npm run test -w @aria/web -- useSilenceEvent
npm run test -w @aria/voice-worker -- silence-timer
npm run golden:tutoring -w @aria/api -- --scenario tired-child
```

## References

- `master-plan.md` §4.1 (events), §4.3, §5 "The one thing the child must feel"
- `realtime-agent-harness.md` — "Endpointing per band", "Silence"
- `CODE-STANDARDS.md` §2, §3
