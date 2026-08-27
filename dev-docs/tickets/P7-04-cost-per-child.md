# P7-04 — Cost per child per month, measured and driven down

| | |
|---|---|
| **Phase** | 7 |
| **Track** | Ops |
| **Depends on** | P0-15, P1-14, P7-03, X-04 |
| **Blocks** | P7-05 |
| **Parallel-safe with** | P7-01, P7-02 |
| **Size** | M |

## Why

`cloud-model-layer.md` §9: "the number that matters is cost per child per month. Track it
from the first day. If a 30-minute daily session costs more than the subscription, the
product does not exist." Today `ai_generation_log` prices every LLM call and a daily cap
exists (`spend.service.ts`), but speech (STT/TTS/LiveKit minutes) is not priced, there is no
monthly roll-up, and no one is alerted when a cohort's cost trends past the price.

## Scope

### Build
Speech and media cost accounting, a monthly per-child roll-up, cohort views (band, plan,
first-month vs returning), alert thresholds, an operator report, and the tuning loop that
records each cost reduction with its quality evidence.

### Do not build
No billing (X-02). No cost shown to a parent or child. No per-child model downgrade — cost
moves through routing (P7-03) and caching (P7-01/02) for everyone, never by giving one
child a worse tutor.

## Design

```
apps/api/src/
  db/migrations/026_voice_cost.sql     `voice_usage_log` (id, student_id, session_id,
                                       voice_session_id, kind stt|tts|media, provider,
                                       units, unit_kind seconds|characters|minutes,
                                       cost_usd NUMERIC(10,6), at); indexes on
                                       (student_id, at)
  services/voice/usage.service.ts      records STT audio seconds, TTS characters (per
                                       synthesised segment, cached-audio hits at 0), LiveKit
                                       participant-minutes at session end; prices from
                                       config/voice-pricing.yaml
  ai/cost/
    monthly.service.ts                 per student per calendar month (UTC, then the
                                       account's timezone in the report): llm_usd,
                                       voice_usd, total_usd, sessions, minutes, cost per
                                       session-minute
    cohort.service.ts                  aggregates by band, by subscription plan (X-02), by
                                       tenure bucket; p50/p90 per child
    cost-alerts.ts                     thresholds: child > COST_ALERT_CHILD_MONTH_USD,
                                       cohort p90 > COST_ALERT_COHORT_MONTH_USD, month-to-
                                       date run-rate > price × COST_ALERT_RUN_RATE_RATIO;
                                       emits through the existing SpendAlert channel
  scripts/cost-report.ts               npm run cost:report -w @aria/api -- --month 2026-09
  services/status.service.ts           (edit) month-to-date totals and alert state
apps/voice-worker/src/session/usage-reporter.ts   posts usage to the API worker route
                                       (worker-only middleware) at segment/session end
apps/api/config/voice-pricing.yaml     provider → unit price, versioned by effective date
dev-docs/ops/cost.md                   the target per child per month, how it is computed,
                                       and the log of each reduction with its P7-03 run
```

Rules:
- Every cost source has a log row: LLM (`ai_generation_log`), speech and media
  (`voice_usage_log`). Cached hits are rows at $0 so hit-rate and cost reconcile.
- The monthly roll-up is derived, never hand-edited; it is rebuilt from logs on demand.
- Alert thresholds live in config with the values written in `cost.md`, never in code.
- The daily cap's fallback (verified cache-only mode) is unchanged; this ticket makes its
  frequency a metric: `cost.cap_tripped{band}`.

### Edge cases
- Price change mid-month: `voice-pricing.yaml` entries carry `effective_from`; rows keep the
  price at the time of use; re-pricing history is never rewritten.
- Vendor invoice disagrees with our log: `cost:report --reconcile <invoice.csv>` prints the
  delta per provider; a delta over 5% is an alert, not silently accepted.
- Worker crashes before posting usage: usage is posted per segment, and session-end media
  minutes are computed from `voice_session.started_at/ended_at` on the API side, so a lost
  final post under-counts by at most one segment.
- A child with no sessions in the month: no row; cohort averages divide by active children.
- Timezone: roll-up stored in UTC months; the operator report can re-bucket by account
  timezone without changing stored rows.
- Deleted child (P6-06): cost rows are deleted with the child; the cohort aggregate for the
  closed month is kept as a pre-computed snapshot so historical totals do not shift.
- Daily cap trips repeatedly for one child: alert once per day per child (dedupe key), not
  per turn.

## Acceptance criteria

- [ ] Migration `026` applies; cascade from `student` holds.
- [ ] STT seconds, TTS characters (cached hits at $0) and media minutes are recorded for a
      full voice golden-set session and reconcile to within 1% of the provider's usage API
      where one exists (the delta is recorded in the PR).
- [ ] `cost:report --month` prints per-child and cohort totals, p50/p90, cost per
      session-minute, and cap-trip counts.
- [ ] Every alert threshold fires in a test and dedupes per child per day.
- [ ] Price changes with `effective_from` do not alter historical rows, proven by a test.
- [ ] `/api/v1/status` exposes month-to-date total and alert state (operator token only).
- [ ] `dev-docs/ops/cost.md` states the target cost per child per month and the current
      measured number from the golden-set month simulation.
- [ ] At least one cost reduction is recorded in `cost.md` with a link to the P7-03 run that
      proved no quality bar moved.

## Verification

```bash
npm run test -w @aria/api -- ai/cost services/voice/usage
npm run cost:report -w @aria/api -- --month $(date -u +%Y-%m)
npm run voice:golden -- --report cost
```

## References

- `master-plan.md` §4.6, §11, §13 Phase 7
- `cloud-model-layer.md` §9 (cost), §10 (spend cap)
- P0-15, P1-14, P7-03, X-02, X-04
