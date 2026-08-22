# P1-04 — Arrival: the welcome, check-in and recommendation

| | |
|---|---|
| **Phase** | 1 |
| **Track** | Backend |
| **Depends on** | P0-02, P1-01, P1-02, P1-03 |
| **Blocks** | P1-12, P1-15 |
| **Parallel-safe with** | P1-05, P1-07 |
| **Size** | M |

## Why

"Aria is not a function the child invokes after pressing her face." The relationship starts
**before** a class is chosen. This endpoint is the first thing that makes the product feel
like a tutor rather than an app, and it has a hard latency bar: a visible personalised
welcome in under 500ms at the 95th percentile.

## Scope

### Build
`POST /api/v1/student/arrival` — load context, return `WELCOME`, `CHECK_IN` and an optional
`RECOMMEND`, and record the arrival.

### Do not build
No speech. Phase 2. Every move carries `speech.text` so Phase 2 needs no protocol change.

## Design

```
apps/api/src/routes/student.routes.ts          + POST /arrival
apps/api/src/controllers/arrival.controller.ts
apps/api/src/schemas/arrival.schema.ts
apps/api/src/services/arrival/
  arrival.service.ts        orchestrator, ~60 lines
  context.loader.ts         name, last session, due skills, active goals, recent preferences
  welcome.composer.ts       verified templates -> WELCOME + CHECK_IN
  recommend.service.ts      due skills + goals -> an optional RECOMMEND
  templates/welcome.data.ts
```

Rules:
- **No model call on this path.** The welcome is prepared ahead of time or assembled from
  verified templates, so it does not wait on a model. This is how the 500ms bar is met, and
  it is stated as a design rule in `master-plan.md` §4.1.
- It must sound like continuity, not surveillance: *"Welcome back, Ajmal. Yesterday you stuck
  with regrouping even when it was hard. How are you feeling today?"* Every claim in the
  welcome comes from a real evidence-backed fact or event, or it is not said.
- A first-ever arrival, an arrival after a long absence, and an arrival with no due skills all
  have their own template path — none of them may produce an awkward empty welcome.
- The child still chooses. `RECOMMEND` is a suggestion; declining it is normal and is recorded
  (`accepted = false`) without any judgement in the next move.
- Every arrival writes an `arrival_event`.

## Acceptance criteria

- [ ] `POST /api/v1/student/arrival` returns `WELCOME`, `CHECK_IN` and optionally `RECOMMEND`,
      valid against the P0-02 schemas.
- [ ] p95 latency under 500ms measured over 100 local calls with a warm database.
- [ ] No model call occurs on this path, proven by an assertion on the provider call count.
- [ ] A welcome that references yesterday cites a real `session_event` or evidence-backed
      fact; a fabricated reference is impossible by construction.
- [ ] First arrival, returning-today, returning-after-two-weeks and no-due-skills each
      produce a sensible welcome, covered by tests.
- [ ] Declining the recommendation is recorded and changes nothing in tone.
- [ ] Every arrival writes exactly one `arrival_event`.

## Verification

```bash
npm run test -w @aria/api -- arrival
npm run bench:arrival -w @aria/api
```

## References

- `master-plan.md` §4.1 (arrival sequence), §11, §13 Phase 1
