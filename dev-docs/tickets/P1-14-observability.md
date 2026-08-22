# P1-14 — Observability for the Phase 1 bars

| | |
|---|---|
| **Phase** | 1 |
| **Track** | Backend |
| **Depends on** | P1-06 |
| **Blocks** | P1-15 |
| **Parallel-safe with** | P1-11, P1-12, P1-13 |
| **Size** | S |

## Why

`master-plan.md` §11 sets numeric bars — p95 waits, hint effectiveness, frustration exits,
welcome latency. "Opinions do not count. These numbers do." They only count if they are
actually measured, from the first real session onward.

## Scope

### Build
Structured metrics and the query surface for every Phase 1 bar, derived from `session_event`
where possible rather than from a parallel metrics system.

### Do not build
No third-party observability vendor and no dashboard product. Logs, metrics and a report
script.

## Design

```
apps/api/src/observability/
  metrics.ts            counters, histograms; injected, not global
  session-metrics.ts    derived from session_event: wait time, hint effectiveness,
                        approach-change violations, end reasons
  report/
    phase1.report.ts    one script printing every §11 bar
```

Bars to report:

| Metric | Bar | Source |
|---|---|---|
| Child waits for content | < 1s p95 | turn timing |
| Two wrong answers without a change of approach | 0 | `session_event` sequence |
| Sessions ended by the child in frustration | < 5% | `end_reason` |
| Hint actually helps (next attempt correct) | > 60% | `session_event` sequence |
| Visible personalised welcome after arrival | < 500ms p95 | arrival timing |
| Durable fact has supporting evidence | 100% | `learner_fact_evidence` |
| Parent corrections reflected next session | 100% | supersede + next-turn retrieval |

- Every log line and metric carries the session id and request id; **never** a name, an
  email, prompt text or response text.
- Deriving from `session_event` keeps one source of truth — if the transcript and the metric
  disagree, the transcript is right.

## Acceptance criteria

- [ ] `npm run report:phase1 -w @aria/api` prints every bar above with its current value.
- [ ] Each metric has a test using a fixture session with a known expected value.
- [ ] No metric label or log field contains identifying data.
- [ ] Metrics are injected; no module-level mutable singleton.
- [ ] The report distinguishes "bar not met" from "not enough data".

## Verification

```bash
npm run test -w @aria/api -- observability
npm run report:phase1 -w @aria/api
```

## References

- `master-plan.md` §11
