# P4-03 — Decodable passage generation and the reviewed bank

| | |
|---|---|
| **Phase** | 4 |
| **Track** | Backend |
| **Depends on** | P4-02, P0-20 |
| **Blocks** | P4-04, P4-08 |
| **Parallel-safe with** | P4-05, P4-06, P4-07 |
| **Size** | M |

## Why

A child at rung 3 needs sentences built only from the sounds they own, and the tutor needs a
fresh one every day. The filter (P4-02) says no; something has to say yes. Generation runs
through the full gate, is cached by the taught-pattern set so every child at the same rung
shares the same verified passages (`master-plan.md` §4.5), and a reviewed seed bank means a
child never waits on a model to read.

## Scope

### Build
`generatePassage(taught, target)`, the reviewed seed bank, cache keys, and the LISTEN move
assembly (`purpose: 'read_aloud'`, `passage` content).

### Do not build
No assessment (P4-04). No personalised passages with the child's interests — that is P5-02,
and it must still pass this ticket's filter.

## Design

```
apps/api/src/services/reading/
  passage.service.ts        resolvePassage(studentId, targetPatternCode) ->
                            cache -> bank -> generate(gate x2) -> bank fallback
  passage-key.ts            cacheKey = sha256(sorted taught codes + sightWord rung + target
                            + band + length bucket)
  passage-prompt.ts         builds the prompt: allowed graphemes, allowed sight words, target
                            pattern to feature ≥ 3 times, length by band (early: 12–30 words,
                            middle: 40–80), no names, no numerals, spelled-out numbers only
  passage-bank.ts           reads reviewed passages from content_item where kind='passage'
                            and verified_at IS NOT NULL, indexed by their pattern set
apps/api/src/ai/prompts/definitions/passage.ts        registered in registry.ts
apps/api/src/curriculum/reading/passage-bank.data.ts  ≥ 5 reviewed passages per pattern
                            for rungs 1–4 (≈ 120 passages), each with its required pattern
                            set recorded, human reviewed before merge
```

Flow:
1. `taughtPatternsFor` → key.
2. `content_item` cache hit with `verified_at` → return.
3. Bank passage whose required set ⊆ taught set and features the target → return.
4. Generate → P0-18 gate (structural, level, safety) **and** P4-02 decodable → on fail
   regenerate once with the offending words listed → on fail use best bank passage.
5. Store verified generations in `content_item` (`kind='passage'`, `body`, `metadata.patternSet`).

Move shape produced: `LISTEN { purpose: 'read_aloud', skillId, content: { type: 'passage',
body, title? } }` — `vocabularyHint` is forbidden by schema and must not be set.

### Edge cases
- Taught set empty → no generation; return the rung-0 bank passage (sight words only) or, if
  none, a `SAY` explaining Aria will teach a sound first (policy handles).
- Target pattern not in taught set → reject request (programming error; log, do not generate).
- Model returns numerals, names, or Markdown → fails structural/decodable; regenerate once.
- Generated passage identical to last 3 passages this child read → treat as miss, regenerate.
- Provider outage → bank; if bank empty for this set, widen to the largest subset with a bank
  passage; never a non-decodable passage.
- Cache row later marked unverified (review revoked) → excluded by `verified_at IS NULL`.
- Two children at the same rung → same cache row, `times_used` increments.
- Passage length exceeds band bucket → level check fails.

## Acceptance criteria

- [ ] Every passage returned has a passing P4-02 verdict recorded in the gate log — asserted
      by a test counting decodable-check invocations per returned passage (≥ 1).
- [ ] Cache key is stable across taught-set orderings and differs across sets.
- [ ] Bank has ≥ 5 reviewed passages per pattern for rungs 1–4 and every one passes the filter
      against its own declared set (test iterates the bank).
- [ ] With every model disabled, `resolvePassage` still returns a decodable passage for every
      taught set reachable from the bank.
- [ ] Regenerate-once includes the offending words in the retry prompt (snapshot test).
- [ ] The produced `LISTEN` move validates against `listenMoveSchema` and carries no
      `vocabularyHint`.

## Verification

```bash
npm run test -w @aria/api -- passage
npm run golden:content -w @aria/api -- --kind passage
```

## References

- `master-plan.md` §4.5 (cache and reuse), §6.1
- P0-20 (cache), P4-02 (filter)
