# P4-09 — Phase 4 exit acceptance

| | |
|---|---|
| **Phase** | 4 |
| **Track** | QA |
| **Depends on** | P4-01 … P4-08 |
| **Blocks** | P5-03, P6-02 |
| **Parallel-safe with** | — |
| **Size** | M |

## Why

`master-plan.md` §13 Phase 4 exit: "a non-reader reaches decoding CVC text entirely inside
the product, and we can show the parent the week it happened." Like P2-10, this is evidence,
not a feeling. Model-graded tutoring is not acceptance; teachers and families observe real
children (§11).

## Scope

### Build
An executable exit gate `evaluatePhase4Exit()` mirroring `evaluatePhase2Exit()`; the
`dev-docs/phase4-exit.md` evidence record; the golden scenarios that cover the reading and
writing loops; the observation protocol for the live sessions.

### Do not build
No product code beyond what is needed to record evidence. No inferred evidence — missing
counts are "missing", never zero.

## Design

```
packages/tutor/src/phase4-exit.ts          evaluatePhase4Exit(evidence) -> { passed, missing[] }
dev-docs/phase4-exit.md                    the record
dev-docs/golden/tutoring/scenarios/
  reading-ladder-rung1-to-4.json           PA -> PH.CVC across 6 simulated sessions
  oral-reading-low-confidence.json         asserts no durable change
  decodable-violation-recovery.json        generator fault -> SWITCH, passage unverified
  writing-loop-middle.json, writing-loop-senior.json
  comprehension-listening-early.json       proves early band is listening-only
dev-docs/golden/content/items/passages/    ≥ 100 human-graded decodable items
```

Evidence required (all must be present):
1. **Journey**: ≥ 3 real children who could not decode CVC at placement reach two durable
   readings ≥ 95% on CVC, inside the product, with the `student_phonics.mastered_at` row and
   the session ids recorded.
2. **Parent visibility**: for each, the week is identifiable from `oral_reading` durable rows
   (P6-02 will phrase it; here the query is proven).
3. **Filter bar**: 100% of passages served in the observation period pass the decodable
   filter against the taught set at serve time (log audit).
4. **Zero low-confidence promotion**: query proves no `skill_state`/`student_phonics` change
   originates from a `durable=false` reading.
5. **Writing**: ≥ 5 draft→note→revision→acknowledgement loops with a human rating the note
   "one thing, useful" ≥ 90%.
6. **Reviews**: every bank item (P4-03, P4-05, P4-06) has a recorded human review.
7. Golden sets pass; tutoring rubric ≥ 90% warm/age-appropriate/useful on reading scenarios.

### Edge cases
- A child reaches CVC through placement, not teaching → does not count toward (1); the exit
  is about teaching a non-reader.
- Observation session with `speaker: 'uncertain'` → excluded from (1).
- A passage served from cache that was later unverified → counts as a filter failure for (3)
  only if it was non-decodable at serve time.
- Evidence file edited by hand without session ids → the gate rejects entries missing ids.

## Acceptance criteria

- [ ] `evaluatePhase4Exit()` returns `passed=false` with a precise `missing[]` when any item
      is absent, and `passed=true` only when all seven are recorded with ids.
- [ ] All new golden scenarios pass on `main`.
- [ ] `dev-docs/phase4-exit.md` states the status and lists evidence or what is missing.
- [ ] Findings from the observation sessions are filed as tickets, listed in the record.

## Verification

```bash
npm run golden:tutoring -w @aria/api
npm run golden:content -w @aria/api -- --kind passage
npm run test -w @aria/tutor -- phase4-exit
```

## References

- `master-plan.md` §11, §13 Phase 4; `dev-docs/phase2-exit.md` (the pattern)
