# P7-01 — Shared verified content across children

| | |
|---|---|
| **Phase** | 7 |
| **Track** | Backend |
| **Depends on** | P2H-10, P0-20, P0-23 |
| **Blocks** | P7-02, P7-05 |
| **Parallel-safe with** | P7-03, P7-04, X-01, X-04 |
| **Size** | M |

## Why

`master-plan.md` §4.5: "a verified Grade 2 regrouping problem is good for every Grade 2
child. This is how latency and cost both come down." Today `content_item` is cached per
lookup key but the corpus is thin, personalised and shared items are distinguished only by
`personalised_for`, and nothing measures how often a child gets a fresh model call for a
problem another child already verified last week. Phase 7 turns the cache from a safety
primitive into the main content source — without ever leaking one child's life into
another child's session.

## Scope

### Build
A shared-content pool: verified, non-personalised items generated ahead of demand for every
skill × band × kind in the inventory, a sharing eligibility rule enforced by type, a coverage
report, and a bulk generation job that fills gaps through the full quality gate.

### Do not build
No new item kinds. No changes to the gate (P0-18). No sharing of anything with a
`personalised_for` value — that rule is already in `apps/api/src/content/cache/eligibility.ts`
and this ticket tightens it, never loosens it. No cross-tenant sharing of reading passages
that depend on a child's taught-pattern set (P4-03 owns those; they are keyed by
pattern-set hash, not by child, and are shared only by that hash).

## Design

```
apps/api/src/content/
  sharing/
    shareability.ts        classifies a ContentDraft as SHARED | PERSONAL by construction:
                           PERSONAL iff scope carries studentId, any learner fact, a first
                           name, or a narrative_thread id. Return type is a branded union;
                           store() refuses a PERSONAL draft without personalisedFor.
    coverage.service.ts    for each (skill, band, kind) in the inventory: verified item
                           count, times_used total, last_verified_at, and a target count
    coverage.report.ts     plain-text + JSON report for the operator status route
    bulk-generate.service.ts  fills gaps: for each under-target cell, generate → gate →
                           store, through the same resolve-content path as a live turn;
                           bounded by an operator-set spend budget per run, never a child's
                           daily cap
    dedupe.ts              normalised-body hash (whitespace, case, digits kept) so two
                           children never get "3 + 4" twice under different ids
  cache/eligibility.ts     (edit, one rule) mayServeTo returns false when item.personalisedFor
                           is set and does not equal the requesting student — unchanged —
                           AND returns false when item.scope kind is SHARED but body matches
                           the PERSONAL name-leak lint (belt and braces)
apps/api/src/scripts/content-coverage.ts     npm run content:coverage -w @aria/api
apps/api/src/scripts/content-fill.ts         npm run content:fill -w @aria/api -- --budget-usd 5
apps/api/src/repositories/content-item.repository.ts  (edit) add countBy(skill, band, kind),
                           findByBodyHash, and a body_hash column via migration 024
```

Migration `024_content_item_sharing.sql`: add `body_hash CHAR(64) NOT NULL`, `shareable
BOOLEAN NOT NULL DEFAULT false`, partial unique index `(body_hash, skill_id, band) WHERE
shareable`, backfill from existing rows.

Rules:
- Shareability is decided by the draft's *inputs*, never by inspecting the output text
  alone. A draft built from any scrubbed learner context is PERSONAL even if the text looks
  generic.
- The bulk job runs the identical gate path as a live turn; no "batch mode" that skips a
  check.
- Cost of the bulk job is logged in `ai_generation_log` with `student_id NULL` and
  `prompt_name` set, so P7-04 can separate shared-pool cost from per-child cost.
- Targets per cell are a config table (`content/sharing/targets.ts`), not magic numbers.

### Edge cases
- Two children request the same uncached cell concurrently: both generate; on store the
  unique index rejects the second, the service returns the first, and the second's cost is
  still logged as spend (not hidden).
- An item is later found wrong (golden regression, parent report): `content_item.verified_at`
  is nulled by the existing invalidation path and the item stops being served to *everyone*
  within one lookup, tested.
- A shared item contains a name by accident (model ignored the prompt): the name-leak lint
  in `shareability.ts` (first-name list from `student` rows + capitalised-token heuristic)
  fails it to PERSONAL; it is then never stored as shared.
- Bulk job hits the run budget mid-cell: stops cleanly, reports what was filled, and is
  idempotent on re-run.
- Provider outage during the job: breaker opens, job exits non-zero, no partial item is
  stored (gate pass and store are one transaction).
- Inventory grows (P3-07 adds a skill): coverage report shows the new cell at 0 and the fill
  job picks it up with no code change.

## Acceptance criteria

- [ ] Migration `024` applies; backfill produces a `body_hash` for every existing row and the
      partial unique index holds.
- [ ] A type test proves a draft with any learner-context input cannot be stored as shareable.
- [ ] `content:coverage` reports every (skill, band, kind) cell in the P0-17/P3-07 inventory.
- [ ] `content:fill --budget-usd 1` on a fresh database fills cells in target order, stops at
      the budget, and a second run resumes without duplicates.
- [ ] Duplicate-body items are rejected at store; concurrent-generation test passes.
- [ ] A shared item served to child A is served to child B from cache with zero model calls,
      asserted by `ai_generation_log` rows (`cached = true`).
- [ ] A personalised item for child A is never returned to child B (existing test extended
      to the new shareable column).
- [ ] Invalidating one shared item stops it for all children on the next lookup.
- [ ] The name-leak lint fails a fixture item containing a student first name.
- [ ] Cache hit rate for content lookups on the tutoring golden set rises above 80% after a
      fill; the number is recorded in the PR.

## Verification

```bash
npm run test -w @aria/api -- content/sharing content/cache
npm run content:coverage -w @aria/api
npm run content:fill -w @aria/api -- --budget-usd 1 --dry-run
npm run golden:content -w @aria/api
```

## References

- `master-plan.md` §4.5, §12.2, §13 Phase 7
- `cloud-model-layer.md` §6 (cache), §9 (cost)
- P0-20, P0-23, P2H-10
