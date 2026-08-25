# P4-06 — Comprehension: retell, predict, infer

| | |
|---|---|
| **Phase** | 4 |
| **Track** | Backend |
| **Depends on** | P4-04 |
| **Blocks** | P4-09 |
| **Parallel-safe with** | P4-05, P4-07, P4-08 |
| **Size** | M |

## Why

Rung 6. `master-plan.md` §6.1: multiple choice about a passage "measures reading comprehension
only after fluency exists — it is a Grade 3+ tool, and today we use it at every age, which is
wrong." Comprehension here is spoken or written retelling, prediction and inference, graded
by a rubric with deterministic checks first and a FAST model second — and it is offered
only once fluency evidence exists.

## Scope

### Build
Three activity kinds (`cmp_retell`, `cmp_predict`, `cmp_infer`) over a passage the child has
just read (or Aria has read to them); rubric grading; gating on fluency; skill-state updates
for CMP.*.

### Do not build
No multiple-choice comprehension for any band. No essay grading (writing is P4-07). No
passages outside the decodable/reviewed banks for children below FL.WCPM.60.

## Design

```
apps/api/src/services/reading/
  comprehension.service.ts    picks activity by skill due; builds SAY/ASK/LISTEN sequence;
                              LISTEN { purpose: 'explain' } for spoken, workpad for senior
  comprehension-eligibility.ts eligible iff band >= middle AND (FL.WCPM.60 strength >= 0.6
                              OR passage was read *to* the child by Aria) — listening
                              comprehension is allowed earlier, reading comprehension is not
  rubric/
    retell.rubric.ts          deterministic: mentions ≥ N of the passage's key entities/events
                              (extracted at bank-review time, stored in content_item.metadata)
    predict.rubric.ts         deterministic: prediction references a passage element; plausible
                              is judged by the FAST model with the rubric text, returning a
                              0–2 score and one sentence of reason
    infer.rubric.ts           same shape; the inference must cite a clue from the passage
  grade-comprehension.ts      combines: deterministic floor first; model may raise, never
                              lower below the deterministic floor; model unavailable -> floor
apps/api/src/ai/prompts/definitions/grade-comprehension.ts
apps/api/src/curriculum/reading/comprehension-bank.data.ts   ≥ 40 middle/senior passages with
                              reviewed key-element lists and sample answers at 0/1/2
```

Moves:
- score 2 → `PRAISE` naming the specific thing they noticed.
- score 1 → `HINT`: "You told me what happened first. What happened at the end?"
- score 0 → `RETEACH`: Aria retells the first half and asks for the second; never `REVEAL`
  a retelling wholesale.
- After the second 0 on the same skill → `SWITCH`.

### Edge cases
- Early band → never eligible for reading comprehension; listening `cmp_retell` only, spoken.
- Child retells in their own words with synonyms → entity matching uses reviewed synonym
  lists per passage, not exact strings.
- Child answers in one word → score by rubric (likely 0/1); HINT asks for more, once.
- Very long spoken answer (> 60 s) → endpointing (P2-05) closes the turn; grade what was said.
- Model returns a score outside 0–2 or non-JSON → floor score used; logged.
- Child retells a *different* story (off-task) → intent classifier (P2H-05) marks OFF_TOPIC;
  one redirect, not a grade.
- Prediction "I don't know" → CONFUSED path: Aria models one prediction, asks for a second.
- Senior band written answer with profanity → safety classifier first (P1-13); no grade.
- Skill-state update for CMP.* is deterministic-floor-based when the model was unavailable
  and is marked with lower evidence confidence.

## Acceptance criteria

- [ ] No comprehension activity is ever produced as `choices` content — schema-level test.
- [ ] Eligibility refuses reading comprehension for a child without fluency evidence and
      allows listening comprehension — tests.
- [ ] The model can raise but never lower a deterministic score — property test.
- [ ] With the model disabled every activity still grades and produces a valid next move.
- [ ] A 0 twice on the same skill produces `SWITCH` — policy test.
- [ ] Bank passages carry reviewed key-element and synonym lists; the review is in the PR.
- [ ] Skill state for CMP.* changes only through `update-state.ts`.

## Verification

```bash
npm run test -w @aria/api -- comprehension
npm run golden:tutoring -w @aria/api -- --scenario retell
```

## References

- `master-plan.md` §5 (middle/senior), §6.1 rung 6, §11 (non-math correctness bar)
- P4-04 (fluency evidence), P2H-05 (intent)
