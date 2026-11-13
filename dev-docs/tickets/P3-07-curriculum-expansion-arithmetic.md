# P3-07 — Curriculum expansion: the full TK–8 arithmetic inventory

| | |
|---|---|
| **Phase** | 3 |
| **Track** | Backend + Content |
| **Depends on** | P2H-10, P3-04 |
| **Blocks** | P3-08, P7-01 |
| **Parallel-safe with** | P3-01, P3-02, P3-03, P3-05, P3-06 |
| **Size** | L |

## Status

**Strand 1 of 9 (number sense) and the shared infrastructure: code complete 2026-11-12** on
`feat/P3-07-arithmetic-number-sense`, pending review. Stacked on P3-02 (#38) ← P3-03 (#37) ←
P3-06 (#36) ← P3-05 (#35) ← P3-04 (#34) ← P3-01 (#33). The other eight strands are each their
own PR against this ticket, as Scope asks.

- **Infrastructure, for every later strand.** The inventory is split into
  `inventory/arithmetic/{num-sense,add-sub,fractions}.skills.ts` with `index.ts` assembling,
  each citing its Common Core codes. `Skill.mode` (`number_sense | fact | procedure`) is set
  on every arithmetic skill, and the P3-04 scheduler graph now reads `facts` from it (the
  `.FACT.` code pattern remains only for skills with no mode). `validate.ts` fails the boot,
  naming the skill, when an arithmetic skill has no checker, no mode, or no prerequisites
  while not a listed entry skill (`ARITHMETIC_ENTRY_SKILLS` = `NUM.CNT.20`). `golden:content`
  exits non-zero for any arithmetic skill with fewer than 5 golden cases, and a unit test
  holds the checked-in set to the same rule so CI catches it with no model configured.
- **Number sense: four new skills.** `NUM.PV.TENS` (1.NBT.B.2), `NUM.PV.HUNDREDS`
  (2.NBT.A.1), `NUM.CMP.100` (1.NBT.B.3), `NUM.RND.10` (3.NBT.A.1). Each has a checker
  (place value reuses P0-16's; whole comparison and rounding are new and exact on `bigint`),
  a parameter space, band-varied phrasing, 3 misconceptions with derived signatures, a lesson
  note (`review: pending`), a reviewed fallback item and 10 generator-origin golden cases
  (`generated-number-sense.json`, `humanReview: pending`). All four are `number_sense`.
- **Normaliser.** Number words below a thousand ("eleven", "twenty-one", "three hundred and
  five"), spaced fractions (" 1 / 2 ") and fraction words ("a half", "one half", "three
  quarters"). Leading zeros, `-0` and trailing decimal zeros were already equal; tests now
  cover them. Remainder and money formats belong to the mul-div and measurement strands.
- **Property tests.** 10,000 seeded items per new family against references that do not
  share the solver's code: string indexing for place value, `bigint` comparison, and
  `(n + 5) / 10 * 10` for rounding.
- **Not in this PR.** The `long-division` procedure scenario and the `steps[]` answer key
  arrive with the mul-div strand, the first one with a `procedure` skill that has more than
  one step to withhold. Estimation's `defer` with an authored range arrives with the
  estimation skill. Strategy evidence for the four new skills is empty on purpose: a right
  digit, sign or rounded number does not prove how the child got there.
- **Verification.** Typecheck and lint clean. Full suite: 2604 pass; the 12 failures are the
  catalogue ones already failing on `main` (`catalogue/data/` was never committed).
  `golden:content --generator-only`: 112 cases, arithmetic correctness 100%, reading level
  100%; the release result stays FAIL only because no case has had human review, as on
  `main`. `golden:tutoring`: 9 scenarios pass.

### Strand 3 of 9: multiplication and division, and the procedure rule

**Code complete 2026-11-12** on `feat/P3-07-arithmetic-mul-div`, pending review, stacked on
strand 2 (#40).

- **Four skills.** `MUL.FACT.10` and `DIV.FACT.10` (3.OA.C.7, `fact`), `MUL.2D1D`
  (4.NBT.B.5, `procedure`), `DIV.LONG` (4.NBT.B.6, `procedure`). New `multiplication` and
  `division` kinds; whole-number division is exact on `bigint` and answers "39 r 1".
  Remainder formats read: "39 r 1", "39 R1", "39r1", "39 rem 1", "39 remainder 1", and words.
- **`steps[]` answer key.** `procedureSteps(problem)` derives a written method's steps for
  every `procedure` skill (column addition, subtraction with a trade, two-digit times
  one-digit, long division). Derived, never stored, so the generator, the policy and the hint
  cannot disagree. No step prompt contains the final answer, proven over every item.
- **The procedure rule.** The tutor snapshot gains `procedureSteps`. While the item's stuck
  turns are fewer than its steps, `REVEAL` is out of the allowed set (skips included); a wrong
  answer or "I don't know" gets `HINT/point-to-step` at the next step; a skip gets a fresh
  easier item without the answer. A repeated misconception still gets its fix. The P3-04
  stuck-twice invariant treats a hint at a *new* step as a change; asking again is still
  forbidden. The step hint's text is gated: it fails if it says the step's answer or the
  whole answer (`mustNotMention`, whole-token matched).
- **`long-division` tutoring scenario.** Runs the real policy on 157 ÷ 4: four wrong answers
  get hints at steps 1–4, the fifth steps back to `DIV.FACT.10`; never a reveal. A new
  machine invariant, `REVEAL_BEFORE_STEPS`, checks the planned move and the emitted moves.
- **Not yet.** The child still answers the whole item; a step's own answer is not collected
  and graded on its own. That needs the item to stay open across a right step answer, which
  is a session-flow change rather than a curriculum one; it is noted for P3-08.
- **Verification.** Typecheck and lint clean. Full suite: 2697 pass, the same 12 known
  catalogue failures. `golden:content --generator-only`: 192 cases, every check 100%.
  `golden:tutoring`: 10 scenarios pass.

### Strand 2 of 9: addition and subtraction

**Code complete 2026-11-12** on `feat/P3-07-arithmetic-add-sub`, pending review, stacked on
strand 1 (#39).

- **Four skills.** `ADD.FACT.20` (2.OA.B.2, `fact`), `SUB.FACT.10` (1.OA.C.6, `fact`),
  `SUB.REGROUP.2D` (2.NBT.B.5, `procedure`), `ADD.3D` (3.NBT.A.2, `procedure`). A new
  `subtraction` problem kind (always `left >= right`; negatives are the integers strand's);
  three-digit sums reuse `addition`. Every parameter space is filtered to the skill: facts that
  cross ten, subtractions that need a broken ten, three-digit sums with at least one trade.
- **Wrong ideas, column by column** (`derived-add-sub.ts`), so one rule holds at two digits
  and three: column totals written whole, every carry dropped, the hundreds carry dropped,
  stopping at ten, adding instead, counting the start, naming the part taken, smaller digit
  from bigger, a borrowed ten never taken from the tens, a zero where the top digit is smaller.
  A sweep of every item in the four spaces proves no prediction is ever the right answer.
- **Visuals.** Subtraction shows the whole and how much goes; place-value blocks carry a
  `hundreds` count only from 100 up, so two-digit blocks are unchanged.
- **Strategy evidence.** `ADD.3D` and `SUB.REGROUP.2D` claim `lined-up-place-value` only:
  the `regrouped` claim says "when the ones went past nine", which a tens-only trade or a
  subtraction is not. The two fact skills claim nothing, like `ADD.FACT.10`.
- **Still to come.** `procedure` items do not yet carry `steps[]`; the step-by-step reveal
  guard and its `long-division` scenario arrive with the mul-div strand, as strand 1 noted.
- **Verification.** Typecheck and lint clean. Full suite: 2639 pass, the same 12 known
  catalogue failures. `golden:content --generator-only`: 152 cases, arithmetic correctness,
  option count and reading level all 100%. `golden:tutoring`: 9 scenarios pass.

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
