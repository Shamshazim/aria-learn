# P3-04 — The full skill graph and scheduler

| | |
|---|---|
| **Phase** | 3 |
| **Track** | Backend |
| **Depends on** | P1-03, P0-17 |
| **Blocks** | P3-07, P3-08, P6-04 |
| **Parallel-safe with** | P3-01, P3-02, P3-03, P3-05 |
| **Size** | L |

## Why

`master-plan.md` §4.2 Layer 2 and §4.4: skill state "drives the scheduler. It is spaced
repetition, but for skills"; prerequisites let "the scheduler go *backwards* when a child is
stuck"; and when a misconception signature is seen twice "she does not hint. She reteaches
with the fix." Today `skill_state` is written but nothing reads `next_due_at` to choose
work, `prerequisites` is stored but never traversed, and the session plan is whatever
`session.skillCode` was set to at start. §5: "Two wrong answers must never happen twice in
a row without Aria changing what she is doing" has to be a policy invariant, not a hope.

## Scope

### Build
`packages/tutor/src/scheduler/` (pure, injectable), the strength/interval update, the
per-session plan, backward moves, misconception-driven reteach, and the policy invariant.
Wire it into `apply-policy.ts`, the arrival recommendation (`services/arrival/recommend.service.ts`)
and session creation.

### Do not build
No new skills (P3-07). No parent goals (P6-04 supplies `activeGoals` through the existing
port). No UI.

## Design

```
packages/tutor/src/scheduler/
  strength.ts        update(state, graded) -> SkillState   (deterministic; see below)
  interval.ts        nextDueAt(strength, streak, now)      strength→interval table
  graph.ts           prerequisitesOf, dependentsOf, isUnlocked(state map), weakestPrerequisite
  select-due.ts      dueSkills(states, graph, now, goals) -> ranked list
  plan.ts            buildSessionPlan(band, due, goals, lastSession) -> SessionPlan
  backward.ts        stepBack(skill, states, graph) -> skill | null
  misconception.ts   shouldReteachWithFix(studentMisconception) (seen_count >= 2 && !cleared)
  invariant.ts       neverStuckTwice(recentMoves, graded) -> forced change | null
  types.ts
packages/tutor/src/policy/teaching-policy.ts    calls invariant + misconception + backward
apps/api/src/services/session/session.service.ts  uses plan.ts at create/resume
apps/api/src/services/arrival/recommend.service.ts uses select-due.ts (replace heuristic)
apps/api/src/repositories/skill-state.repository.ts  add listForStudent, bulkUpsert
apps/api/src/db/migrations/012_skill_state_scheduler.sql
    ALTER TABLE skill_state ADD COLUMN interval_days NUMERIC(6,2) NOT NULL DEFAULT 0,
                             ADD COLUMN lapses INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE session ADD COLUMN plan JSONB;   -- if not already present per 004
```

**Strength update** (no model): correct → `strength += (1 - strength) * 0.3`, streak+1;
wrong → `strength *= 0.6`, streak 0, lapses+1; latency above the band's "automatic" bar
(facts skills only) counts as half-credit. Strength ∈ [0,1].

**Interval table** (`interval.ts`): strength <0.3 → tomorrow; 0.3–0.6 → 3 days; 0.6–0.8 →
7 days; ≥0.8 → 21 days, ×1.5 per additional streak ≥5 up to 60 days. A lapse resets the
multiplier. Missing a day never shortens an interval (§14: no punishing streak).

**Due selection** (`select-due.ts`), ranked: (1) skills a parent goal names and that are
unlocked; (2) overdue skills, most overdue first; (3) shaky skills (`0.3–0.6`) whose
prerequisites are all ≥0.6; (4) one new skill whose prerequisites are ≥0.7. Never more than
one new skill per session; early band never more than 3 distinct skills per session.

**Session plan** (`plan.ts`): ordered `PlanStep[] {skillCode, mode: 'retrieve'|'teach'|'practice'|'read-aloud', maxItems}`
sized to the band's session length, starting with an easy retrieval step (warm-up) and
ending with a "read something or count something out loud" step for the early band (§5).

**Backward move** (`backward.ts`): after two wrong on a skill *with different* error
signatures, or a SWITCH, choose the weakest prerequisite with `strength < 0.7`; if none,
return null and the policy uses SWITCH to a different strand.

**Misconception**: on `seen_count >= 2` and not cleared, policy emits RETEACH with the
misconception's `remediation` as the required content brief. Cleared when the skill is
answered correctly three times after `first_seen_at` without the signature reappearing.

**Invariant** (`invariant.ts`): given the last two graded attempts on the same skill are
wrong, the next move must not be ASK on the same item form. Allowed: HINT (only if no hint
yet), RETEACH, backward move, SWITCH, BREAK. A plan that violates this is rewritten by the
policy and logged `policy.invariant.stuck-twice`.

### Edge cases
- Cycle in `prerequisites` (authoring error): `graph.ts` detects at load and throws at
  startup; `validate.ts` in `curriculum/` gets the check.
- Skill in `skill_state` no longer in inventory: ignored by the scheduler, kept in the DB.
- Child with no `skill_state` rows (first session): plan = band entry skills (those with
  no prerequisites in the chosen subject).
- All skills for the subject strong and none due: choose the least-recently-seen strong
  skill for a short retrieval, then the next unlocked new skill.
- Goal names a locked skill: goal is honoured by scheduling its weakest prerequisite; the
  plan records `goalIndirect: true`.
- Session resumed after `PAUSE`/reconnect: plan is loaded from `session.plan`, position
  from the last recorded move; not rebuilt.
- Answer graded `null` (open response): no strength change.
- Timezones: "tomorrow" is computed in the student's timezone (`student.timezone`, default
  from the parent account); a session at 23:30 and one at 00:10 are different days.

## Acceptance criteria

- [ ] Strength and interval updates are pure functions with table-driven tests covering
      every row of the interval table and the lapse reset.
- [ ] A prerequisite cycle fixture fails curriculum validation with the cycle named.
- [ ] Given a fixture of skill states, `dueSkills` returns the documented ranking; goals
      first, never two new skills.
- [ ] After two wrong answers with different signatures, the policy chooses the weakest
      prerequisite; with the same signature twice, it chooses RETEACH with the fix — both
      proven by tests on `teaching-policy.ts`.
- [ ] The stuck-twice invariant is enforced: a fixture stream of two wrong ANSWERs can never
      yield ASK on the same form as the third move, over 1,000 randomised event streams.
- [ ] Missing 7 days never shortens any interval (property test).
- [ ] Early-band plans contain ≤3 skills and end with a read-aloud or count-aloud step.
- [ ] Arrival recommendation names the top due skill's subject, and the tutoring golden set
      scenario "repeated confusion" now ends with a backward move or SWITCH, not a third ASK.
- [ ] `packages/tutor` still imports nothing from `apps/*`.

## Verification

```bash
npm run test -w @aria/tutor -- scheduler policy
npm run test -w @aria/api -- services/session services/arrival curriculum
npm run golden:tutoring -w @aria/api -- --scenario repeated-confusion
```

## References

- `master-plan.md` §4.2 (Layer 2), §4.4, §5 ("Never stuck, never bored"), §6.3, §14
- `P1-03-skill-state-tables.md`, `P1-08-teaching-policies.md`, `P0-17-initial-skill-inventory.md`
