# P0-21 — The content golden set and its harness

| | |
|---|---|
| **Phase** | 0 — Foundation |
| **Track** | Content / QA |
| **Depends on** | P0-15, P0-16, P0-17, P0-18 |
| **Blocks** | Phase 0 exit |
| **Parallel-safe with** | P0-19, P0-20, P0-22 |
| **Size** | L |

## Why

`master-plan.md` calls this "the single most important piece of engineering infrastructure on
the list, because without it 'the model got better' is just a feeling." Swapping providers is
worthless if we cannot tell whether the new one is better.

## Scope

### Build
500 human-graded items checked into the repository, and a harness that runs the whole set
against **any configured endpoint** and reports correctness, reading-level violations, markup
leakage, safety flags, mean latency and total cost.

### Do not build
No multi-turn tutoring scenarios. That is P0-22, and the two sets are deliberately separate:
a model that writes good questions can still conduct a bad conversation.

## Design

```
dev-docs/golden/content/
  README.md                how to add an item, how to grade one
  items/
    arithmetic/*.json      one file per item group, never one 500-item file
    reading/*.json
    writing/*.json
  schema.json
apps/api/src/testing/golden/
  runner.ts                runs the set against a named endpoint
  graders/
    correctness.grader.ts  arithmetic via P0-16; other content against its expectation
    level.grader.ts
    markup.grader.ts
    safety.grader.ts
  report/
    report.ts              per-check pass rate, latency percentiles, total and per-item cost
    format.ts              human-readable and JSON output
```

Each item carries: input variables, the prompt name, the graded expectation, the skill code,
the band, and the grader's notes. Coverage is spread across subject, every grade band and the
representative skill families in the initial release scope, **weighted toward arithmetic
facts and decodable text**, where a wrong answer does the most harm.

The bars it reports against (`master-plan.md` §11), all release-blocking:

| Check | Bar |
|---|---|
| Arithmetic correctness | 100% |
| Non-math factual correctness | ≥ 99% on the human-graded set |
| Exactly one correct option | 100% |
| Reading level within band | ≥ 98% |
| No markup in child-facing text | 100% |
| Decodable text uses only taught patterns | 100% |
| Safety classifier pass | 100% |

Rules:
- The set grows before any new skill ships; its cases and quality bar are part of that
  skill's ticket.
- Any prompt or model change reruns the set. **A regression blocks the change.**
- The harness takes the endpoint name as an argument and changes nothing else — proving the
  Phase 0 exit test.

## Acceptance criteria

- [ ] 500 items exist, each graded by a human, spread as described, with the weighting toward
      arithmetic and decodable text visible in a coverage report.
- [ ] `npm run golden:content -w @aria/api -- --endpoint <name>` runs the whole set and
      reports every check, mean and p95 latency, and total cost.
- [ ] Output is available both human-readable and as JSON for CI.
- [ ] The run works against at least two different endpoints with no code change.
- [ ] Arithmetic grading uses P0-16 and never a model.
- [ ] A deliberately broken prompt produces a failing report that names the failing check
      and the item ids.
- [ ] The prompt version and endpoint name appear in the report header.
- [ ] Cost per run is reported, so we know what a rerun costs before we trigger it.

## Verification

```bash
npm run golden:content -w @aria/api -- --endpoint anthropic-sonnet
npm run golden:content -w @aria/api -- --endpoint openai-gpt
```

## References

- `master-plan.md` §11, `cloud-model-layer.md` §12
