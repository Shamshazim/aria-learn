# P2H-14 — "Sounds human" acceptance

| | |
|---|---|
| **Phase** | 2H |
| **Track** | QA |
| **Depends on** | P2H-01 … P2H-13 |
| **Blocks** | Phase 3 start |
| **Parallel-safe with** | — |
| **Size** | M |

## Why

Phase 2H exists because the product felt like a machine. The individual tickets each fix a
cause; this one checks the effect with humans, against the plan's own bar: *a human tutor
rates the response warm, age-appropriate and pedagogically useful ≥ 90%*.

## Scope

### Do
Run the tutoring golden set with the human rubric, observe live sessions per band, measure
repetition and fallback use, measure latency, and file every finding as a ticket.

### Do not build
Nothing new here; findings become tickets.

## Design

```
dev-docs/golden/tutoring/
  rubric.md                    add rows: "sounds like a person", "no verbatim repeats",
                               "responds to what the child actually said", "praise is specific"
  runs/<date>-2h.md            per-scenario scores from 2 human tutors, disagreements resolved
dev-docs/acceptance/phase2h/
  live-sessions.md             3 children per band (9 total), consented, observer notes:
                               moments that felt human / robotic, timestamps, transcript ids
  metrics.md                   from observability over the same sessions
apps/api/src/observability/report/
  humanness.report.ts          per session: verbatim repeats, fallback count, planner rejection
                               rate, first-audio p95, silence-ladder rungs reached, intents seen
```

**Bars** (all must hold):

| Measure | Bar |
|---|---|
| Human rubric: warm / age-appropriate / useful (P0-22 set + 2H scenarios) | ≥ 90% |
| Verbatim Aria sentence repeated within a session | 0 |
| Static fallback used in a nominal session (model available) | 0 |
| First audio after child turn (voice) | < 1 s p95 |
| Visible response start (text) | < 1 s p95 |
| Child's question answered then lesson resumed (rubric) | 100% of QUESTION turns |
| Two wrong answers without Aria changing approach | 0 |
| Sessions ended by the child in frustration | < 5% |

**Live sessions**: one observer, one parent present, no recording of audio kept beyond the
session unless separately consented; observer notes reference `session_event` ids only.

### Edge cases
- Rubric scores between tutors differ by > 1 point on a scenario → third rater.
- A bar fails because of a provider outage during the run → re-run; outage noted, not counted.
- A child refuses to participate → replaced; never coaxed.
- A finding is a plan defect, not a code defect → filed against the plan doc, not as a ticket.

## Acceptance criteria

- [ ] Rubric extended and both runs recorded with scores ≥ 90%.
- [ ] Nine live sessions observed and recorded (no PII in the repo).
- [ ] `humanness.report.ts` runs over the observed sessions and every bar in the table holds;
      the report is committed under `dev-docs/acceptance/phase2h/`.
- [ ] Every finding filed as a ticket with an id; the list is in the PR.
- [ ] README Phase 2H exit note updated to "passed" with the date, or lists the failing bars.

## Verification

```bash
npm run golden:tutoring -w @aria/api -- --rubric human
npm run report:humanness -w @aria/api -- --since <date>
```

## References

- `master-plan.md` §5 "The one thing the child must feel", §11
- P0-22, P1-15, P2H-01 … P2H-13
