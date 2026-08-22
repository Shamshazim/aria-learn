# P1-02 — Evidence-backed learner facts

| | |
|---|---|
| **Phase** | 1 |
| **Track** | Backend |
| **Depends on** | P0-04 |
| **Blocks** | P1-09, P1-10 |
| **Parallel-safe with** | P1-01, P1-03 |
| **Size** | M |

## Why

"A tutor who forgets is not a tutor. A tutor who confidently remembers something false is
worse." Phase 1 needs the minimum durable memory the first real tutor loop requires — so it
does not pretend to load memory that does not exist — with evidence attached from the first
row, because retrofitting evidence onto memory is impossible.

## Scope

### Build
Migration `005` for `learner_fact`, `learner_fact_evidence` and `observation`, plus their
repositories and the supersede/correct path.

### Do not build
No episodes, no briefs, no consolidation logic — Phase 3 and P1-09. No retrieval — P1-10.

## Design

Migration `005_learner_memory.sql`:

```sql
learner_fact  id UUID PK, student_id UUID NOT NULL REFERENCES student(id) ON DELETE CASCADE,
              kind VARCHAR(32) NOT NULL,        -- preference | teaching_response | goal | ...
              value JSONB NOT NULL, confidence NUMERIC(3,2) NOT NULL,
              first_observed_at TIMESTAMPTZ NOT NULL, last_confirmed_at TIMESTAMPTZ NOT NULL,
              expires_at TIMESTAMPTZ, sensitivity VARCHAR(16) NOT NULL,
              model_shareable BOOLEAN NOT NULL DEFAULT TRUE,
              superseded_by UUID REFERENCES learner_fact(id)

learner_fact_evidence  fact_id UUID NOT NULL REFERENCES learner_fact(id) ON DELETE CASCADE,
                       source_kind VARCHAR(32) NOT NULL, source_id UUID NOT NULL,
                       recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()

observation   id UUID PK, student_id UUID NOT NULL REFERENCES student(id) ON DELETE CASCADE,
              at TIMESTAMPTZ NOT NULL DEFAULT now(), skill_code VARCHAR(32),
              kind VARCHAR(32) NOT NULL, note TEXT, confidence NUMERIC(3,2),
              expires_at TIMESTAMPTZ, source_event_id UUID REFERENCES session_event(id)
```

Rules that are enforced in code, not documented as intentions:
- **No fact without evidence.** The repository's only insert path takes a non-empty evidence
  array; there is no way to write a bare fact. The bar in `master-plan.md` §11 is 100%.
- A correction **supersedes** rather than deletes: `superseded_by` is set and the audit
  history survives. A parent saying "he doesn't like Minecraft anymore" must not erase what
  we believed and when.
- A temporary mood is never promoted into a stable trait: `expires_at` is required for
  `kind` values marked temporary, validated in code.
- `model_shareable` is the parent's exclusion switch, read by P0-23's scrubber.
- Facts describe, never judge. No IQ, label or diagnosis — enforced by a rejected-kind list
  with tests.

## Acceptance criteria

- [ ] Migration `005` applies; everything cascades from `student`.
- [ ] Inserting a fact without evidence is impossible — the type system and the repository
      both prevent it.
- [ ] A correction supersedes and preserves the original, proven by a test.
- [ ] A temporary-kind fact without `expires_at` is rejected.
- [ ] A judgemental kind is rejected with a clear error.
- [ ] Expired facts are excluded from reads by default.
- [ ] Deleting a student removes every fact, evidence row and observation.

## Verification

```bash
npm run test -w @aria/api -- memory
```

## References

- `master-plan.md` §4.2 layers 2–3, §9, §11, §12
