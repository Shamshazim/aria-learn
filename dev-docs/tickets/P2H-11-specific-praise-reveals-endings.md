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

**The worst thing either axis found: a static string reached a child unlogged.** When the gate
refuses a sentence mid-stream, `gated-stream.ts` closes the turn with the reviewed fallback
text. `turn-stream.ts` then saw sentences in the buffer and reported `generated`, so the turn
recorded `responseSource: 'model'` and `fallback_used_total` never moved — after *one* failed
attempt, not two, and with nothing in the record to say it happened. The released segment now
carries `substituted`, the turn counts it, and the evidence says
`model-with-fallback-tail`. `turn-stream.test.ts` covers it; the 20-turn bar could not, because
that bar only walks the buffered path.

**The picker could repeat itself.** It remembered the *index* it chose, and the eligible list
changes shape between turns — a variant naming the answer key drops out of a turn with no
answer key. Two turns running could land on the same words; the reviewer found seven reachable
repeats in the shipped data. It now remembers the sentence.

Also from the two reports:

- Every strategy claim id is now a type derived from the vocabulary, so a typo in the skill
  table cannot compile. `strategy-evidence.test.ts` checks the table against the inventory.
- `praise.inputs.ts` stopped over-claiming three ways: `tried-another-way` is gone entirely
  (Aria changing approach is Aria's second way, not the child's), `used-the-picture` needs a
  `SHOW` still on screen rather than one from any point in the session, and
  `explained-your-thinking` needs a word that introduces a method rather than a longer answer.
- Early-band endings are capped at twenty words, which §14's "Early band spoken, ≤ 20 words"
  asked for and the sentence cap did not enforce.
- REVEAL gets the structured problem and what the child actually put. The spec's "reasoning
  from the skill's checker trace (P0-16 exposes steps)" is **not** implemented as written:
  P0-16 returns a verdict, an expected answer and a one-line reason ("Exact integer addition
  matches"), not steps. Extending it belongs to P0-16.
- PRAISE is told to confirm what it heard when the transcript confidence is below 0.9.
- The prompt no longer promises to say when we will continue: nothing supplies a next session
  time, so the clause could never have fired.
- `@/quality` now exports the vocabulary, `sentencesOf` and `registerFailures`, so nothing
  reaches past the barrel — including the one call site that already did before this ticket.
- The web test builds a whole `TutorSession` from a fixture instead of three
  `as unknown as` casts.
- `move-inputs/select.ts` is a `Record<MoveKind, builder>` rather than a chain of `if`s.

Declined, with reasons:

- **The six SAY-approach fallback sets are not scope creep.** `turn-fallback.ts` already had
  approach-specific text for them, and the criterion is that *every* static string moves. A
  confirm-what-I-heard and a still-there-check are different acts; one set of six could not
  do both.
- **`recap-text.ts`'s four summary sentences stay where they are.** They are written to
  `session.summary` for the grown-ups who read a session back, and are never spoken, so they do
  not belong in the child-facing fallback data. `fallback/REVIEW.md` lists them anyway, because
  a reviewer looking for "everything Aria says from a script" should not have to know that.

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
