# P4-02 — The decodable-text filter

| | |
|---|---|
| **Phase** | 4 |
| **Track** | Backend |
| **Depends on** | P4-01 |
| **Blocks** | P4-03 |
| **Parallel-safe with** | P4-04, P4-05, P4-07 |
| **Size** | M |

## Why

`master-plan.md` §6.1: "A model will break this rule constantly unless we enforce it in code.
So we do." The bar in §11 is **100%**: no passage reaches a child with a word outside this
child's taught patterns. It is a deterministic gate, a fifth check alongside the four in
P0-18, and it runs only on `passage` content for `read_aloud` purposes.

## Scope

### Build
A pure function `checkDecodable(passage, taughtSet) → DecodableVerdict` and its wiring as a
quality-gate check; a grapheme–phoneme decomposer for the initial pattern inventory; fixtures.

### Do not build
No generation (P4-03). No model calls anywhere in this ticket. No extension of the pattern
inventory beyond P4-01.

## Design

```
apps/api/src/quality/checks/decodable.check.ts     the gate check; ~60 lines; calls the filter
apps/api/src/quality/decodable/
  decompose.ts        word -> ordered grapheme units using the pattern inventory (longest
                      match first: 'sh' before 's'; 'igh' before 'i'); returns null when the
                      word cannot be fully segmented
  classify-word.ts    grapheme units -> the single pattern code the word requires (the
                      highest-rung unit wins: "shake" needs CVCE even though 'sh' is DIGRAPH)
  verdict.ts          DecodableVerdict = { ok: true } | { ok: false, offending: Array<{ word,
                      requiredPattern | 'UNSEGMENTABLE', position }> }
  normalize.ts        lowercase; strip punctuation; keep apostrophes ("can't" is its own
                      unit); split hyphens; proper nouns detected by capital in mid-sentence
                      and rejected unless in sightWords
  index.ts
apps/api/src/quality/decodable/__fixtures__/
  cvc-only.json, cvce-mixed.json, sight-words.json, proper-nouns.json, contractions.json
```

Interface:
```ts
checkDecodable(input: { text: string; taught: TaughtPatterns }): DecodableVerdict
// TaughtPatterns = ReturnType<typeof taughtPatternsFor>
```

Wiring: `quality/gate.ts` runs `decodable.check` when
`content.type === 'passage' && purpose === 'read_aloud'`; a `LISTEN` with `read_aloud` and no
verdict recorded is a gate failure, not a pass (fail closed).

### Edge cases
- Empty taught set → only sight words pass; a passage of sight words is valid.
- Word appears in both sightWords and a taught pattern → passes.
- Unsegmentable word (e.g. "yacht") → `UNSEGMENTABLE`, fails.
- Numerals ("3") → fail unless the number word is decodable; the generator must spell them.
- Names: "Sam" (CVC) passes decoding; "Rocky" (from learner facts, P5-02) fails unless every
  unit is taught — the filter does **not** know about interests, and must not.
- Contractions: "can't" → units of "can" + apostrophe-t; allowed only when
  `CONTRACTION` pattern is taught.
- Plural/-ed/-ing endings: require `INFLECT_S` / `INFLECT_ED` / `INFLECT_ING`.
- Repeated word failing → reported once per distinct word, with every position.
- Passage > 4000 chars → structural check rejects before this runs.
- Mixed case / smart quotes / non-ASCII apostrophes normalised first.
- Performance: a 200-word passage must check in < 5 ms; no regex backtracking.

## Acceptance criteria

- [ ] 100% of fixture passages classify correctly (no false pass, no false fail); the
      fixture set has ≥ 200 words across every rung and every edge case above.
- [ ] A passage containing one word outside the taught set fails and names the word, the
      position and the pattern it needs.
- [ ] The check is registered in the gate for `passage`/`read_aloud` and a `LISTEN read_aloud`
      without a decodable verdict fails closed — proven by test.
- [ ] The check makes zero I/O and zero model calls (asserted by a fake-free unit test).
- [ ] `decompose` prefers longest grapheme match, proven by "ship" ≠ s-h-i-p.
- [ ] p99 check time for a 200-word passage < 5 ms in the test run.

## Verification

```bash
npm run test -w @aria/api -- decodable
npm run golden:content -w @aria/api -- --kind passage
```

## References

- `master-plan.md` §4.5 (check 3, hard filter), §6.1, §11 (100% bar)
- P0-18 gate structure
