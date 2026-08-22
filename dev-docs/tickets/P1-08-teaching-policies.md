# P1-08 — Hints, reteaching, reveal, switch, break and ending

| | |
|---|---|
| **Phase** | 1 |
| **Track** | Backend |
| **Depends on** | P1-03, P1-06 |
| **Blocks** | P1-15 |
| **Parallel-safe with** | P1-07, P1-09, P1-10 |
| **Size** | M |

## Why

"It teaches, it does not test." A quiz measures; teaching means noticing the wrong idea
underneath the wrong answer and fixing *that*. This ticket encodes the pedagogy that turns a
correct-or-not response into a tutor's next move — and enforces the one bar the plan sets at
zero: **two wrong answers must never happen without Aria changing what she is doing.**

## Scope

### Build
The deterministic teaching policies in `services/tutor/policy/`, driven by skill state,
misconception signatures and attempt history.

### Do not build
No affect inference. Phase 3. Silence and explicit "I don't get it" are handled here; inferred
tiredness is not.

## Design

```
apps/api/src/services/tutor/policy/
  response.policy.ts       correct -> PRAISE (specific, never "good job")
                           wrong once -> HINT
                           wrong twice the same way -> RETEACH with the misconception fix
                           struggling productively is over -> REVEAL with the reasoning
  progression.policy.ts    when to move on, when to go back a prerequisite
  switch.policy.ts         this skill is not working today -> SWITCH, come back tomorrow
  break.policy.ts          attention is gone -> BREAK; Aria ends the session, not the child
  ending.policy.ts         END: wrap up and say what they learned
  attempt-history.ts       per-skill, per-session attempt tracking
```

Rules from the plan:
- **Two wrong answers never produce the same approach twice.** The bar is 0 occurrences
  (`master-plan.md` §11); it is asserted in P0-22's invariants and here in unit tests.
- **A misconception seen twice ends hinting.** Aria reteaches with the recorded fix — "cut the
  same pizza into 3 and into 8" — not another hint.
- Going **backwards** is a legal move: when a skill is stuck, the unmet prerequisite from
  P1-03 becomes the next target. A linear topic list could not do this; that is why the graph
  exists.
- Praise is specific. A generic "good job" is a policy failure, not a wording preference.
- Sessions end on Aria's initiative, within the band's length, and end by telling the child
  what they learned.
- **Never stuck, never bored.** If a child leaves feeling stupid, the product failed, whatever
  the mastery number says — that is the rule these policies exist to keep.

## Acceptance criteria

- [ ] Wrong-once produces `HINT`; wrong-twice-same-signature produces `RETEACH` with the
      skill's recorded fix.
- [ ] No two consecutive wrong answers produce the same move or the same approach, proven
      exhaustively over the attempt state space.
- [ ] A hint helps: the harness reports next-attempt-correct rate, and the bar (>60%) is
      measurable.
- [ ] A stuck skill routes to its unmet prerequisite.
- [ ] `SWITCH`, `BREAK` and `END` each trigger from their stated condition and are tested.
- [ ] Praise text is derived from what the child actually did; a generic-praise fixture fails.
- [ ] Every policy is a pure function of state — no model call, no database call inside.

## Verification

```bash
npm run test -w @aria/api -- tutor/policy
npm run golden:tutoring -w @aria/api
```

## References

- `master-plan.md` §4.1 (move table), §4.4 (misconceptions), §5, §11
