# P1-01 — Session, session_event and arrival_event

| | |
|---|---|
| **Phase** | 1 — The proactive tutor loop, text first |
| **Track** | Backend |
| **Depends on** | P0-04 |
| **Blocks** | P1-04, P1-05, P1-06, P1-09 |
| **Parallel-safe with** | P1-02, P1-03 |
| **Size** | M |

## Why

Layer 1 of memory is the turn log, and it is the ground truth everything else is derived from
and can be rebuilt from. It is also what a parent reads and what we debug from. Nothing in
Phase 1 can be trusted until every turn is recorded.

## Scope

### Build
Migration `004`, the repositories, the mappers and the domain types for the tutor loop's
three tables.

### Do not build
No memory facts (P1-02), no skills (P1-03), no API. Tables and access only.

## Design

Migration `004_session.sql` (`master-plan.md` §9):

```sql
session        id UUID PK, student_id UUID NOT NULL REFERENCES student(id) ON DELETE CASCADE,
               subject VARCHAR(32), grade VARCHAR(16), band VARCHAR(16),
               started_at TIMESTAMPTZ NOT NULL DEFAULT now(), ended_at TIMESTAMPTZ,
               end_reason VARCHAR(32), plan JSONB, summary TEXT

session_event  id UUID PK, session_id UUID NOT NULL REFERENCES session(id) ON DELETE CASCADE,
               seq INTEGER NOT NULL, at TIMESTAMPTZ NOT NULL DEFAULT now(),
               actor VARCHAR(16) NOT NULL,          -- child | aria | system
               kind VARCHAR(32) NOT NULL,           -- event kind or move kind
               text TEXT, skill_code VARCHAR(32), correct BOOLEAN,
               latency_ms INTEGER, evidence JSONB, payload JSONB,
               UNIQUE (session_id, seq)

arrival_event  id UUID PK, student_id UUID NOT NULL REFERENCES student(id) ON DELETE CASCADE,
               at TIMESTAMPTZ NOT NULL DEFAULT now(), welcome_kind VARCHAR(32),
               recommendation JSONB, accepted BOOLEAN
```

```
apps/api/src/repositories/
  session.repository.ts
  session-event.repository.ts
  arrival-event.repository.ts
apps/api/src/mappers/session.mapper.ts
apps/api/src/types/session.ts
```

Rules:
- `seq` is allocated inside the same transaction as the insert; the unique constraint makes a
  gap or a duplicate impossible under concurrency, and a test proves it.
- `payload` stores the full protocol event or move as sent, so a transcript can be replayed
  exactly — this is what makes P0-22's replay work against real sessions.
- Only one session per student may be open at a time; enforce with a partial unique index on
  `(student_id) WHERE ended_at IS NULL`.
- Every child-owned row cascades from `student`. "Delete means delete" is a schema property.

## Acceptance criteria

- [ ] Migration `004` applies and is idempotent.
- [ ] Concurrent event appends never produce a duplicate or a gap in `seq`.
- [ ] A second open session for the same student is rejected by the database.
- [ ] Deleting a student removes every session, event and arrival row.
- [ ] Repositories return domain objects, never raw rows, and all SQL is parameterised.
- [ ] Integration tests cover append, ordered read, resume-open-session and end.

## Verification

```bash
npm run db:migrate -w @aria/api && npm run test -w @aria/api -- session
```

## References

- `master-plan.md` §4.2 layer 1, §9, §13 Phase 1
