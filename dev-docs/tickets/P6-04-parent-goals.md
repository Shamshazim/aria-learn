# P6-04 — Parent goals folded into the plan

| | |
|---|---|
| **Phase** | 6 |
| **Track** | Backend |
| **Depends on** | P3-04, P6-01 |
| **Blocks** | P6-09 |
| **Parallel-safe with** | P6-02, P6-03, P6-05, P6-07 |
| **Size** | M |

## Why

`master-plan.md` §7: "'He has a spelling test Friday.' Aria works it into the plan." A goal
is the parent steering the tutor without a menu. P1-04 loads "active goals" at arrival but
nothing writes them; this ticket gives them a table, an endpoint and a place in the scheduler.

## Scope

### Build
Migration `020` `learner_goal`; `POST/GET/DELETE /api/v1/parent/children/{id}/goal`; a
goal-to-skill resolver; scheduler integration so due-skill selection weights active goals;
expiry; conflict handling; Aria acknowledging the goal to the child.

### Do not build
No teacher directives (P6-08 shares the resolver). No goals set by the child.

## Design

```sql
learner_goal  id UUID PK, student_id UUID NOT NULL REFERENCES student(id) ON DELETE CASCADE,
              parent_id UUID NOT NULL REFERENCES parent(id) ON DELETE CASCADE,
              text TEXT NOT NULL,                        -- as the parent wrote it
              skill_ids JSONB NOT NULL,                  -- resolved targets (may be empty)
              subject VARCHAR(16),                       -- if unresolved to skills
              priority VARCHAR(8) NOT NULL DEFAULT 'normal',   -- 'normal' | 'urgent'
              active_from TIMESTAMPTZ NOT NULL DEFAULT now(),
              active_until TIMESTAMPTZ,                  -- null = until achieved/removed
              status VARCHAR(16) NOT NULL DEFAULT 'active',    -- active | achieved | expired | removed | unresolved
              resolution JSONB NOT NULL,                 -- how text became skills, confidence
              created_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

```
apps/api/src/services/goals/
  goal.service.ts         create/list/remove; calls resolver; emits acknowledgement episode
  resolve.ts              deterministic keyword map -> skill codes first; FAST model second,
                          constrained to inventory codes; below confidence 0.6 => 'unresolved'
  scheduler-weight.ts     pure function: (dueSkills, goals, now) -> weighted candidates
  expiry.ts               job: mark expired; mark achieved when every target skill strength
                          crosses the P3-04 mastery threshold
apps/api/src/repositories/learner-goal.repository.ts
apps/api/src/controllers/parent/goal.controller.ts
packages/tutor/src/policy/goals.ts   consumes a GoalsPort; the weighting is policy, not model
```

Rules:
- The resolver may only output skill codes from the inventory (P0-17/P3-07); an unknown code
  is dropped. An unresolvable goal is stored as `unresolved` and the parent is told plainly
  what Aria can and cannot do with it ("Aria doesn't teach science yet").
- Weighting is deterministic: an `urgent` goal with `active_until` within 7 days is the first
  due skill of every session until achieved; a `normal` goal adds weight, never exclusivity —
  due spaced-repetition skills still appear (§4.2 layer 2 is not overridden).
- Goals never bypass prerequisites: if the goal skill's prerequisites are weak the scheduler
  goes backwards (§4.4) and the parent is told in the next digest.
- Aria acknowledges a new goal to the child once, in child terms ("Your grown-up said you have
  a spelling test Friday, so we'll practise those words"), through a P2H-03 CHECK_IN prompt;
  never as pressure.
- A goal is never shown to the child as a target with a number (§14).

### Edge cases
- Goal for a subject the parent disabled in controls → rejected with a message.
- Two goals targeting the same skill → merged in weighting, both listed.
- Conflicting goals (urgent reading + urgent math, same week) → both first-due, alternating
  sessions; the parent is told.
- `active_until` in the past → 400.
- Goal text with personal information ("test at Lincoln Elementary") → stored as written for
  the parent; only resolved skill codes cross to the vendor (P0-23), never the text.
- Goal achieved early → status `achieved`, mentioned in the digest, removed from weighting.
- Parent removes a goal mid-session → next turn's policy no longer weights it.
- More than 5 active goals → 409 with a plain message; goals are not a menu.

## Acceptance criteria

- [ ] Migration `020` applies and cascades.
- [ ] Resolver maps "spelling test Friday" to the writing/spelling skill codes with the
      deadline; "be better at math" resolves to subject-level weighting; "science fair"
      becomes `unresolved` with a plain explanation.
- [ ] Scheduler test: an urgent goal makes its skill first-due while a due spaced-repetition
      skill still appears in the session; a weak prerequisite is scheduled first.
- [ ] Goal text never appears in any prompt payload (scrubber test).
- [ ] Achievement and expiry jobs update status and the digest mentions it (P6-02 fixture).
- [ ] The child-facing acknowledgement contains no number, deadline pressure or grade.
- [ ] Ownership enforced; 5-goal cap enforced.

## Verification

```bash
npm run test -w @aria/api -- goals
npm run test -w @aria/tutor -- goals
```

## References

- `master-plan.md` §4.2, §4.4, §7, §10, §14; P1-04, P3-04, P0-23
