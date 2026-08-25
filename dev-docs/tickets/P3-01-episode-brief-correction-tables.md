# P3-01 — Episodes, briefs and correction history (migration 010)

| | |
|---|---|
| **Phase** | 3 |
| **Track** | Backend |
| **Depends on** | P1-02 |
| **Blocks** | P3-02, P3-03, P3-06 |
| **Parallel-safe with** | P3-04, P3-05, P3-07 |
| **Size** | M |

## Why

Phase 1 stores typed facts with evidence (`learner_fact`, `learner_fact_evidence`,
`observation`). `master-plan.md` §4.2 names two more Layer-3/4 artifacts — **episodes**
("place value clicked after three weeks") and the **learner brief** (the parent-readable
paragraph) — and §12.6 requires a correction path whose history is auditable. None of the
three has a table yet. Every later Phase 3 ticket writes into these.

## Scope

### Build
Migration `010_learner_episode_brief.sql`, three tables, repositories, shared types, and the
row-level invariants below. Nothing that *produces* rows: that is P3-02 (episodes), P3-03
(briefs) and P3-06 (corrections).

### Do not build
No consolidation logic, no brief generation, no parent routes, no UI.

## Design

```sql
-- 010 — episodes, briefs, correction history
CREATE TABLE learner_episode (
    id UUID PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES student (id) ON DELETE CASCADE,
    at TIMESTAMPTZ NOT NULL,
    kind VARCHAR(32) NOT NULL,            -- breakthrough | struggle | preference_change |
                                          -- return_after_absence | goal_reached | other
    summary TEXT NOT NULL,                -- describes, never judges (P3-03 lint reused)
    importance NUMERIC(3,2) NOT NULL CHECK (importance BETWEEN 0 AND 1),
    skill_code VARCHAR(32) REFERENCES skill (code) ON DELETE SET NULL,
    source_session_id UUID NOT NULL REFERENCES session (id) ON DELETE CASCADE,
    sensitivity VARCHAR(16) NOT NULL,     -- same domain as learner_fact.sensitivity
    model_shareable BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    superseded_by UUID REFERENCES learner_episode (id) ON DELETE SET NULL
);
CREATE INDEX learner_episode_student_at_idx
    ON learner_episode (student_id, at DESC) WHERE superseded_by IS NULL;

CREATE TABLE learner_episode_evidence (
    episode_id UUID NOT NULL REFERENCES learner_episode (id) ON DELETE CASCADE,
    source_kind VARCHAR(32) NOT NULL,     -- session_event | oral_reading | child_writing
    source_id UUID NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (episode_id, source_kind, source_id)
);

CREATE TABLE learner_brief (
    id UUID PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES student (id) ON DELETE CASCADE,
    period VARCHAR(8) NOT NULL,           -- week | month | year
    period_start DATE NOT NULL,
    version INTEGER NOT NULL CHECK (version >= 1),
    written_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    body TEXT NOT NULL,
    evidence_snapshot JSONB NOT NULL,     -- fact/episode/skill_state ids the body was built from
    generator VARCHAR(64) NOT NULL,       -- prompt id + model, for rebuild comparison
    superseded_by UUID REFERENCES learner_brief (id) ON DELETE SET NULL,
    UNIQUE (student_id, period, period_start, version)
);
CREATE INDEX learner_brief_current_idx
    ON learner_brief (student_id, period, period_start) WHERE superseded_by IS NULL;

CREATE TABLE learner_fact_correction (
    id UUID PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES student (id) ON DELETE CASCADE,
    target_kind VARCHAR(16) NOT NULL,     -- fact | episode
    target_id UUID NOT NULL,              -- the superseded row
    replacement_id UUID,                  -- NULL = retracted with no replacement
    corrected_by VARCHAR(16) NOT NULL,    -- parent | child | staff
    corrected_by_id UUID,                 -- parent id when parent; NULL for child
    old_value JSONB NOT NULL,
    new_value JSONB,
    reason TEXT,
    at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX learner_fact_correction_student_idx ON learner_fact_correction (student_id, at DESC);
```

```
packages/shared/src/memory/
  episode.ts                 LearnerEpisode, EpisodeKind
  brief.ts                   LearnerBrief, BriefPeriod
  correction.ts              FactCorrection, CorrectedBy
apps/api/src/repositories/
  learner-episode.repository.ts   insert, listCurrent(studentId, now), supersede, addEvidence,
                                  hasEvidence(sourceKind, sourceId)
  learner-brief.repository.ts     insertVersion, current(studentId, period, start),
                                  history(studentId, period), supersede
  fact-correction.repository.ts   insert, listForStudent
apps/api/src/mappers/memory.mappers.ts   row -> shared type (extend, stay under 300 lines)
```

Rules:
- Repositories follow the `withDb(tx)` pattern of `learner-memory.repository.ts`; no SQL
  outside repositories.
- `insertVersion` computes `version = max + 1` inside the transaction; a concurrent insert
  hits the UNIQUE constraint and retries once.
- `supersede` never deletes. Deletion only happens through the child-erasure path (P6-06) via
  the `student` cascade.
- `sensitivity` and `model_shareable` are mandatory on episodes so P0-23's scrubber can apply
  the same rule as for facts: `model_shareable = false` rows never reach a prompt.

### Edge cases
- Episode whose `source_session_id` is deleted (erasure): cascades; evidence rows cascade with
  it. Facts referencing the episode as evidence lose that row and may fall below threshold —
  P3-02's rebuild handles it.
- Brief version gap (versions 1,2,4): allowed; `current` uses `superseded_by IS NULL`, not
  the highest number.
- Correction of an already-superseded target: allowed (audit history), but `replacement_id`
  must be a current row, checked in the repository.
- Correction with `new_value = NULL` and `replacement_id = NULL` = retraction; consumers
  treat the target as absent.
- `expires_at` in the past: `listCurrent` excludes it; the row stays for audit.

## Acceptance criteria

- [ ] Migration `010` applies on an empty database and on a database at `008`; `down` is
      not required (project convention) but the migration is idempotent under `IF NOT EXISTS`.
- [ ] Every table cascades from `student`, proven by a test that deletes a student and
      asserts zero rows in all four tables.
- [ ] Repository tests cover insert/listCurrent/supersede/expiry for episodes; version
      increment and concurrent-insert retry for briefs; retraction and replacement for
      corrections.
- [ ] `listCurrent` never returns superseded or expired rows.
- [ ] Shared types are exported from `@aria/shared` and have no `any`.
- [ ] No file exceeds 300 lines; `learner-memory.repository.ts` is not modified.

## Verification

```bash
npm run migrate -w @aria/api
npm run test -w @aria/api -- repositories/learner-episode repositories/learner-brief repositories/fact-correction
npm run typecheck && npm run lint
```

## References

- `master-plan.md` §4.2 (Layers 3–4, "How it is written"), §9 (Memory tables), §12.6, §12.9
- `dev-docs/tickets/P1-02-learner-memory-tables.md` — the pattern this extends
- `CODE-STANDARDS.md` §3 (repositories), §2
