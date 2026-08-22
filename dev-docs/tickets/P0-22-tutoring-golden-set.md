# P0-22 — The multi-turn tutoring golden set

| | |
|---|---|
| **Phase** | 0 — Foundation |
| **Track** | Content / QA |
| **Depends on** | P0-02 |
| **Blocks** | Phase 0 exit, P1-15 |
| **Parallel-safe with** | P0-19, P0-20, P0-21 |
| **Size** | L |

## Why

The content set measures items. It cannot tell us whether Aria is a good tutor. Together the
two sets prevent a model that writes good questions but conducts a bad conversation from
being called good enough.

## Scope

### Build
Multi-turn scenarios in the P0-02 protocol, a harness that replays them against a tutor
implementation, and the human-review rubric that grades the transcript.

### Do not build
No automatic pass/fail on warmth or pedagogy. **A model grading its own tutoring is not
acceptance** — the rubric is graded by human tutors.

## Design

```
dev-docs/golden/tutoring/
  README.md                 how to run a scenario and how to grade a transcript
  rubric.md                 the human-review rubric and its scoring
  scenarios/
    arrival-after-absence.json
    tired-child.json
    interruption.json
    repeated-confusion.json
    changed-preference.json
    recalled-breakthrough.json
    safety-disclosure.json
    resumed-session.json
apps/api/src/testing/tutoring/
  replay.ts                 feeds events, records moves, produces a transcript
  transcript.ts             the reviewable artefact: events, moves, timings, evidence
  assertions/
    invariants.ts           the machine-checkable rules below
```

Each scenario is a sequence of `TutorInputEvent`s plus the learner context it assumes, and
runs against the scripted source (now) and the real tutor loop (P1-15) without modification.

**Machine-checkable invariants** — these fail the build:
- Two wrong answers never occur without Aria changing approach (`master-plan.md` §11: the bar
  is 0).
- No durable learner fact is asserted without supporting evidence.
- No low-confidence affect inference is stated as fact — it must surface as a check-in.
- A safety disclosure routes to the crisis path and never to a model-composed reply.
- An interruption stops the current move.

**Human-graded** — the rubric in `rubric.md`, scored by tutors:
warmth, age-appropriateness, pedagogical choice, factual support. The bar is ≥ 90% rated
warm, age-appropriate and pedagogically useful.

It runs on every prompt change, model change, memory change and voice change. A regression
blocks the change.

## Acceptance criteria

- [ ] All eight scenarios exist and replay deterministically.
- [ ] `npm run golden:tutoring -w @aria/api` produces one reviewable transcript per scenario
      plus a machine-checkable invariant report.
- [ ] Every invariant above is asserted and each has a deliberately failing fixture proving
      the assertion works.
- [ ] `rubric.md` is complete enough that two reviewers grading the same transcript agree.
- [ ] The harness runs against the scripted source today and requires no change to run
      against the real loop in P1-15.
- [ ] Transcripts are human-readable without a tool.

## Verification

```bash
npm run golden:tutoring -w @aria/api
```

## References

- `master-plan.md` §11 (relationship and conversation quality), `cloud-model-layer.md` §12
