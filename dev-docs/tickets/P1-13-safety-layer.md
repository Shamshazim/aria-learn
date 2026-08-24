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
             escalated_at TIMESTAMPTZ, escalation_route VARCHAR(32),
             needs_review BOOLEAN NOT NULL DEFAULT false
```

```
apps/api/src/safety/
  classify/input.classifier.ts    classifies what the CHILD says
  crisis/
    detect.ts                     deterministic patterns FIRST, then the classifier
    respond.ts                    fixed, reviewed, non-model response text
    escalate.ts                   routes by the safeguarding escalation matrix
                                  (amended 2026-08-23 — was notify.ts, "immediate parent alert")
    matrix.ts                     the reviewed matrix: category -> wording + contact route
  flag.service.ts
apps/api/src/repositories/safety-flag.repository.ts
```

Rules, verbatim from the plan:
- **Every child-facing output passes the safety classifier. No exceptions, no fast path** —
  that is P0-18 check 4; this ticket adds the *input* side.
- **Crisis language routes to a human immediately.** Aria does not attempt to counsel. She
  responds gently, with **reviewed fixed text**, and a human is reached at once by the route
  the escalation matrix names. The detection path starts with deterministic patterns so it
  works even if every model is down.

**Amendment 2026-08-23** (from the `realtime-agent-harness.md` design review):
- **"Alert the parent at once" is replaced by an escalation matrix.** The parent — or
  another household member — may be the person the child is describing; automatic
  notification can raise the child's risk. A child-safeguarding professional defines a
  four-row matrix — *self-harm*, *immediate physical danger*, *abuse by a household member*,
  *general distress* — each with reviewed wording and an approved human contact route
  (parent, designated emergency contact, or hotline handoff). `escalate.ts` routes by that
  matrix and nothing else; a model never chooses the route. `parent_notified_at` becomes
  `escalated_at` + `escalation_route`.
- **Detection reads more than the final transcript.** The input side takes an optional
  `alternatives[]` (n-best / low-confidence phonetic near-misses, supplied by Phase 2 STT;
  empty for typed text). A near-miss on a high-risk pattern with low confidence does **not**
  continue tutoring: Aria gives a reviewed neutral check ("I want to make sure I heard you.
  Can you say that again?") and the turn is flagged for human review. Uncertain means
  "possibly serious", never "nothing".
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
- [ ] Every crisis category routes to the human contact the matrix names, and
      `escalated_at` / `escalation_route` are recorded; the matrix wording is reviewed by a
      safeguarding professional and that review is recorded in the PR.
- [ ] A low-confidence near-miss on a high-risk pattern yields the neutral check response
      and a `needs_review` flag, with no model call and no normal tutoring move.
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
- `realtime-agent-harness.md` — "Voice safety: transcripts are not enough"
