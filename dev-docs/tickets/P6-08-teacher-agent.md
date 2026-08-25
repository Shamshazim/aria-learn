# P6-08 — Teacher: classes, report, ask, directive, alerts

| | |
|---|---|
| **Phase** | 6 |
| **Track** | Frontend + Backend |
| **Depends on** | P6-01, P6-03, P6-04, P3-04 |
| **Blocks** | P6-09 |
| **Parallel-safe with** | P6-02, P6-05, P6-06, P6-07 |
| **Size** | L |

## Why

`master-plan.md` §8: "Same agent, wider view." A teacher sees who is stuck on what, asks
Aria about the class, gives a directive that adapts each child's plan, and hears from Aria
unprompted when something matters. This is not a district sales motion (§14) — a parent links
their child to a teacher, and the parent can unlink at any time.

## Scope

### Build
Migration `023` `teacher`, `class`, `class_membership`, `teacher_directive`, `teacher_alert`;
teacher sign-in through the same identity port; the parent-side link flow; class report;
teacher ask (reusing P6-03's pipeline with class scope); directives folded into the scheduler
(reusing P6-04's resolver and weighting); unprompted alerts with explicit notification rules;
the teacher pages.

### Do not build
No school admin, no roster import, no gradebook, no per-child transcript for the teacher
(the parent's data is the parent's — a teacher sees skill-level aggregates and the child's
first name only), no grades (§14).

## Design

```sql
teacher            id UUID PK, auth_subject TEXT UNIQUE NOT NULL, email CITEXT UNIQUE NOT NULL,
                   display_name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
class              id UUID PK, teacher_id UUID NOT NULL REFERENCES teacher(id) ON DELETE CASCADE,
                   name TEXT NOT NULL, grade TEXT NOT NULL, join_code TEXT UNIQUE NOT NULL,
                   archived_at TIMESTAMPTZ
class_membership   class_id UUID REFERENCES class(id) ON DELETE CASCADE,
                   student_id UUID REFERENCES student(id) ON DELETE CASCADE,
                   linked_by_parent_id UUID NOT NULL, linked_at TIMESTAMPTZ NOT NULL,
                   unlinked_at TIMESTAMPTZ, PRIMARY KEY (class_id, student_id)
teacher_directive  id UUID PK, teacher_id, class_id, student_ids JSONB NOT NULL,
                   instruction TEXT NOT NULL, skill_ids JSONB NOT NULL, resolution JSONB,
                   active_from TIMESTAMPTZ NOT NULL, active_until TIMESTAMPTZ NOT NULL,
                   status VARCHAR(16) NOT NULL
teacher_alert      id UUID PK, teacher_id, class_id, kind VARCHAR(32) NOT NULL,
                   body TEXT NOT NULL, evidence JSONB NOT NULL, created_at, read_at, sent_at
```

```
apps/api/src/
  routes/teacher.routes.ts
  controllers/teacher/{classes,report,ask,directive,alerts}.controller.ts
  services/teacher/
    class.service.ts        create class, join code, membership, unlink
    report.service.ts       per-skill aggregates across the class, sorted by need (see rules)
    ask.service.ts          P6-03 pipeline with ClassScope retrieval (skill_state + episodes
                            of members, no transcripts)
    directive.service.ts    P6-04 resolver -> per-student learner_goal rows of kind
                            'directive' (parent-visible)
    alerts/
      detect.ts             deterministic rules (below); runs after consolidation
      notify.ts             email digest of alerts, rules-driven
  repositories/teacher.repository.ts, class.repository.ts, teacher-directive.repository.ts,
               teacher-alert.repository.ts
  services/parent/class-link.service.ts   parent enters join code; unlink
apps/web/src/features/teacher/
  pages/{SignIn,Classes,ClassReport,Ask,Directives,Alerts}.tsx
  components/{NeedRow,DirectiveForm,AlertCard,JoinCode}.tsx
  hooks/, api/, model/
apps/web/src/features/parent/pages/ClassLink.tsx   (in the P6-01 shell)
```

Rules:
- Linking is parent-initiated with a join code; the parent sees exactly what the teacher can
  see before confirming; unlinking is immediate and the teacher's cached report drops the
  child on next load.
- The teacher sees: first name, grade, per-skill strength band (weak / developing / strong —
  words, not numbers), current misconceptions, minutes this week, and whether a directive is
  active. Never transcripts, learner facts, briefs, writing, audio, safety flags or any other
  child's parent details.
- Report ordering: by need — count of weak skills that are prerequisites for the class's
  current directive skills, then misconceptions seen ≥2, then minutes descending. Never
  alphabetical, never a ranking shown as a leaderboard (§14): the list is grouped, not
  numbered.
- Directives become `learner_goal` rows of kind `directive` per student, visible to the
  parent (§7 nothing hidden) and subject to the parent's controls (a disabled subject
  rejects the directive for that child with a plain message to the teacher).
- Alert rules are deterministic and few: (1) ≥3 students share a misconception first seen
  within 14 days; (2) a directive skill's class-wide strength has not moved in 2 weeks; (3) a
  student has had zero sessions for 14 days while a directive is active. Notification rule:
  at most one alert email per teacher per day, never on weekends, never for a single child's
  bad day. Alerts are always visible in-app.
- Teacher ask reuses P6-03: citations resolve to skill-state and episode ids, not transcript
  events; the answer never names a child in a comparison ("X is the weakest").

### Edge cases
- Student linked to two classes → both teachers see aggregates; directives from both are
  weighted like two parent goals (P6-04 conflict rule).
- Directive for students not in the class → 400.
- Directive skill outside the inventory → `unresolved`, teacher told what Aria can teach.
- Class with one child → report shows the child, alert rule (1) can never fire; no
  comparison language.
- Parent unlinks mid-directive → the goal row is removed for that child; teacher sees "a
  student left".
- Child deleted (P6-06) → membership cascades; teacher sees the count drop, no name.
- Teacher account deleted → classes cascade; goal rows of kind `directive` are removed;
  parents see the directive gone in the memory view.
- Join code brute force → codes are 10 chars, rate limited (X-05), rotate on request.
- Teacher asks for a transcript or a child's full name → `OUT_OF_SCOPE` fixed reply.

## Acceptance criteria

- [ ] Migration `023` applies; cascades from `teacher`, `class` and `student`.
- [ ] Parent link → teacher sees the child; unlink → gone on next load; tested.
- [ ] Report exposes only the permitted fields — a schema test enumerates the response and
      fails on any new field not in the allowlist.
- [ ] Ordering is by need as specified and never renders a numbered rank.
- [ ] A directive creates per-student goals honouring parent controls; a disabled subject is
      rejected per child with a message.
- [ ] Each alert rule fires on its fixture and not on near-misses; notification cap and
      weekend rule tested with a fake clock.
- [ ] Teacher ask cannot retrieve transcript events or facts (scope test); comparison
      phrasing blocked by fixture.
- [ ] No grades, percentages or leaderboards anywhere in the teacher UI.

## Verification

```bash
npm run test -w @aria/api -- teacher
npm run test -w @aria/web -- teacher
```

## References

- `master-plan.md` §7, §8, §10, §12.6, §14; P6-03, P6-04, P3-04, P0-26
