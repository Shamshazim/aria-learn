# P1-03 — Skill state and misconception tracking

| | |
|---|---|
| **Phase** | 1 |
| **Track** | Backend |
| **Depends on** | P0-04, P0-17 |
| **Blocks** | P1-04, P1-06, P1-08 |
| **Parallel-safe with** | P1-01, P1-02 |
| **Size** | M |

## Why

Phase 1 needs enough of the skill graph for Aria to know what is due and what wrong idea she
has already seen twice. The full scheduler is Phase 3; without the minimum here, the tutor
loop has nothing to decide from and the recommendation at arrival is a guess.

## Scope

### Build
Migration `006` for `skill`, `skill_state`, `misconception` and `student_misconception`, the
seed that loads the P0-17 inventory into the database, and the repositories.

### Do not build
No spaced-repetition scheduler. Phase 3. Phase 1 uses a simple due rule, stated below and
marked as provisional in code.

## Design

```sql
skill        code VARCHAR(32) PK, subject VARCHAR(32), strand VARCHAR(32),
             name TEXT, band VARCHAR(16), prerequisites TEXT[]

skill_state  student_id UUID REFERENCES student(id) ON DELETE CASCADE,
             skill_code VARCHAR(32) REFERENCES skill(code),
             strength NUMERIC(4,3) NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0,
             correct_streak INTEGER NOT NULL DEFAULT 0,
             last_seen_at TIMESTAMPTZ, next_due_at TIMESTAMPTZ,
             PRIMARY KEY (student_id, skill_code)

misconception  id UUID PK, skill_code VARCHAR(32) REFERENCES skill(code),
               name TEXT, signature JSONB, remediation TEXT

student_misconception  student_id UUID REFERENCES student(id) ON DELETE CASCADE,
                       misconception_id UUID REFERENCES misconception(id),
                       seen_count INTEGER NOT NULL DEFAULT 0,
                       first_seen_at TIMESTAMPTZ, cleared_at TIMESTAMPTZ,
                       PRIMARY KEY (student_id, misconception_id)
```

- The seed loads P0-17's authored inventory idempotently at boot or by script; the authored
  files stay the source of truth, the tables are the runtime index.
- Prerequisites make the graph traversable **backwards**: given a stuck skill, return the
  unmet prerequisite chain. That is the query that lets Aria go back a step, which the old
  linear topic list could not do.
- Misconception detection matches a `signature` against the child's answer. Detection is
  deterministic and lives with the checkers, not in a prompt.
- Provisional Phase 1 due rule: a skill is due if never seen, or `next_due_at <= now()`, with
  a simple strength-based interval. Mark it `// provisional — Phase 3 scheduler` so it is not
  mistaken for the real thing.

## Acceptance criteria

- [ ] Migration `006` applies and the P0-17 inventory seeds idempotently.
- [ ] `findUnmetPrerequisites(student, skill)` returns the chain, tested on a three-deep case.
- [ ] Recording an attempt updates strength, attempts, streak, `last_seen_at` and
      `next_due_at` atomically.
- [ ] A misconception signature match increments `seen_count`; the second match is
      detectable by the caller (P1-08 reteaches on it).
- [ ] Due-skill query returns a deterministic, tested ordering.
- [ ] Everything cascades from `student`.

## Verification

```bash
npm run test -w @aria/api -- curriculum skill-state
```

## References

- `master-plan.md` §4.4, §9, §13 Phase 1
