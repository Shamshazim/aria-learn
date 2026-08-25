# P2H-02 — Readability gate replaces the vocabulary whitelist

| | |
|---|---|
| **Phase** | 2H |
| **Track** | Backend |
| **Depends on** | — (P0-18, P0-21, P1-14 on `main`) |
| **Blocks** | P2H-03, P2H-11, P2H-13 |
| **Parallel-safe with** | P2H-01, P2H-05, P2H-08, P2H-10, P2H-12 |
| **Size** | M |

## Why

`apps/api/src/quality/checks/level.check.ts` fails any word not in a ~117 / 141 / 154-word list.
"Let's", "I'm", "wow", "nice", "Aria", every child's name and every number word fail. Because
`turn-content.service.ts` swallows the failure and substitutes static text, the child hears
"Let us try a different step" and nobody sees why. The plan's level check (§4.5 check 3) is
"word list **and** sentence length" for *items*; for dialogue the whitelist is wrong in kind.
Decodable reading text keeps a hard word filter — that is Phase 4's gate, not this one.

## Scope

### Build
A readability-based level check for dialogue and items, an explicit allowlist policy for
contractions, names and interjections, gate-rejection logging and metrics, and a fallback-use
alert. Re-run the content golden set.

### Do not build
No change to the structural, correctness or safety checks. No decodable-text filter (P4-02).
No prompt changes (P2H-03).

## Design

```
apps/api/src/quality/
  checks/level.check.ts             orchestrates: sentence length + readability + banned list
  checks/level/readability.ts       syllables/word, words/sentence, band score
  checks/level/syllables.ts         deterministic English syllable counter + exceptions table
  checks/level/allowlist.ts         contractions, interjections, 'Aria', numbers, band names
  checks/level/banned.data.ts       words never spoken to a child regardless of score
  checks/level/level.thresholds.ts  per-band thresholds (below)
  wordlists/                        kept; used only by P4-02 and by `kind: 'decodable'` input
  gate.types.ts                     GateInput.kind gains 'dialogue' | 'item' | 'decodable'
  gate-log.ts                       every rejection -> structured log + metric
apps/api/src/observability/
  metrics.ts                        gate_rejections_total{check,code,band,move}, fallback_used_total{move,reason}
  alerts.md                         fallback_used_total > 2% of moves over 15 min pages
apps/api/src/services/content/
  turn-content.service.ts           passes kind, records fallback reason, never silent
```

**Thresholds** (`level.thresholds.ts`, tuned against the P0-21 golden set, recorded in PR):

| Band | Max words/sentence | Max mean syllables/word | Max 3+-syllable words per 100 | Score |
|---|---|---|---|---|
| early | 12 | 1.35 | 4 | Spache ≤ 2.5 |
| middle | 20 | 1.55 | 10 | Flesch-Kincaid ≤ 5.5 |
| senior | 30 | 1.80 | 20 | Flesch-Kincaid ≤ 8.5 |

The score is computed on `childFacingText(input)` with the child's first name, "Aria" and
numerals removed first (they distort syllable counts). A single sentence over the word limit
still fails (`sentence_too_long`, kept). `vocabulary` becomes `readability` with the metric
values in the message so a rejection is actionable.

**Allowlist policy** (`allowlist.ts`): standard contractions (`let's, I'm, you're, it's,
that's, don't, can't, we'll, …`), interjections (`wow, hmm, oh, okay, yes, yay, nice`), the
literal `Aria`, the child's first name when present in context, cardinal/ordinal numbers, and
subject words the skill inventory names (from `packages/shared/src/curriculum`). These are
exempt from syllable counting, not from the banned list.

**Logging** (`gate-log.ts`): `{ check, code, band, moveKind, textHash, metrics, attempt }` at
`warn`; the text itself only at `debug` (it is child-facing content, never child input).
`turn-content.service.ts` gains `reason: 'gate' | 'provider' | 'ai_unavailable'` on the
fallback path and calls `recordFallback(reason)`. **No path substitutes text without a log
line and a metric.**

### Edge cases
- Empty text or only punctuation → structural check fails first; level returns `passed`.
- Text with a single long proper noun ("Tyrannosaurus") → exempt only if it is the child's
  name or in the skill vocabulary; otherwise counted (early band will fail — correct).
- Hyphenated and apostrophe words split correctly ("ten-frame" = two tokens, "let's" = one).
- Numbers spoken as digits ("12") are ignored; number words ("twelve") count normally.
- `kind: 'decodable'` bypasses this check and requires the P4-02 filter; until P4-02 lands the
  gate rejects `decodable` input with `code: 'decodable_filter_missing'` (never passes).
- Mixed band content (a senior explanation reused for middle) is re-gated for the target band;
  cache keys already include band (P0-20).
- Syllable counter unknown word → estimate from vowel groups; exceptions table covers the
  common silent-e and `-le` cases; test corpus of 300 words with known counts, ≥ 97% exact.

## Acceptance criteria

- [ ] "Let's try it together, Sam! You've got this." passes early band; a 15-word sentence fails.
- [ ] A three-clause Grade 1 sentence still fails (`sentence_too_long`).
- [ ] The P0-21 content golden set level-check pass rate is ≥ 98% and no previously-failing
      wrong-level item now passes (regression list in the PR).
- [ ] Every gate rejection emits one structured log and increments `gate_rejections_total`.
- [ ] Every fallback substitution increments `fallback_used_total{reason}`; a test asserts
      that a gate failure, a provider error and `ai === null` each produce a distinct reason.
- [ ] Alert rule documented in `observability/alerts.md`.
- [ ] `kind: 'decodable'` cannot pass through this check.
- [ ] Syllable counter ≥ 97% exact on the fixture corpus.
- [ ] Old wordlists are not imported anywhere except `decodable` paths (lint rule).

## Verification

```bash
npm run test -w @aria/api -- quality
npm run golden:content -w @aria/api
```

## References

- `master-plan.md` §4.5 check 3, §11 "Reading level within band ≥ 98%"
- `cloud-model-layer.md` §9 (gate)
- P0-18, P0-21, P1-14
