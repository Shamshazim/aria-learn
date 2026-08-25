# P3-08 — Phase 3 exit acceptance

| | |
|---|---|
| **Phase** | 3 |
| **Track** | QA |
| **Depends on** | P3-01, P3-02, P3-03, P3-04, P3-05, P3-06, P3-07 |
| **Blocks** | Phase 4 tickets |
| **Parallel-safe with** | — |
| **Size** | M |

## Why

`master-plan.md` §13 Phase 3 exit: "the tutor opens already knowing the child without
inventing facts; every durable claim links to evidence; a parent can correct it; and Aria
changes approach when a child appears tired or frustrated without turning a temporary
state into a permanent label." §11: "a model grading its own tutoring is not acceptance"
— real children and families observe the slice. This ticket turns those sentences into an
executable gate plus a recorded human observation, in the same shape as
`dev-docs/phase2-exit.md`.

## Scope

### Build
`evaluatePhase3Exit()` in `packages/tutor` (pure, fed by collectors in `apps/api`), a CLI
that runs it, the human-observation protocol and its evidence file, and
`dev-docs/phase3-exit.md`. Findings become tickets; this ticket does not fix them.

### Do not build
No new product behaviour. No Phase 4 work started before this passes.

## Design

```
packages/tutor/src/phase3-exit/
  criteria.ts        the six criteria below as typed checks; missing evidence is `missing`, never 0
  evaluate.ts        evaluatePhase3Exit(evidence) -> { passed, results[] }
apps/api/src/scripts/phase3-report.ts     collects evidence from DB + golden runs; writes JSON
dev-docs/phase3-exit.md                   current status and the evidence table
dev-docs/golden/tutoring/scenarios/phase3/  new scenarios: opens-knowing-child,
                                            invented-fact-trap, correction-next-session,
                                            tired-adapts-no-label, backward-move, brief-drift
```

**Criteria**

| # | Criterion | Automated evidence | Human evidence |
|---|---|---|---|
| 1 | Opens knowing the child | Arrival welcome for 20 golden students references ≥1 evidence-backed fact/episode; `< 500 ms` p95 visible welcome | Parent confirms the welcome is true for their child (n ≥ 10) |
| 2 | No invented facts | `invented-fact-trap`: every proper noun / claim in welcomes and briefs maps to a fact or episode id (0 misses) | Human review of 50 briefs: 0 unsupported claims |
| 3 | Every durable claim links to evidence | SQL: 0 `learner_fact` / `learner_episode` rows without ≥1 evidence row | — |
| 4 | Parent correction reflected next session | `correction-next-session` scenario: 100% | 5 parents correct one fact; next session verified |
| 5 | Adapts to tired/frustrated without a label | `tired-adapts-no-label`: adaptation occurs, no state word asserted, no `engagement` fact created | Tutor rubric ≥ 90% warm/appropriate on the check-in |
| 6 | Memory rebuild drift | `memory:rebuild --all` drift score ≤ 0.05 on the golden cohort; briefs regenerated from evidence match on claims | — |

Plus §11 bars carried forward and re-measured: "Two wrong answers without Aria changing
approach: 0", "Durable learner fact has supporting evidence: 100%", "Low-confidence affect
inference stated as fact: 0".

**Human observation protocol** (`dev-docs/phase3-exit.md` §Protocol): ≥3 children per band
who used Aria for ≥2 weeks; an adult observer notes each welcome, each check-in and each
change of approach, and the parent reads the week brief and marks each sentence true /
false / unsure. Recorded as a table, one row per child, no names (child id only).

### Edge cases
- Any collector cannot reach its source (DB, golden runner): the criterion is `missing`
  and the gate fails; it never reports 0 problems.
- Golden cohort smaller than 20 students: criterion 1 reports `insufficient_sample`.
- A human observation older than 60 days at evaluation time is stale and excluded.
- The gate is re-run after every fix PR; the status file records the run id and commit.

## Acceptance criteria

- [ ] `evaluatePhase3Exit()` has a unit test per criterion for pass, fail and missing.
- [ ] `phase3-report` runs end to end on a seeded database and produces the JSON the
      evaluator consumes.
- [ ] The six new golden scenarios exist with rubric entries and run under `golden:tutoring`.
- [ ] `dev-docs/phase3-exit.md` exists with status **not passed** until every row has
      evidence, then records the passing run's commit, date and observation table.
- [ ] Every failed criterion has a filed ticket linked from the status file.
- [ ] No criterion is satisfied by a model grading its own output.

## Verification

```bash
npm run test -w @aria/tutor -- phase3-exit
npm run phase3:report -w @aria/api
npm run golden:tutoring -w @aria/api -- --scenario phase3/*
npm run memory:rebuild -w @aria/api -- --all --report
```

## References

- `master-plan.md` §11, §13 Phase 3 exit, §4.2, §4.3
- `dev-docs/phase2-exit.md` (shape to copy), `packages/voice/src/phase2-exit.ts`
- `dev-docs/golden/tutoring/rubric.md`
