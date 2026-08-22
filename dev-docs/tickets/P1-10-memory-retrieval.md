# P1-10 — Relevant-memory retrieval and the prompt boundary

| | |
|---|---|
| **Phase** | 1 |
| **Track** | Backend |
| **Depends on** | P0-23, P1-02, P1-06 |
| **Blocks** | P1-15 |
| **Parallel-safe with** | P1-07, P1-08, P1-09 |
| **Size** | M |

## Why

"The tutor retrieves only the facts and episodes relevant to the current moment." Two reasons,
and both matter: an irrelevant fact makes Aria sound like she is reciting a file, and retrieved
context is prepended to every turn, so its length is multiplied by every call the child makes —
it is one of the three main cost levers.

## Scope

### Build
The retrieval service behind `load-context.ts`, its relevance rules, its budget, and the
scrubbed hand-off to `AiClient`.

### Do not build
No embeddings or vector store this phase unless the relevance tests demand it — start with
deterministic relevance on skill, recency, confidence and kind, and measure.

## Design

```
apps/api/src/services/memory/
  retrieve.service.ts      returns the smallest relevant slice
  relevance/
    rules.ts               skill match, recency, confidence, kind priority, expiry
    budget.ts              hard token budget for retrieved context
  present/
    to-context.ts          facts -> compact prompt context, then P0-23's scrub()
```

Rules:
- Retrieval is scoped to the current moment: the active skill, the active goal, the session's
  recent events, and stable teaching-response facts. Everything else stays out.
- A **hard token budget** on retrieved context, enforced by truncation in priority order and
  reported per call so its cost is visible in P0-15's log.
- Expired facts and parent-excluded facts (`model_shareable = false`) are never retrieved.
- Superseded facts are never retrieved; the correction wins immediately, which is what makes
  "parent corrections reflected in the next session: 100%" achievable.
- The output is `ScrubbedContext`. There is no other way into a prompt.

## Acceptance criteria

- [ ] Retrieval returns only facts matching the relevance rules, tested against a fixture
      learner with deliberately irrelevant facts present.
- [ ] The token budget is never exceeded; truncation is deterministic and tested.
- [ ] Expired, superseded and parent-excluded facts never appear.
- [ ] A parent correction takes effect on the very next turn, proven end to end.
- [ ] Retrieved-context size is recorded per call and visible in the cost report.
- [ ] The only path from a fact to a prompt goes through `scrub()`, enforced by types.

## Verification

```bash
npm run test -w @aria/api -- memory/retrieve
```

## References

- `master-plan.md` §4.2, §11, §12; `cloud-model-layer.md` §9, §11
