# P1-09 — Post-session consolidation

| | |
|---|---|
| **Phase** | 1 |
| **Track** | Backend |
| **Depends on** | P1-01, P1-02, P1-06 |
| **Blocks** | P1-15 |
| **Parallel-safe with** | P1-07, P1-08, P1-10 |
| **Size** | M |

## Why

Phase 1's exit test says that returning tomorrow, Aria accurately recalls at least one
supported fact from today. Consolidation is what makes that true — and the reason it is
carefully bounded is that a tutor who confidently remembers something false is worse than one
who forgets.

## Scope

### Build
The after-session job that proposes facts and observations from that session's events, and the
deterministic rules and confidence thresholds that decide what may become durable.

### Do not build
No episodes and no learner brief. Phase 3. No recursive summarisation, ever.

## Design

```
apps/api/src/services/memory/
  consolidate.service.ts     runs after session end, asynchronously
  propose/
    from-events.ts           deterministic proposals: skills attempted, error patterns,
                             response latency, session length actually tolerated
    from-model.ts            model-proposed candidate facts, TEACH tier, scrubbed input
  decide/
    thresholds.ts            confidence and repetition rules for durability
    conflict.ts              supersede vs. confirm an existing fact
  write.service.ts           writes facts WITH evidence, in one transaction
```

Rules:
- **Deterministic rules and confidence thresholds decide what may become durable.** A model
  proposal is a candidate, never a commitment.
- **A temporary mood is never promoted into a stable trait without repeated evidence.** One
  tired session is an observation with an expiry, not a fact about the child.
- Every written fact carries source event ids. There is no path that writes a fact without
  evidence (P1-02 makes that structural).
- A proposal that conflicts with an existing fact **supersedes** it and keeps the history.
- Consolidation is idempotent per session: running it twice must not double-write.
- It never blocks session end, and its failure is logged and retried, never surfaced to the
  child.
- If we would not show it to the parent, we do not write it (`master-plan.md` §4.2).

## Acceptance criteria

- [ ] Ending a session triggers consolidation asynchronously; a failure never fails the end
      request.
- [ ] Running consolidation twice on the same session produces no duplicate facts.
- [ ] Every written fact has at least one evidence row pointing at a real `session_event`.
- [ ] A single-session mood produces an expiring observation, not a durable fact.
- [ ] A repeated signal across N sessions promotes to a fact, with N in config and tested.
- [ ] A conflicting proposal supersedes and preserves the prior fact.
- [ ] Model input is `ScrubbedContext`; a test proves no identifier can reach the prompt.
- [ ] The tomorrow test: a scripted session today produces a fact that P1-04's welcome cites
      correctly tomorrow.

## Verification

```bash
npm run test -w @aria/api -- memory/consolidate
```

## References

- `master-plan.md` §4.2 ("How it is written"), §11, §13 Phase 1
