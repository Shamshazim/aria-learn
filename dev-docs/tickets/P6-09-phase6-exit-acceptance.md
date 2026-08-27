# P6-09 — Phase 6 exit acceptance

| | |
|---|---|
| **Phase** | 6 |
| **Track** | QA |
| **Depends on** | P6-01, P6-02, P6-03, P6-04, P6-05, P6-06, P6-07, P6-08 |
| **Blocks** | Phase 7 |
| **Parallel-safe with** | — |
| **Size** | S |

## Why

`master-plan.md` §13 Phase 6 exit: "a parent renews without being asked because they can
see it working." §11: opinions do not count; a model grading its own output is not
acceptance. This ticket records the evidence or states exactly what is missing.

## Scope

### Produce
`dev-docs/phase6-exit.md` with measured evidence for every bar below, an executable gate
`evaluatePhase6Exit()` in `apps/api/src/testing/phase6-exit.ts` that reads recorded evidence
(missing evidence is reported as missing, never as zero — same rule as `phase2-exit.md`),
and follow-up tickets for anything that fails.

### Do not produce
No new features. No relaxation of a bar without a written decision in `master-plan.md`.

## Design

Bars and how each is measured:

| Bar | Measure | Source |
|---|---|---|
| Parent renews unprompted | ≥ 1 real family on a paid or trial plan renews with no outreach (X-02) | billing events |
| Digest is true | 100% of digest sentences in a 4-week sample cite existing evidence; ≥ 90% rated "true and useful" by the parent | P6-02 evidence map + survey |
| Ask is grounded | 100% of sampled answers have resolving citations; 0 invented claims in a 50-question human-graded set | P6-03 audit + graders |
| Corrections take effect | 100% of corrections absent from the next session's retrieval (§11) | P6-05 integration log |
| Nothing hidden | A parent can reach every session event for their child except matrix-hidden household-abuse rows | P6-05 count test |
| Delete means delete | `deletion:verify` reports zero rows for 3 deleted fixture children and 1 real deleted account | P6-06 |
| Crisis reaches a human | Drill for each matrix row delivered and acknowledged within SLA in staging with real adapters | P6-07 drill log |
| Teacher sees only the allowlist | Schema allowlist test green; one real teacher reviews a class report | P6-08 |
| No §14 violation | Manual review of every parent and teacher screen: no menu for the child, no mastery %, no leaderboard, no punishing streak, no grades | screenshot review |

### Edge cases
- Evidence exists for staging but not production → recorded as "staging only"; the gate
  fails until a production drill exists for the crisis bar (that one is non-negotiable).
- A bar fails → the ticket is not closed; a P6-xx follow-up is filed with the failing
  measure; the gate lists it.
- A bar cannot be measured yet (no paying family) → recorded as missing, with the date the
  measurement becomes possible.

## Acceptance criteria

- [ ] `dev-docs/phase6-exit.md` exists with a row per bar, the measured value, the date and
      the source.
- [ ] `evaluatePhase6Exit()` passes on the recorded evidence or lists every missing item by
      name.
- [ ] Human observation: at least three families and one teacher used the Phase 6 surfaces;
      notes recorded.
- [ ] Every failing bar has a numbered follow-up ticket.

## Verification

```bash
npm run test -w @aria/api -- phase6-exit
npm run phase6:exit -w @aria/api
```

## References

- `master-plan.md` §7, §8, §11, §13, §14; `dev-docs/phase2-exit.md` (pattern)
