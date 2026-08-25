# P7-05 — Phase 7 exit acceptance

| | |
|---|---|
| **Phase** | 7 |
| **Track** | QA |
| **Depends on** | P7-01, P7-02, P7-03, P7-04 |
| **Blocks** | — |
| **Parallel-safe with** | — |
| **Size** | S |

## Why

`master-plan.md` §13 Phase 7 exit: "unit economics work at a consumer price without
weakening any quality bar." Two halves, both measured. A cost win that moved a quality
number is a failure of this phase, not a partial success.

## Scope

### Build
An executable exit gate (`evaluatePhase7Exit()`), mirroring the Phase 2 gate's rule that
missing evidence is reported as missing, never as zero; the evidence file; and the sign-off.

### Do not build
No product changes. Findings become new tickets.

## Design

```
apps/api/src/testing/exit/phase7-exit.ts        evaluatePhase7Exit(evidence) → { passed,
                                                 missing[], failed[] }
apps/api/src/testing/exit/phase7-exit.test.ts
dev-docs/phase7-exit.md                          status + the recorded evidence
```

Evidence required, each with its source:

| Bar | Source | Pass |
|---|---|---|
| Cost per child per month (p90, cohort with ≥ 20 active children over a full month) | P7-04 report | ≤ target in `dev-docs/ops/cost.md` |
| Cost per child per month (p50) | P7-04 | ≤ 50% of consumer price (X-02) |
| Content cache hit rate, tutoring golden set | P7-02 | ≥ 90% |
| Speculative waste | P7-02 | ≤ 40% |
| Content golden set | P7-03 run on the shipped `ai.yaml` | every §11 content bar met |
| Tutoring golden set, human rubric | P2H-14 rubric re-run on the shipped routing | ≥ 90% |
| Turn p95 wait | X-04 | < 1s |
| First-audio p95 | X-04 | < 1s |
| Interrupt-to-silence p95 | X-04 | < 250ms |
| Daily cap trips | P7-04 | < 2% of sessions |
| Routing decision log | `dev-docs/golden/routing/decisions.md` | every shipped change has a passing run |

Rules:
- A synthetic month (golden sets replayed) may stand in for the cohort month only if the
  evidence file says so explicitly and a real-cohort re-check is scheduled.
- The human rubric is re-run by people who did not tune the routing.

### Edge cases
- Fewer than 20 active children in the month: cost bars are `missing`, not `failed`.
- One bar missing: the gate reports exactly which; no partial pass.
- A quality bar passes on TEACH but fails on the FAST-routed prompts only: the failure names
  the prompt, and P7-03's `by-prompt` map is the fix, not a global revert.

## Acceptance criteria

- [ ] `evaluatePhase7Exit()` returns `missing` for absent evidence and `failed` for breached
      bars, proven by tests.
- [ ] `dev-docs/phase7-exit.md` records every row of the table with a link to its source
      run or report.
- [ ] The gate passes on the recorded evidence, or the file lists exactly what is missing.
- [ ] Each finding that blocks the gate is filed as a ticket and linked.

## Verification

```bash
npm run test -w @aria/api -- testing/exit
npm run cost:report -w @aria/api -- --month <month>
npm run golden:routing -w @aria/api -- --compare dev-docs/golden/routing/baseline.json
```

## References

- `master-plan.md` §11, §13 Phase 7
- `phase2-exit.md` (the gate pattern), P2H-14, P7-01…P7-04, X-02, X-04
