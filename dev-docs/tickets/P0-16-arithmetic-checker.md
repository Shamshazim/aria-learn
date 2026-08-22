# P0-16 — Deterministic arithmetic checker

| | |
|---|---|
| **Phase** | 0 — Foundation |
| **Track** | Backend |
| **Depends on** | P0-01 |
| **Blocks** | P0-18, P0-21 |
| **Parallel-safe with** | everything in Phase 0 — it is a pure module with no dependencies |
| **Size** | M |

## Why

"A tutor who says 2 + 3 = 6 is not a tutor." Arithmetic correctness must be 100%, and it is
the one quality check that must never involve a model. Code solves the problem
independently; the model's claimed answer is only a candidate.

## Scope

### Build
A pure, framework-free checker that independently solves every arithmetic skill in the
initial inventory (P0-17), and **defers rather than guesses** where it cannot prove an answer.

### Do not build
No parsing of free-form natural-language word problems this phase. The checker works on a
structured expression; extracting an expression from prose is a later, separately gated
ticket.

## Design

```
apps/api/src/quality/arithmetic/
  index.ts
  types.ts            ArithmeticProblem (a discriminated union per operation),
                      CheckResult = { verdict: 'correct' | 'incorrect' | 'undecidable',
                                      expected?: string, reason: string }
  solvers/
    addition.ts  subtraction.ts  multiplication.ts  division.ts
    fractions.ts  place-value.ts  comparison.ts
  registry.ts         Record<SkillCode, Solver>. Add a file, not a case.
  normalise.ts        answer normalisation: whitespace, unicode minus, "1/2" vs "½",
                      trailing period, leading zero, mixed numbers
  __fixtures__/
    cases.data.ts     table-driven cases, including every case seeded from legacy defects
```

Rules:
- **Exact arithmetic only.** Use integer and rational arithmetic; never floating point for a
  value a child will see. A repeating decimal is represented as a fraction, not rounded.
- **`undecidable` is a first-class verdict**, and the caller must treat it as a failure of
  the gate, not a pass. Silence beats a guess.
- Normalisation is separate from solving and separately tested. Accepting `0.5`, `1/2` and
  `½` is a normalisation decision; it must be explicit per skill, not global.
- Legacy `MathAnswerChecker.java` and `AnswerMatcher.java` may be **read** for accepted and
  deliberately refused examples, which become fixture rows. No code and no structure is
  carried across (`rewrite.md` §3).
- Adding an arithmetic skill later requires its solver and its golden cases before release —
  state that in the registry's module header.

## Acceptance criteria

- [ ] Every arithmetic skill in the P0-17 inventory has a solver and fixture coverage.
- [ ] 100% of fixture cases return the expected verdict; a wrong answer is never `correct`.
- [ ] No floating-point comparison anywhere in the module.
- [ ] An expression the checker cannot prove returns `undecidable` with a reason, and a test
      proves the gate treats that as a failure.
- [ ] Property tests: for each supported operation, randomly generated problems are solved
      correctly across the band's number range.
- [ ] The module imports nothing from Express, the database or the AI layer.
- [ ] No file over 300 lines; fixtures live in their own data file.

## Verification

```bash
npm run test -w @aria/api -- quality/arithmetic
```

## References

- `master-plan.md` §4.5 check 2, §6.3, §11
- `rewrite.md` §3 (permitted use of legacy checkers)
