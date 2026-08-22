# P0-23 — The privacy boundary and context scrubber

| | |
|---|---|
| **Phase** | 0 — Foundation |
| **Track** | Backend |
| **Depends on** | P0-03 |
| **Blocks** | P0-14, P1-10 |
| **Parallel-safe with** | most of Phase 0 |
| **Size** | M |

## Why

Cloud-only means prompt text crosses a vendor boundary. `master-plan.md` §12.2 and
`cloud-model-layer.md` §11 make that a code requirement, not a policy page: identifying data
never leaves Aria's service. Durable relationship memory is among the most sensitive data we
hold, and it is exactly what a tutor prompt wants to include.

## Scope

### Build
One scrubber module every outbound model call must pass through, the disclosure record of
what categories were shared, and the type-level guarantee that unscrubbed context cannot be
sent.

### Do not build
No parent-facing UI. That is Phase 6; this ticket produces the record it will read.

## Design

```
apps/api/src/privacy/
  scrub.ts              scrubLearnerContext(raw) -> ScrubbedContext (a branded type)
  rules/
    identifiers.ts      full name, school, address, parent email, phone, exact birthdate
    redact.ts           replacement strategy, deterministic and reversible only in-house
    exclusions.ts       facts the parent has excluded from model personalisation
  disclosure/
    disclosure.service.ts   records the categories of context sent per call
  types.ts              ScrubbedContext is branded; there is no public constructor
```

Rules, verbatim from the plans:
- The prompt carries a skill, grade band, recent evidence and the smallest relevant slice of
  learner memory. It **never** carries a full name, school, address or parent email.
- A pseudonymous first name is allowed **only when it materially changes the teaching**, and
  that decision is explicit per prompt, not a default.
- Facts the parent has excluded from model personalisation are omitted.
- The parent can inspect what was shared: store the **categories** of learner context sent
  for each call. Do not claim a transcript alone is the complete internal prompt.
- Zero-retention API terms are recorded per endpoint in the `ai.yaml` comments.

The guarantee is structural: `AiClient` (P0-14) accepts only `ScrubbedContext`, which can
only be produced by `scrub.ts`. There is no cast that makes an unscrubbed object acceptable
without failing lint.

## Acceptance criteria

- [ ] `ScrubbedContext` cannot be constructed outside `scrub.ts`.
- [ ] A context containing a full name, school, address, email or phone is scrubbed, proven
      by a fixture table covering each identifier class.
- [ ] Parent-excluded facts are omitted.
- [ ] Every model call records the categories of context shared, linked to the call's log row.
- [ ] A test attempts to call `AiClient` with raw context and fails to compile — recorded as
      a type-level test.
- [ ] No scrubber input or output is logged in full; only category names.

## Verification

```bash
npm run test -w @aria/api -- privacy
```

## References

- `master-plan.md` §12, `cloud-model-layer.md` §11
