# P1-13 — The safety layer and crisis routing

| | |
|---|---|
| **Phase** | 1 |
| **Track** | Backend + Frontend |
| **Depends on** | P0-18, P1-01 |
| **Blocks** | P1-15 |
| **Parallel-safe with** | P1-11, P1-12 |
| **Size** | M |

## Why

Gap 9. The first version had structural checks and nothing else. A child is going to type
something that matters one day, and the response to that cannot be a model's improvisation.
`master-plan.md` §12.5 is unambiguous: **crisis routing is tested and never model-dependent.**

## Scope

### Build
Migration `007` for `safety_flag`, input classification on the child's own text, the crisis
path, and parent notification.

### Do not build
No transcript-review tooling for parents. Phase 6. This ticket produces the records it reads.

## Design

```sql
safety_flag  id UUID PK, student_id UUID REFERENCES student(id) ON DELETE CASCADE,
             session_id UUID REFERENCES session(id) ON DELETE CASCADE,
             event_id UUID REFERENCES session_event(id),
             category VARCHAR(32) NOT NULL, severity VARCHAR(16) NOT NULL,
             text TEXT, detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
             parent_notified_at TIMESTAMPTZ
```

```
apps/api/src/safety/
  classify/input.classifier.ts    classifies what the CHILD says
  crisis/
    detect.ts                     deterministic patterns FIRST, then the classifier
    respond.ts                    fixed, reviewed, non-model response text
    notify.ts                     immediate parent alert
  flag.service.ts
apps/api/src/repositories/safety-flag.repository.ts
```

Rules, verbatim from the plan:
- **Every child-facing output passes the safety classifier. No exceptions, no fast path** —
  that is P0-18 check 4; this ticket adds the *input* side.
- **Crisis language routes to a human immediately.** Aria does not attempt to counsel. She
  responds gently, with **reviewed fixed text**, and the parent is alerted at once. The
  detection path starts with deterministic patterns so it works even if every model is down.
- **Aria never asks for personal information** — not address, school, full name or a photo.
- If a child volunteers something sensitive, it is **not** promoted into durable learner
  memory (P1-09 must honour this).
- The child's experience stays gentle: no alarming UI, no lockout, no "I have told your
  parent" as a threat.

## Acceptance criteria

- [ ] Migration `007` applies and cascades from `student`.
- [ ] Deterministic crisis patterns fire with every model disabled, proven by a test.
- [ ] A crisis response is fixed reviewed text; no model call occurs on that path, asserted
      by call count.
- [ ] The parent is notified immediately and `parent_notified_at` is recorded.
- [ ] Sensitive volunteered content never becomes a durable learner fact.
- [ ] Aria never emits a request for personal information; a prompt-injection fixture cannot
      make her.
- [ ] Every flag links to its session event so the transcript shows exactly what happened.
- [ ] The child-facing response is reviewed by a human and its wording is recorded in the PR.

## Verification

```bash
npm run test -w @aria/api -- safety
npm run golden:tutoring -w @aria/api -- --scenario safety-disclosure
```

## References

- `master-plan.md` §3 (gap 9), §12
