# P0-18 — The quality gate

| | |
|---|---|
| **Phase** | 0 — Foundation |
| **Track** | Backend |
| **Depends on** | P0-14, P0-16, P0-17 |
| **Blocks** | P0-19, P0-20, P0-21, P1-07 |
| **Parallel-safe with** | P0-15, P0-22, P0-23 |
| **Size** | L |

## Why

"It is never wrong about the subject" is one of the three things that must be true. Every
piece of content a child sees — a problem, an explanation, a story, a passage — passes
through the same gate before it reaches the screen. There is no fast path and no exception.

## Scope

### Build
The four checks, in order, as separate composable modules, plus the gate orchestrator, the
regenerate-once policy and the verified-fallback path.

### Do not build
- No content generation prompts beyond what P0-14 already registered.
- No cache. P0-20 consumes this gate.

## Design

```
apps/api/src/quality/
  gate.ts                 the orchestrator. Runs checks in order, short-circuits on failure.
  gate.types.ts           GateInput, GateVerdict = pass | fail(reason[]), CheckResult
  checks/
    structural.check.ts   options separate, exactly one correct, key names a real option,
                          no HTML/markup, no leaked "(Correct)" marker
    correctness.check.ts  arithmetic -> P0-16, deterministically. Other factual content ->
                          grounded in an approved source or dropped.
    level.check.ts        band word list + sentence-length limit
    safety.check.ts       classifier pass, every item, no exceptions
  wordlists/
    early.data.ts  middle.data.ts  senior.data.ts
  report/
    gate-report.ts        structured failure reasons for the golden-set harness
```

The four checks, in order — **any failure sends the item back or drops it**
(`master-plan.md` §4.5):

1. **Structural.** Deterministic, built fresh. The legacy sanitizer's recorded defects are
   regression fixtures, not a design to copy (`rewrite.md` §3).
2. **Correct.** For arithmetic, P0-16 solves it independently — **no model involved**. Other
   factual content is grounded in an approved curriculum source or reviewed content bank
   where possible. A second model may *flag* a problem, but **agreement between two models is
   not proof**; unsupported generated facts are dropped. We would rather show four good
   questions than five with one wrong.
3. **Right level.** Words checked against the band's word list, sentences against the band's
   length limit. A Grade 1 item with a three-clause sentence fails.
4. **Safe.** Classifier pass. No violence, no adult content, no frightening material, no
   request for personal information, nothing that would upset a six-year-old.

Policy (`master-plan.md` §4.1 step 4): cache first → generate → gate → **on failure,
regenerate once** → on second failure, use verified fallback content and record the failure.
Never show a child a third attempt's output unchecked.

The gate is a pure function of its input plus injected checkers. It is called from the
content path, never from a controller.

## Acceptance criteria

- [ ] All four checks run in order and short-circuit; the verdict names every failed check.
- [ ] An arithmetic item with a wrong answer key is rejected 100% of the time, by code.
- [ ] An `undecidable` arithmetic verdict is a gate **failure**, not a pass.
- [ ] Markup, duplicated options, two correct options, a key naming no option, and a leaked
      "(Correct)" marker are each rejected, with a regression fixture for each legacy defect
      class.
- [ ] A Grade 1 item using senior vocabulary or a three-clause sentence fails the level check.
- [ ] Every item passes the safety check; there is no code path that skips it, proven by a
      test that asserts the call count.
- [ ] Regenerate-once then verified-fallback is implemented and tested, including that the
      failure is recorded.
- [ ] Two models agreeing does not mark an unsupported fact as correct — proven by a test.
- [ ] Failure reasons are structured data the P0-21 harness can aggregate.

## Verification

```bash
npm run test -w @aria/api -- quality
```

## References

- `master-plan.md` §4.5, §11 (content quality bars)
- `rewrite.md` §3
