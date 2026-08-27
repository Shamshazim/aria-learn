# P3-07 — Curriculum expansion: the full TK–8 arithmetic inventory

| | |
|---|---|
| **Phase** | 3 |
| **Track** | Backend + Content |
| **Depends on** | P2H-10, P3-04 |
| **Blocks** | P3-08, P7-01 |
| **Parallel-safe with** | P3-01, P3-02, P3-03, P3-05, P3-06 |
| **Size** | L |

## Why

P0-17 defined a bounded inventory (18 skills) so the golden sets had something to measure.
A scheduler with prerequisites (P3-04) is only as good as the graph it walks, and a Grade 6
child currently runs out of arithmetic in one session. `master-plan.md` §13 Phase 0 sets the
rule this ticket lives by: "Adding a later arithmetic skill requires its checker and golden
cases before release." §6.3: number sense, facts to automaticity, procedures — taught
differently, and "every arithmetic fact a child sees is verified by code, not by a model."

## Scope

### Build
The complete arithmetic skill graph TK–8 as authored data, a deterministic checker for
every skill, ≥3 misconceptions per skill with signatures, a lesson note per skill, an item
generator recipe per skill, and golden cases per skill. Ship in strands, each strand its own
PR against this ticket.

### Do not build
No reading or writing skills (Phase 4). No model-generated *facts*; generation is of items
whose answers the checker proves. No UI.

## Design

```
apps/api/src/curriculum/inventory/arithmetic/
  num-sense.skills.ts        NUM.*    counting, place value, comparing, rounding, estimation
  add-sub.skills.ts          ADD.* SUB.*  facts, regrouping, multi-digit, mental strategies
  mul-div.skills.ts          MUL.* DIV.*  facts, arrays, long multiplication, long division, remainders
  fractions.skills.ts        FRAC.*   equal parts, compare, equivalent, add/sub like & unlike, × ÷
  decimals-percent.skills.ts DEC.* PCT.*  place value, operations, conversion, percent of
  integers.skills.ts         INT.*    negatives, number line, operations (6–8)
  ratio-prop.skills.ts       RAT.*    ratio, rate, proportion, unit rate (6–8)
  expressions.skills.ts      EXP.* EQN.*  order of operations, variables, one/two-step equations (6–8)
  measurement-data.skills.ts MEAS.* DATA.*  time, money, length, area/perimeter, mean/median
  index.ts                   assembles; validate.ts enforces acyclic prerequisites
apps/api/src/curriculum/lessons/<CODE>.md     teaching note: the idea, the model/manipulative,
                                              the worked example, common wrong ideas
apps/api/src/curriculum/misconceptions/<strand>.misconceptions.ts
apps/api/src/quality/checkers/arithmetic/<strand>/*.ts   one checker per skill family
apps/api/src/content/generators/arithmetic/<strand>/*.ts  recipe: parameters -> item; answer from checker
dev-docs/golden/content/items/arithmetic/<strand>/*.json   ≥5 human-graded items per skill
```

Rules:
- **A skill without a checker cannot be registered.** `validate.ts` cross-checks the
  inventory against the checker registry at startup and fails the boot.
- **A skill without ≥5 golden cases cannot ship**: `golden:content` reports coverage per
  skill; CI fails on any skill below 5.
- Checkers are exact: rational arithmetic for fractions/decimals (no floating point
  equality), integer division with remainder, equation solving by substitution check, unit
  conversion by table. Where a checker cannot prove (e.g. estimation "about 300"), it
  returns `defer` with an accepted range authored on the item — never `true`.
- Three teaching modes are declared per skill (`mode: 'number_sense'|'fact'|'procedure'`)
  and drive the P3-04 plan: `fact` skills get timed retrieval with the band's automaticity
  bar (2 s); `number_sense` skills never get drill; `procedure` skills are worked one step
  at a time and the generator emits multi-step items with a `steps[]` answer key so Aria
  never reveals the whole answer.
- Prerequisites are authored, not inferred; each strand file cites the standard it follows
  in a comment (Common Core code) so a reviewer can check the ladder.
- Misconception signatures are deterministic matchers on the child's answer
  (`curriculum/misconception.matcher.ts` pattern), e.g. `FRAC.COMPARE` "bigger denominator
  means bigger": chose the option with the larger denominator when numerators are equal.

### Edge cases
- Answer formats: "1/2", "0.5", "one half", "½", " 1 / 2 " are equal for fraction skills;
  "3 r 2", "3 R2", "3 remainder 2" for division; "$1.50", "1.50", "150 cents" for money —
  a `normalise-answer.ts` per family with tests.
- Spoken answers (Phase 2): "eleven" vs "11", "twenty one" vs "21", "a half" — the same
  normaliser, fed by `spokenForm()`'s inverse table.
- Negative zero, leading zeros, trailing decimal zeros: equal.
- Item generator produces a duplicate of a cached item: dedupe by normalised body hash.
- Generator parameter space exhausted (e.g. addition facts within 5): recipe declares
  `finite: true` and the cache serves; never a model call.
- Order-of-operations items must never contain ambiguous `÷` chains; the recipe emits
  parentheses where the standard would.
- Word-problem items: the model may write the *story* around a generator-fixed computation;
  the checker verifies the computation and the structural gate verifies the numbers in the
  story match the parameters (no "5 apples" when the sum uses 6).

## Acceptance criteria

- [ ] Every skill in the inventory has: a checker, ≥3 misconceptions, a lesson note, a
      generator recipe and ≥5 golden cases — enforced by `validate.ts` and `golden:content`.
- [ ] Prerequisite graph is acyclic and every skill above TK has ≥1 prerequisite; entry
      skills are listed explicitly.
- [ ] Checker property tests: 10,000 random items per family, answer from checker equals an
      independent BigInt/rational reference.
- [ ] Normaliser tests cover every format in the edge-case list.
- [ ] `golden:content` arithmetic correctness stays 100%; reading level ≥98%.
- [ ] A `procedure` item never resolves to a REVEAL of the final answer before all steps are
      attempted (tutoring golden scenario "long division").
- [ ] Startup fails with a named skill when a checker is missing (test).
- [ ] No file over 300 lines; strands are separate files.

## Verification

```bash
npm run test -w @aria/api -- curriculum quality/checkers content/generators
npm run golden:content -w @aria/api -- --subject arithmetic
npm run golden:tutoring -w @aria/api -- --scenario long-division
```

## References

- `master-plan.md` §4.4, §4.5, §6.3, §11 (content bars), §13 Phase 0 rule
- `P0-16-arithmetic-checker.md`, `P0-17-initial-skill-inventory.md`, `P0-21-content-golden-set.md`, `P2H-10`
