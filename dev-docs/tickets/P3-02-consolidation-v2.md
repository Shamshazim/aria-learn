# P3-02 — Consolidation v2: episodes, expiry, conflicts, rebuild

| | |
|---|---|
| **Phase** | 3 |
| **Track** | Backend |
| **Depends on** | P3-01, P1-09 |
| **Blocks** | P3-03, P3-08, P5-01 |
| **Parallel-safe with** | P3-04, P3-05, P3-07 |
| **Size** | L |

## Why

Phase 1 consolidation (`services/memory/consolidate.service.ts`) proposes facts from one
session's events and writes them when thresholds pass. It does not produce episodes, has no
expiry policy, resolves conflicts only by "newer wins", and can never detect that its own
summaries have drifted from the raw log. `master-plan.md` §4.2: memory is "evidence-backed
and rebuildable from the one below" and is "periodically rebuilt from the raw log so
summary drift can be detected". This ticket makes that literally true.

## Scope

### Build
- Episode proposals from session events.
- Expiry policy per fact kind.
- Conflict resolution rules, with corrections always winning.
- Sensitive-content exclusion enforced in code.
- A periodic **rebuild** job that re-derives Layer 3 from Layer 1 into a shadow set and
  reports drift.
- Idempotent re-runs of consolidation for the same session.

### Do not build
No brief generation (P3-03). No correction endpoints (P3-06). No engagement state (P3-05).
No scheduler infrastructure beyond a CLI entry point runnable by cron/CI.

## Design

```
apps/api/src/services/memory/
  consolidate.service.ts         orchestrator only; grows no rules (stays < 150 lines)
  propose/
    from-events.ts               existing fact proposals
    from-model.ts                existing
    episodes.ts                  NEW: EpisodeProposal[] from events (deterministic detectors)
    episodes.model.ts            NEW: optional model summary of a detected episode, gated
  decide/
    thresholds.ts                existing
    conflict.ts                  EXTEND: resolution rules below
    expiry.ts                    NEW: expiresAt(kind, confidence, now)
    sensitivity.ts               NEW: isPromotable(proposal) — sensitive => never durable
  rebuild/
    rebuild.service.ts           re-derive facts+episodes from raw events into a shadow table
    drift.report.ts              compare shadow vs current; DriftReport
    rebuild.cli.ts               `npm run memory:rebuild -w @aria/api -- --student <id>|--all`
  write.service.ts               existing; add writeEpisode, supersedeEpisode
apps/api/src/db/migrations/011_memory_rebuild_shadow.sql
    learner_fact_shadow, learner_episode_shadow  (same columns + rebuild_run_id)
    memory_rebuild_run  id, student_id, started_at, finished_at, drift_score, report JSONB
```

**Episode detectors** (deterministic, `propose/episodes.ts`), each with evidence ids:

| kind | signature |
|---|---|
| `breakthrough` | skill `strength` crosses 0.7 upward in this session after ≥2 prior sessions below 0.5 |
| `struggle` | ≥3 RETEACH or a SWITCH on one skill in one session |
| `return_after_absence` | gap since previous session ≥ 14 days |
| `preference_change` | fact proposal that contradicts a current `preference` fact |
| `goal_reached` | an active goal's target skill reaches `strength ≥ 0.8` |

Importance is computed, not modelled: breakthrough 0.9, goal_reached 0.9, struggle 0.6,
return 0.4, preference_change 0.5. A model may only *phrase* the summary from the detector's
structured input; the phrasing passes the describe-never-judge lint (P3-03) and the safety
classifier; if either fails, the deterministic template summary is used.

**Expiry** (`decide/expiry.ts`): `mood`/`engagement` kinds: 1 day (they are observations, not
facts); `preference`: 180 days unless re-confirmed; `teaching_response`: 365 days;
`goal`: goal's own end date; `breakthrough` episodes: never; `struggle` episodes: 90 days.
`last_confirmed_at` refreshes on re-observation and pushes `expires_at` forward.

**Conflict rules** (`decide/conflict.ts`), in order:
1. A row created by a correction (`learner_fact_correction.replacement_id`) is never
   superseded by consolidation. Only another correction can.
2. Newer *confirmed* evidence supersedes older when confidence ≥ old confidence − 0.1.
3. A single contradicting observation against a fact with ≥3 evidence rows does not
   supersede; it creates an `observation` and lowers confidence by 0.1.
4. Two proposals in one run for the same kind: highest confidence wins, the other is
   discarded (not queued).

**Sensitivity** (`decide/sensitivity.ts`): any proposal whose source event carries a
`safety_flag` (P1-13), or whose value matches the sensitive-category list (health, family
conflict, body, religion, immigration status, money), is rejected before thresholds.
This is the code enforcement of `master-plan.md` §12.4.

**Rebuild** (`rebuild/`): for a student, replay *all* `session_event` rows through the same
proposers and deciders into the shadow tables under one `rebuild_run_id`, then diff against
current rows by `(kind, normalised value)`. Drift score = |symmetric difference| / |union|.
Corrections are re-applied on top of the shadow set so a rebuild never "un-corrects".
The job never writes to live tables; promoting a shadow set is a manual, logged action.

### Edge cases
- Consolidation runs twice for a session: `hasEvidence('session_event', id)` guard already
  exists for facts; add the same for episodes. Second run is a no-op, proven by a test.
- Session with zero events, or ended by `LEAVE` after one move: no proposals, no error.
- Events arriving after consolidation (late outbox delivery, P2-13): a re-run picks up only
  the new events.
- Skill deleted from inventory: episode `skill_code` becomes NULL via `ON DELETE SET NULL`;
  detector skips unknown codes.
- Rebuild on a student with 10k+ events: paginate events by `seq` in batches of 500 inside
  one advisory lock; memory bounded.
- Model proposer unavailable: episodes still written with template summaries.
- Clock skew between API instances: all "now" comes from the injected `Clock`.

## Acceptance criteria

- [ ] Each episode detector fires on a fixture session and not on a near-miss fixture.
- [ ] Every episode row has ≥1 evidence row; asserted by a test over all fixtures.
- [ ] Re-running consolidation for the same session produces zero new rows.
- [ ] A fact past `expires_at` is excluded from retrieval and from `ScrubbedContext`.
- [ ] A corrected fact is never superseded by a later consolidation run, proven by a test
      that consolidates contradicting evidence after a correction.
- [ ] A proposal sourced from a flagged event never becomes a fact or episode; a proposal
      matching a sensitive category never does either.
- [ ] `memory:rebuild` on the Phase 1 golden student yields drift score 0 against a fresh
      consolidation, and a deliberately hand-edited fact yields drift > 0 and appears in the
      report.
- [ ] Rebuild writes nothing to live tables, asserted by row counts before/after.
- [ ] `consolidate.service.ts` contains no threshold, expiry or conflict constants.

## Verification

```bash
npm run migrate -w @aria/api
npm run test -w @aria/api -- services/memory
npm run memory:rebuild -w @aria/api -- --student <golden-student-id>
npm run golden:tutoring -w @aria/api -- --scenario recalled-breakthrough
```

## References

- `master-plan.md` §4.2 ("How it is written", "Rules that keep this safe"), §12.4, §12.8
- `P1-09-consolidation.md`, `P1-13-safety-layer.md`
- `CODE-STANDARDS.md` §2, §3
