# Alerts

What pages someone, and what it means when it does. Every rule names the metric, the
condition, the severity and — the part that matters — what a human should do about it.

Metrics come from `apps/api/src/observability/metrics.ts`. Counter names and label sets are
fixed in code; if you change one here, change it there in the same PR.

## Content quality (P2H-02)

### `gate_rejections_total`

Labels: `check` (`structural` | `correctness` | `level` | `safety`), `code`, `band`.

Incremented once per piece of child-facing content the quality gate refuses. It is emitted
alongside exactly one structured `gate_rejection` log line carrying the same fields plus the
full list of failing codes.

| Rule | Condition | Severity | What it means |
|---|---|---|---|
| `GateRejectionRateHigh` | `rate(gate_rejections_total[15m]) / rate(content_generated_total[15m]) > 0.10` for 15m | warning | More than one in ten generations is being thrown away. The prompt, the persona or a threshold has drifted. Children are still safe — they are getting fallbacks — but they are hearing less of Aria. |
| `GateSafetyRejection` | `increase(gate_rejections_total{check="safety"}[5m]) > 0` | **critical** | The model produced text the safety classifier refused. Page. Capture the generation log id from the paired log line and review before the next release. |
| `GateLevelRejectionSpike` | `increase(gate_rejections_total{check="level",band="early"}[1h]) > 50` | warning | Early-band readability is rejecting at a rate that suggests a threshold regression. Check `level-corpus.fixture.ts` against the current thresholds before touching either. |

A rejection is *not* an error. The gate doing its job is the system working. The alert exists
because a *rate* of rejections means something upstream is wrong.

### `fallback_used_total`

Labels: `move` (a `MoveKind`), `reason` (`ai_disabled` | `provider_error` | `gate_failed`).

Incremented when a child hears a reviewed static string instead of generated text. The three
reasons are deliberately distinct: they have three different owners.

| Rule | Condition | Severity | What it means |
|---|---|---|---|
| `FallbackInNominalSession` | `increase(fallback_used_total[10m]) > 0` while `ai_disabled` is not the reason and no provider incident is open | warning | P2H-11's exit bar is `fallback_used_total == 0` in a nominal session. Any non-zero value here is a real regression in prompt quality or provider health. |
| `FallbackProviderError` | `increase(fallback_used_total{reason="provider_error"}[5m]) > 10` | **critical** | The model provider is failing and the breaker has not covered it. Cross-check the provider status route before escalating to the vendor. |
| `FallbackGateFailed` | `increase(fallback_used_total{reason="gate_failed"}[30m]) > 20` | warning | Our own prompts are producing text that cannot pass our own gate. This is the only one of the three we fix by writing a better prompt. |
| `FallbackAiDisabled` | `increase(fallback_used_total{reason="ai_disabled"}[5m]) > 0` in production | **critical** | A production deployment is serving children canned strings because no model is configured. This is a deployment fault, not a model fault. |

## Free conversation (P2H-05)

### `intent_model_fallback_total`

Labels: `reason` (`timeout` | `provider_error` | `disabled`).

Incremented when the model second pass over what a child meant could not answer, and the
deterministic rules' result was used instead. The rules are always computed, so a fallback is
a quality loss, never an outage: chat is more likely to be graded as a wrong answer.

| Rule | Condition | Severity | What it means |
|---|---|---|---|
| `IntentModelTimeoutRate` | `rate(intent_model_fallback_total{reason="timeout"}[15m]) > 0.2 * rate(intent_classifications_total[15m])` | warning | The FAST tier is too slow to sit in front of a turn. Move the endpoint; do **not** raise the 300 ms budget — the budget is what keeps a child from waiting on a classifier. |
| `IntentModelDisabledInProd` | `increase(intent_model_fallback_total{reason="disabled"}[5m]) > 0` in production | warning | No model is configured for the second pass. Rules-only agreement is ~90%, so roughly one utterance in ten is being read wrong. |

## Runbook notes

- **Never** silence a `safety` rule to clear a board. Route it to the safeguarding on-call
  path in `apps/api/src/safety/crisis/matrix.ts`.
- A rejection log line carries no child-facing text by design. To see what failed, look up the
  generation log row by `contentId` behind the privacy boundary; do not add the text to the log.
- Threshold changes to the readability gate change what a child hears. Record them in the PR
  and re-run `npm run test -w @aria/api -- quality` and `npm run golden:content -w @aria/api`.

## Still to write

These metrics are named in tickets but not yet emitted; add their rules with the code.

- `bridge_played_total`, `bridge_skipped_total`, `bridge_repeat_total` (P2H-09)
- planner latency and `planner-rejected` counts (P2H-06)
- first-audio p95 (P2H-13)
