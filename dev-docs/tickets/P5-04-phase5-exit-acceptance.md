# P5-04 — Phase 5 exit acceptance

| | |
|---|---|
| **Phase** | 5 |
| **Track** | QA |
| **Depends on** | P5-01, P5-02, P5-03 |
| **Blocks** | — |
| **Parallel-safe with** | — |
| **Size** | S |

## Why

`master-plan.md` §13 Phase 5 exit: "the child asks to use it." §11 names the real signal:
"Does the child come back tomorrow without being made to?" This ticket defines how that is
measured so the exit is a number, not an anecdote.

## Scope

### Build
`evaluatePhase5Exit()`; a return-rate query over `session`/`arrival_event`; a parent
report question; the evidence record `dev-docs/phase5-exit.md`.

### Do not build
No engagement mechanics to move the number (no streaks, no rewards — §14). No new
analytics vendor.

## Design

```
packages/tutor/src/phase5-exit.ts
apps/api/src/services/reporting/return-rate.service.ts
  unprompted return = an ARRIVED event on a calendar day with no parent-initiated launch
  flag (P6-01 records who opened the app: 'child' | 'parent'); rate = days with unprompted
  return / eligible days, per child, over 4 weeks
dev-docs/phase5-exit.md
```

Evidence required:
1. ≥ 10 children with an active thread over ≥ 4 weeks.
2. Unprompted return rate ≥ 50% of eligible days for at least half of them, and higher
   in story weeks than in the same child's pre-story baseline where one exists.
3. Parent survey: "Has your child asked to use Aria without you suggesting it?" — yes for
   ≥ 60%.
4. Zero safety flags attributable to story content; zero non-consented facts in
   `beat-audit` (query).
5. Tutoring golden set still ≥ 90% on the rubric (story must not lower teaching quality).

### Edge cases
- Children with < 10 eligible days → excluded, listed.
- Holidays / sick weeks → eligible days exclude parent-marked absences; a missed day never
  counts against the child (§14 streak rule), only against the measurement window.
- Shared device where the parent always opens the app → survey answer is the signal; return
  rate reported as "unmeasurable" for that child, not zero.

## Acceptance criteria

- [ ] `evaluatePhase5Exit()` requires all five items with ids/query outputs and reports
      `missing[]` otherwise.
- [ ] Return-rate query is unit tested with fixture arrivals including excluded days.
- [ ] `dev-docs/phase5-exit.md` records status and evidence or gaps.
- [ ] No ticket or code introduced here shows the child a streak or count.

## Verification

```bash
npm run test -w @aria/tutor -- phase5-exit
npm run test -w @aria/api -- return-rate
```

## References

- `master-plan.md` §11 (retention), §13 Phase 5, §14
