# P7-03 — Tier routing tuning, backed by golden-set runs

| | |
|---|---|
| **Phase** | 7 |
| **Track** | Backend |
| **Depends on** | P0-13, P0-21, P0-22, P2H-14 |
| **Blocks** | P7-04, P7-05 |
| **Parallel-safe with** | P7-01, P7-02, X-01 |
| **Size** | M |

## Why

`apps/api/config/ai.yaml` routes both `TEACH` and `FAST` to `anthropic-sonnet` "until the
golden set decides". `master-plan.md` §4.6: "a cheap fast model for hints and grading, a
strong model for teaching and for the quality gate. This is where most of the cost control
lives." Every routing change must be *proved* by both golden sets, or "the model got better"
is a feeling (§11).

## Scope

### Build
Per-prompt tier assignment (finer than the two-value `ModelTier` where needed), a routing
experiment runner that runs both golden sets against a candidate `ai.yaml`, a regression
comparator that blocks a change on any quality bar, and the recorded decision.

### Do not build
No new adapters (P0-11/P0-12 cover every vendor we route to). No automatic self-tuning in
production — routing changes are config commits reviewed by a human with the report
attached. No third tier unless the report shows two is insufficient; if so, add `GATE` as a
third value with its own PR.

## Design

```
apps/api/src/ai/
  provider/
    config.schema.ts        (edit) `routing.by-prompt: { <promptName>: <tier> }` optional
                            override map, validated against the prompt registry at boot
    routing.ts              (edit) resolve tier: by-prompt override → prompt's declared
                            default tier → TEACH
  prompts/types.ts          (edit) PromptDefinition gains `defaultTier: ModelTier`
apps/api/src/testing/routing/
  experiment.ts             loads candidate ai.yaml (path arg), runs golden:content and
                            golden:tutoring through the same harnesses, writes
                            dev-docs/golden/routing/<date>-<name>.json
  compare.ts                baseline vs candidate: per-bar delta; any bar in §11 that
                            drops below its threshold → exit 1; cost and p95 latency
                            deltas reported
  run-cli.ts                npm run golden:routing -w @aria/api -- --candidate config/ai.candidate.yaml
dev-docs/golden/routing/
  README.md                 what a run contains, how to read it, the decision log format
  decisions.md              one dated row per accepted routing change, linking the run file
```

Tier assignment rules (starting hypothesis, to be confirmed by the runs):

| Prompt family | Tier | Why |
|---|---|---|
| explain, reteach, story beats, learner brief | TEACH | correctness and warmth |
| quality gate safety/level classifiers | TEACH | the gate must be at least as strong as the writer |
| hint, grade-short-answer, intent classify, praise wording | FAST | latency-bound, deterministically checked afterwards |
| planner (P2H-06) | FAST, TEACH fallback | latency budget per band |

Rules:
- The comparator's bars are read from one file (`testing/routing/bars.ts`) mirroring
  `master-plan.md` §11 — arithmetic 100%, non-math ≥99%, level ≥98%, safety 100%, human
  rubric ≥90% carried from the last P2H-14 review — so a bar cannot be quietly loosened
  inside a script.
- Any run that lowers cost but breaches one bar is rejected, however large the saving.
- `by-prompt` overrides are the *only* way to route one prompt differently; no prompt may
  name an endpoint directly.

### Edge cases
- Candidate config references an endpoint with no API key in the environment: boot
  validation fails with the endpoint name; the run does not silently fall back.
- A vendor is rate-limited during the run: retries per P0-13; if the breaker opens, the run
  is marked `incomplete` and cannot be used for a decision.
- Golden set grew since the baseline run: comparator refuses to compare different set
  versions (set hash recorded in each run file).
- A prompt is added without `defaultTier`: typecheck fails.
- FAST endpoint returns malformed JSON more often: the existing regenerate-once path handles
  it; the run reports `retry_rate` per prompt so the cost of a cheap model is visible.
- Two tiers end up on the same endpoint again after tuning: allowed, and the report says so.

## Acceptance criteria

- [ ] `by-prompt` overrides parse, validate against the registry, and an unknown prompt name
      fails boot with a clear message.
- [ ] Every prompt definition declares `defaultTier`; enforced by type.
- [ ] `golden:routing` runs both sets against a candidate config and writes a run file with
      quality, latency p50/p95, cost, retry rate, set hash and config hash.
- [ ] `compare` exits non-zero when any §11 bar is breached, proven by a fixture run.
- [ ] `compare` refuses runs with different golden-set hashes.
- [ ] An accepted change is recorded in `decisions.md` with its run file, and `ai.yaml` moves
      `FAST` off the TEACH endpoint only if that run passes.
- [ ] CI runs `compare` against the checked-in baseline whenever `config/ai.yaml` or any
      prompt definition changes (one job added to `.github/workflows/ci.yml`).
- [ ] Cost per golden-set run is reported before and after; the after number is recorded.

## Verification

```bash
npm run test -w @aria/api -- ai/provider testing/routing
npm run golden:routing -w @aria/api -- --candidate config/ai.candidate.yaml
npm run golden:routing -w @aria/api -- --compare dev-docs/golden/routing/baseline.json
```

## References

- `master-plan.md` §4.6, §11, §13 Phase 7
- `cloud-model-layer.md` §6 (tier routing), §12 (golden sets), §14 (open question: TEACH default)
- P0-13, P0-21, P0-22, P2H-14
