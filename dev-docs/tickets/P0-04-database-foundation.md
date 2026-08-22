# P0-04 — Database foundation and migration 001

| | |
|---|---|
| **Phase** | 0 — Foundation |
| **Track** | Backend |
| **Depends on** | P0-03 |
| **Blocks** | P0-15, P0-17, P0-20, P1-01, P1-02, P1-03 |
| **Parallel-safe with** | P0-10, P0-11, P0-12 |
| **Size** | M |

## Why

Cost logging (P0-15) needs a `student` to reference, and every Phase 1 table needs a
migration runner that already works. This is a new database: migrations start at `001` and
the 24 Flyway migrations under `legacy/` are historical evidence about shapes that worked,
never a sequence to continue.

## Scope

### Build
- PostgreSQL connection pool, a transaction helper, and a migration runner.
- Migration `001` — the minimum identity tables the rest of Phase 0 and Phase 1 reference.
- The repository pattern: one example repository with mappers and integration tests.
- A test database harness that runs migrations against a throwaway database.

### Do not build
- No auth logic, no password handling, no JWT. `001` creates the tables identity will use;
  P0-26 decides who issues credentials.
- No session, memory, curriculum or content tables. Those are Phase 1 tickets and each
  brings its own migration.

## Design

```
apps/api/src/db/
  pool.ts                 pg Pool from config; exported as a port, injected
  transaction.ts          withTransaction(fn) — one place BEGIN/COMMIT/ROLLBACK exists
  migrate.ts              runner: ordered, idempotent, recorded in schema_migration
  migrations/
    001_identity.sql
apps/api/src/repositories/
  student.repository.ts   the pattern all later repositories copy
apps/api/src/mappers/
  student.mapper.ts       row -> domain. Explicit field mapping, no spread of a row.
apps/api/src/types/
  student.ts
apps/api/test/
  db.harness.ts           create db, migrate, truncate between tests, drop after
```

Migration `001` creates, at minimum:

```sql
parent      id UUID PK, email CITEXT UNIQUE, display_name TEXT, created_at TIMESTAMPTZ
student     id UUID PK, parent_id UUID REFERENCES parent(id), display_name TEXT,
            grade TEXT NOT NULL, band TEXT NOT NULL, created_at TIMESTAMPTZ
schema_migration  version TEXT PK, applied_at TIMESTAMPTZ
```

Conventions fixed here and used by every later migration:
- `TIMESTAMPTZ` always, `now()` defaults, UTC everywhere. Never `TIMESTAMP`.
- UUID primary keys, generated in the application via the `ids` port so tests are
  deterministic.
- Partial unique indexes are available and used where a nullable column needs uniqueness.
- Every foreign key states its `ON DELETE` behaviour explicitly. Child data cascades from
  `student` — "delete means delete" (`master-plan.md` §12.9) is a schema property, not a
  cleanup script.
- Migrations are forward-only, never edited after merge, and named `NNN_snake_case.sql`.
- Raw SQL, checked in. No ORM. Repositories own the queries.

## Acceptance criteria

- [ ] `npm run db:migrate -w @aria/api` applies pending migrations and is a no-op on a
      second run.
- [ ] The runner records each applied version and refuses to run out of order.
- [ ] `student.repository.ts` has integration tests against a real PostgreSQL, using the
      harness, covering insert, find, not-found and a constraint violation mapped to an
      `AppError`.
- [ ] Deleting a `parent` cascades to their students, proven by a test.
- [ ] No SQL string is built by concatenation; every query is parameterised.
- [ ] No SQL appears outside `repositories/` and `db/`.
- [ ] `.env.example` documents `DATABASE_URL`.

## Verification

```bash
docker run --rm -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres:16
npm run db:migrate -w @aria/api
npm run test -w @aria/api
```

## References

- `master-plan.md` §9 (the table list this grows into)
- `rewrite.md` §3 (legacy migrations are evidence, not a sequence), §4
