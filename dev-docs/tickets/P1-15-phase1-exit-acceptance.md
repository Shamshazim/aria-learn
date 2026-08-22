# P1-15 — Phase 1 exit acceptance

| | |
|---|---|
| **Phase** | 1 |
| **Track** | QA (Backend + Frontend) |
| **Depends on** | P1-04, P1-06, P1-07, P1-08, P1-09, P1-10, P1-11, P1-12, P1-13, P1-14 |
| **Blocks** | Phase 2 |
| **Parallel-safe with** | — |
| **Size** | M |

## Why

Each phase has an exit test, and the next one does not start until it passes. This ticket is
that test, made executable, so "Phase 1 is done" is a command anyone can run rather than an
opinion.

## Scope

### Build
An end-to-end acceptance suite that reproduces the Phase 1 exit test exactly, plus the
written human-observation report the plan requires alongside it.

## The exit test, verbatim

> Aria greets a returning child from evidence, recommends what to do, accepts a different
> class, and conducts a complete multi-turn session. A child can say "I don't get it" and
> receive a genuinely different explanation. Returning tomorrow, Aria accurately recalls at
> least one supported fact from today.

## Design

```
e2e/phase1/
  01-returning-child.spec.ts    arrival, evidence-based welcome, recommendation
  02-declines-recommendation.spec.ts
  03-full-session.spec.ts       a complete multi-turn session, all three bands
  04-i-dont-get-it.spec.ts      the second explanation must differ, and be simpler
  05-tomorrow.spec.ts           clock advanced; the welcome cites today's real fact
  fixtures/seeded-learner.ts    a deterministic child with real prior sessions
```

- The suite runs against the real API and a real database, with the model provider stubbed by
  a recorded-response fake so it is deterministic and free — the golden sets, not this suite,
  measure the live model.
- "A genuinely different explanation" is asserted structurally: a different approach, not
  reworded text. Assert on the move's approach metadata, not on string inequality alone.
- "Recalls at least one supported fact" asserts the cited fact exists in `learner_fact` with
  evidence pointing at yesterday's session.

## Acceptance criteria

- [ ] All five specs pass in all three bands where applicable.
- [ ] The tomorrow test advances an injected clock — no real waiting, no flakiness.
- [ ] The P0-22 tutoring golden set runs against the real loop with no scenario edits.
- [ ] `npm run report:phase1` shows every §11 bar met, or each miss is explicitly accepted in
      the PR with a reason.
- [ ] Teachers or families have observed real children using it, and the observation notes
      are written up — **a model grading its own tutoring is not acceptance**
      (`master-plan.md` §11).
- [ ] The Phase 0 exit test still passes.

## Verification

```bash
npm run e2e -- phase1
npm run golden:tutoring -w @aria/api
npm run report:phase1 -w @aria/api
```

## References

- `master-plan.md` §11, §13 Phase 1
