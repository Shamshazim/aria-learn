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

- [ ] `turn-fallback.ts` no longer exists; every static string lives in `fallback.data.ts`
      with ≥ 6 band variants and a human review recorded.
- [ ] A nominal 20-turn scripted session with the model available produces
      `fallback_used_total == 0`.
- [ ] PRAISE fixtures: output never contains "good job", "great job", "smart"; contains a
      reference to the grader's strategy evidence (grounding test).
- [ ] REVEAL includes the answer and at least one reasoning sentence; when a misconception
      matched, the reveal names the idea (fixture).
- [ ] END summary is stored in `session.summary`, is ≤ 3 sentences and contains no digits
      or percentages (test).
- [ ] Ungrounded praise claim → gate failure → regeneration (test with a fake model).
- [ ] The UI shows no placeholder sentence when `currentMove` is null.

## Verification

```bash
npm run test -w @aria/api -- content
npm run test -w @aria/api -- session
npm run test -w @aria/web -- LayoutContent
npm run golden:tutoring -w @aria/api
```

## References

- `master-plan.md` §4.1 (moves), §5, §14
- P2H-02 (metrics), P2H-03 (prompts)
