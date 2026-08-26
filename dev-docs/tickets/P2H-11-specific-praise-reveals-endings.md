# P2H-11 — Specific praise, real reveals, honest endings

| | |
|---|---|
| **Phase** | 2H |
| **Track** | Backend |
| **Depends on** | P2H-03, P2H-04 (P2H-10 lesson notes improve REVEAL; not required) |
| **Blocks** | P2H-14 |
| **Parallel-safe with** | P2H-05 … P2H-10, P2H-12 |
| **Size** | S |

## Why

`turn-fallback.ts` says `Yes. ${answerKey} is right.` for every correct answer, `The answer is
X.` for every reveal, and "You learned and kept trying." for every ending — and these are not
the fallback, they are the *only* text for those moves. `master-plan.md` §4.1: PRAISE is
*specific, not "good job"*; REVEAL *shows the answer with the reasoning*; END *tells them what
they learned*.

## Scope

### Build
Model-generated PRAISE, REVEAL, SWITCH, BREAK and END with the inputs they need; a reviewed
specific fallback set; a rule that no static string reaches a child unless model and cache
both fail, and that this is logged.

### Do not build
No new moves. No engagement inference (P3-05).

## Design

```
apps/api/src/services/content/
  turn-content.service.ts      PRAISE/REVEAL/SWITCH/BREAK/END route to prompts (P2H-03 map)
  move-inputs/
    praise.inputs.ts           what was right, how they got it (latency, attempts, strategy
                               evidence from grader), streak, what they struggled with before
    reveal.inputs.ts           item, key, the child's wrong answers, the misconception if matched,
                               lesson note (P2H-10) or skill name
    switch.inputs.ts           why (attempts, misconception, silence), what comes next (from policy)
    end.inputs.ts              session summary: skills touched, items correct/attempted, one
                               moment worth naming (first correct after a reteach, persistence)
  fallback/
    fallback.data.ts           ≥ 6 reviewed variants per move per band, parameterised
                               ({name}, {skillName}, {answer}); no "good job", no "great work"
    fallback.picker.ts         never the previous one; fills parameters; gated
  turn-fallback.ts             deleted; callers use fallback.picker
apps/api/src/services/session/
  end.service.ts               computes the summary inputs; stores session.summary
observability: fallback_used_total{move,reason} (from P2H-02) must be 0 in a nominal run
```

**Praise rules** (prompt + tests): names the thing ("you lined up the tens first"), or the
behaviour ("you tried a second way"), never the child's intelligence; early band ≤ 1 sentence;
no praise for a revealed answer; after three praises in a row the model is told to vary
intensity ("okay, next one").

**Reveal rules**: state the answer, then one-step reasoning in the band register, then a
bridge to the next item ("let's do one like it"); if a misconception matched, name the idea
plainly without "wrong" ("the pieces have to be the same size").

**End rules**: two to three sentences, past tense, specific, no numbers/percentages
(§14), ends with when we'll continue if known. Early band spoken, ≤ 20 words total.

**Static text policy**: the picker is reached only when generation failed twice *and* the
cache has no verified item; the event carries `content.source: 'fallback'` and the metric
fires. `LayoutContent.tsx` "Take your time." placeholder (UI) is replaced by the silence
ladder output (P2H-01) — the UI shows nothing but the listening indicator when there is no move.

### Edge cases
- Correct answer with low STT confidence → PRAISE prompt told "confirm what you heard first".
- Session ended by `STOP_REQUEST` after one item → END still specific ("you started
  regrouping — that's enough for today").
- Session ended by crisis path → no END prompt; fixed text (P1-13) stands.
- REVEAL when no misconception matched and no lesson note → reasoning from the skill's
  checker trace (P0-16 exposes steps) — deterministic.
- Model praises something the child didn't do (hallucinated strategy) → grounding check:
  praise inputs list allowed claims; a claim outside the list fails the gate (`ungrounded`).
- Two PRAISE in one turn (double answer) → policy allows one.

## Acceptance criteria

- [x] `turn-fallback.ts` no longer exists; every static string lives in
      `services/content/fallback/` with ≥ 6 band variants per move — exhaustive over `MoveKind`
      by type — and a review record in `fallback/REVIEW.md`. **The record says `pending`:** the
      wording is drafted and machine-checked, and no person has signed it off.
- [x] A nominal 20-turn scripted session with the model available produces
      `fallback_used_total == 0` (`nominal-session.test.ts`).
- [x] PRAISE fixtures: `__fixtures__/praise.fixtures.ts` — ten cases, three of them the banned
      phrases, three of them invented strategies. The grounding list is the grader's own
      `strategies`, so the praise can only name what the item proved.
- [x] REVEAL includes the answer and at least one reasoning sentence; when a misconception
      matched, the reveal names the idea (`__fixtures__/reveal.fixtures.ts`, five cases).
- [x] END summary is stored in `session.summary`, is ≤ 3 sentences and contains no digits or
      percentages (`recap.test.ts`).
- [x] Ungrounded praise claim → gate failure → regeneration
      (`nominal-session.test.ts`, both the recovery and the give-up path).
- [x] The UI shows no placeholder sentence when `currentMove` is null
      (`LayoutContent.test.tsx`).

## Status

**Code complete 2026-08-25** on `feat/P2H-11-specific-praise`.

Recorded numbers: `npm run typecheck` 0 errors, `npm run lint` 0 errors, `npm test` 1411 tests
across 191 files pass, `npm run golden:tutoring -w @aria/api` "PASS: 9 tutoring scenario(s)",
no source file over 300 lines.

Left open, and not fixable in code:

- **The 360 fallback sentences are unreviewed.** `fallback/REVIEW.md` records every set as
  `pending`. Machine checks prove the count, the gate, the digit rule and the banned phrases;
  they cannot prove a child hears warmth. This is the same bar P2H-09's seed lines and
  P2H-10's lesson notes are waiting on.
- **Strategy evidence is thinner than the ticket assumes.** The grader is deterministic — an
  arithmetic checker or an exact match — so it can vouch for a *method the item requires*
  (`ADD.REGROUP.2D` cannot be answered right without regrouping) and for the shape of the
  attempt (how long, how many tries, whether the child said more than the answer). It cannot
  see a strategy. `ADD.FACT.10` therefore vouches for nothing at all, and praise on that skill
  names what was right rather than how. That is the honest reading of "strategy evidence from
  grader" with today's grader; a model grader (P4-06) would widen it.
- **END allows no strategy claims.** The recap carries skills and counts, not methods, so an
  ending names what was worked on and the one moment worth naming. Widening this needs the
  recap to carry per-answer strategies, which is a `session_event.evidence` change.

## What the review pass changed

Nothing yet — the two-axis review runs after this commit.

## Verification

```bash
npx vitest run --project api --project api-db src/services/content test/   # 247 passed
npx vitest run --project api src/services/session                          # 10 passed
npx vitest run --project web LayoutContent                                 # 2 passed
npm run golden:tutoring -w @aria/api                                       # PASS: 9 scenarios
```

The workspace-filtered forms in the original ticket (`npm run test -w @aria/api -- content`)
select by workspace, and this repo's Vitest projects are configured at the root, so the
project-filtered forms above are what actually run.

## References

- `master-plan.md` §4.1 (moves), §5, §14
- P2H-02 (metrics), P2H-03 (prompts)
