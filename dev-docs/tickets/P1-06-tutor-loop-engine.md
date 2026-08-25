# P1-06 — The tutor loop engine

| | |
|---|---|
| **Phase** | 1 |
| **Track** | Backend |
| **Depends on** | P0-14, P0-18, P0-23, P0-27, P1-01, P1-03, P1-05 |
| **Blocks** | P1-07, P1-08, P1-11, P1-15 |
| **Parallel-safe with** | P1-09, P1-10, P1-13 |
| **Size** | L |

## Why

This is the heart of the product. Everything else in the plan exists to feed it or to check
it. It is a **controlled loop with tools, not one unconstrained model call** — that
distinction is what keeps a tutor from becoming a chatbot that occasionally teaches.

## Scope

### Build
`POST /api/v1/student/session/turn`: the seven-step turn from `master-plan.md` §4.1,
assembled from injected collaborators, each independently testable.

### Do not build
No voice. No consolidation (P1-09). No memory retrieval implementation (P1-10) — this ticket
consumes its port.

## Design

```
packages/tutor/src/                 (amended 2026-08-23 — was apps/api/src/services/tutor/)
  turn.service.ts         the orchestrator. Seven steps, ~80 lines, no branching business
                          rules of its own.
  steps/
    load-context.ts       session + relevant facts + skill state + active goals
    apply-policy.ts       deterministic policy FIRST: safety, session limits, due skills,
                          known fixes
    plan-move.ts          the planner model, constrained to allowed moves
    resolve-content.ts    cache -> generate -> gate -> fallback (P0-20, P0-18)
    record.ts             write input, decision, move and evidence to session_event
    update-state.ts       skill state and evidence-backed observations
    emit.ts               deliver the move (text channel now, voice channel in Phase 2)
  policy/
    allowed-moves.ts      which moves are legal in this state — the planner may only choose
                          from this set
    limits.ts             session length, attempt counts, break rules
  types.ts
```

Rules:
- **Deterministic policy runs before the model, every turn.** Safety, session limits, due
  skills and known fixes are decided in code. The planner is asked only when judgement is
  genuinely required.
- **The planner selects from `allowed-moves`.** A model-proposed move outside the set is
  rejected and the deterministic default is used. The model never invents a move kind.
- Content resolution is always cache → generate → gate → regenerate once → verified fallback.
  There is no path that reaches a child ungated.
- Every turn writes its input, its decision, the chosen move and the evidence behind it.
  **The decision is logged, not just the output** — that is what makes a bad session
  debuggable rather than mysterious.
- Learner context reaching a prompt is `ScrubbedContext` (P0-23) by type, not by convention.
- `turn.service.ts` is an orchestrator: if it grows an `if` about pedagogy, that rule belongs
  in `policy/`.

**Amendment 2026-08-23** (from the `realtime-agent-harness.md` design review):
- **The harness lives in `packages/tutor`, not in `apps/api`.** `apps/api`'s
  `POST /session/turn` and the Phase 2 `apps/voice-worker` call the same
  `TutorHarness.handle(event) → Move[]`. The package depends on `packages/shared` and on
  ports only; database and provider implementations are injected by the app.
- **Speculation is side-effect-free by construction.** Steps 1–3 (load, policy, plan) may
  run on a partial transcript and produce a *draft* only. `record.ts`, `update-state.ts`
  and any mutating tool run only in the commit step, which re-runs the deterministic checks
  (grading, `expects` match, intent) on the final input and discards the draft if they
  disagree. This is enforced by the step signatures: draft steps receive no repository.
- **`plan-move.ts` returns a structured move plan first** (see P0-19 amendment) which is
  validated before any content is generated.

## Acceptance criteria

- [ ] `POST /session/turn` accepts any `TutorInputEvent` and returns one or more `TutorMove`s.
- [ ] All seven steps run in order; each step is unit tested in isolation with fakes.
- [ ] A planner response proposing a disallowed move is rejected and falls back
      deterministically, proven by a test.
- [ ] No content reaches the response without a gate pass — asserted by a test that counts
      gate invocations.
- [ ] Every turn writes exactly one input event and one move event with evidence.
- [ ] Skill state updates on every graded answer, atomically with the event write.
- [ ] A provider outage still returns a usable move from cache or fallback.
- [ ] The P0-22 tutoring scenarios replay against this loop with no scenario changes.
- [ ] A discarded draft leaves no `session_event`, no evidence and no skill-state change —
      proven by a test that speculates on "I don't know" and finalises on "I don't know
      if it is seven".
- [ ] `packages/tutor` has no import from `apps/*`, enforced by lint.

## Verification

```bash
npm run test -w @aria/api -- tutor
npm run golden:tutoring -w @aria/api
```

## References

- `master-plan.md` §4.1 (the seven-step turn), §13 Phase 1, §15
- `realtime-agent-harness.md` — "Speculative planning on partials", "Worker topology"
