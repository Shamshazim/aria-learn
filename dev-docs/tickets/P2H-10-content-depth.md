# P2H-10 — Content depth for the initial scope

| | |
|---|---|
| **Phase** | 2H |
| **Track** | Backend + Content |
| **Depends on** | P0-16, P0-17 (P0-20 on `main`) |
| **Blocks** | P2H-11, P3-07, P7-01 |
| **Parallel-safe with** | P2H-01 … P2H-09, P2H-12 |
| **Size** | L |

## Why

The inventory has 18 skills and 3 misconceptions; arithmetic item generation throws by design
(`content.runtime.ts`) so six hand-written items are all there is; explanations are prompted
with a bare code like `ADD.REGROUP.2D`. A tutor with nothing to say about a skill cannot be
warm about it. This ticket gives every inventory skill items, misconceptions, lesson notes and
visuals — verified by code where the plan requires it.

## Scope

### Build
Arithmetic item generation for every inventory arithmetic skill using the deterministic
checker; ≥ 3 misconceptions per skill; lesson notes per skill; `SHOW` payloads per math skill;
cache pre-warm.

### Do not build
No new skills beyond the P0-17 inventory (P3-07). No reading passages (P4-03).

## Design

```
apps/api/src/curriculum/
  lessons/<SKILL.CODE>.md         teaching notes: what it is, the one idea, common stumbles,
                                  two concrete models, a worked example, language to use/avoid
  lessons/index.ts                typed loader; build fails if an inventory skill has no note
  misconceptions/<SKILL>.data.ts  ≥ 3 per skill: name, signature (deterministic matcher on the
                                  child's answer vs key), remediation approach + model
  visuals/show-payloads.ts        SHOW payload builders: number-line, ten-frame, array, fraction-bar,
                                  place-value-blocks; each with a caption prompt input
apps/api/src/content/generation/
  arithmetic/generate-item.ts     per-skill generator: parameters -> item; checker proves key
  arithmetic/params/<SKILL>.ts    ranges, regrouping flags, distractor rules
  arithmetic/distractors.ts       wrong options derived from the skill's misconception signatures
apps/api/src/scripts/
  prewarm-content.ts              fills content_item to N per skill per band (N=40), gated
packages/shared/src/curriculum/
  skill.ts                        Skill gains lessonRef, visualKinds[]
dev-docs/golden/content/items/    +≥ 10 human-graded items per new generator
```

**Generation is code-first**: the generator builds the item and the checker (P0-16) proves
the key; the model is used only to phrase the word-problem wrapper for middle/senior bands,
and that phrasing is gated (structural, level, safety) with the numbers pinned. Distractors
come from misconception signatures so a wrong tap tells us *which* wrong idea.

**Lesson notes** are the grounding for `SAY`/`RETEACH` prompts (P2H-03 `explain`, `reteach`
receive the note, not the code). Notes are reviewed by a teacher; the review is recorded.

**SHOW payloads** already exist in the protocol (`moves.ts SHOW`); this ticket defines one
builder per visual kind and which skills use which. Early band `RETEACH` with
`approach: 'visual-model'` must produce a SHOW.

### Edge cases
- Checker cannot prove an item (division with remainder outside scope) → generator refuses;
  never falls back to a model-proposed key.
- Parameter space exhausted for a band (e.g. add within 5) → generator deduplicates by
  content hash and returns "no new item"; the loop reuses cache.
- Misconception signature ambiguous between two misconceptions → both recorded as
  candidates; reteach uses the higher prior for the child; test.
- Word-problem phrasing changes a number → post-check extracts numbers and compares; fail.
- Personalised wrapper (child's dog) → generated per child, never cached shared (P0-20 rule).
- A lesson note is missing → build/test fails (exhaustive loader).

## Acceptance criteria

- [x] Every arithmetic skill in the inventory has a generator, params and ≥ 10 golden items;
      the "throws" stub is removed.
- [x] 100% of generated items pass the checker (test generates 500 per skill).
- [x] Every skill has ≥ 3 misconceptions with a matcher test (true positive + true negative).
- [x] Every skill has a lesson note; teacher review recorded — **as `pending`.** See Status.
- [x] Every math skill maps to ≥ 1 SHOW builder; early-band visual RETEACH emits a SHOW (test).
- [x] Word-problem phrasing that alters a number is rejected (test).
- [x] `prewarm-content.ts` fills 40 items per skill per band in a dev DB, idempotently.
- [x] Content golden set extended; the generator half is green. See Status.

## Verification

```bash
npm run test -w @aria/api -- content
npm run test -w @aria/api -- curriculum
npm run golden:content -w @aria/api -- --generator-only
npm run prewarm:content -w @aria/api -- --dry-run
```

`--generator-only` is new here. The 500 model cases still need a configured endpoint, so
running the whole set is blocked behind P2-01 exactly as it was; the 72 cases this ticket
added need no provider and no key, and run today.

Recorded 2026-08-25 on `feat/P2H-10-content-depth`:

```
npm run typecheck                                          0 errors
npm run lint                                               0 errors
npm test                                              1272 passed, 184 files
npm run test -w @aria/api -- content                   136 passed
npm run test -w @aria/api -- curriculum                 73 passed
npm run golden:tutoring -w @aria/api          PASS: 9 tutoring scenario(s)
npm run golden:content -w @aria/api -- --generator-only
                       every check 100% over 72 cases; release FAIL on 72 pending reviews
npm run prewarm:content -w @aria/api -- --dry-run
                       642 items planned, 0 rejected, NUM.CNT.SKIP5 below target in all bands
```

## Status

**Code complete. Two things are left, and neither is code.**

1. **The sixteen lesson notes are unreviewed.** Every skill has one and the loader refuses to
   build an inventory without it, but all sixteen carry `review: pending`. An agent cannot
   approve its own curriculum content. `apps/api/src/curriculum/lessons/REVIEW.md` says what
   approving one involves, and `inventory.lessonReview()` reports the backlog rather than
   hiding it. The notes ground `SAY` and `RETEACH` today either way: unreviewed grounding
   beats a bare skill code, and blocking the tutor loop on a review queue would take the
   product offline.

2. **The 72 new golden cases are unreviewed**, for the same reason and on the same terms as
   P0-21's 500. Every automated check passes at 100%; the set still reports `FAIL` because
   the reviews are pending, which is the gate working.

**Deliberately not built.** No new skills (P3-07 owns that). No reading passages (P4-03). The
model-written word-problem wrapper for the older bands is *gated* but not *wired*:
`acceptWordProblem` proves a wrapper kept every number and rejects it otherwise, and nothing
calls it yet, because generating a story per item costs a model call per item and the bank is
pre-warmed offline. Wiring it is a decision about spend, not a missing check.

**One thing the ticket did not settle.** `NUM.CNT.SKIP5` has fourteen questions in its whole
parameter space, so it cannot reach forty and the pre-warm run says so by name. Counting by
five within fifty genuinely does not have forty distinct questions in it; widening it means
counting past fifty, which is a different skill. Reported rather than padded.

## References

- `master-plan.md` §4.4, §4.5, §6.3
- P0-16, P0-17, P0-20, P0-21
