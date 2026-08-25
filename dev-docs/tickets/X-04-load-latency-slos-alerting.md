# X-04 — Load, latency SLOs and alerting

| | |
|---|---|
| **Phase** | Cross-cutting (must be live before Phase 2H exit) |
| **Track** | Ops |
| **Depends on** | P1-14, P2-12, X-01 |
| **Blocks** | P2H-14, P7-04, P7-05 |
| **Parallel-safe with** | P7-01, P7-02, P7-03 |
| **Size** | M |

## Why

`master-plan.md` §11 states the bars as numbers: content wait < 1s p95, visible welcome
< 500ms p95, audible welcome < 1s p95, interrupt-to-silence < 250ms p95, end-of-turn
≥ 98%. P1-14 computes some of them from `session_event` after the fact and `Metrics` is an
in-memory map that dies with the process. Nobody is paged when a bar is missed in
production, and nobody knows how many concurrent voice sessions one worker survives.

## Scope

### Build
Metrics export, per-turn spans across web → API → worker → vendors, SLO definitions as
alert rules, a synthetic session probe, and a capacity test for concurrent voice sessions
with its recorded result.

### Do not build
No custom dashboards product; use the platform chosen in X-01 (its decision record names
it). No user-level tracking, no analytics on children beyond what §11 requires; no third-
party analytics SDK in `apps/web`.

## Design

```
apps/api/src/observability/
  metrics.ts                  (edit) keep the port; add an exporter adapter
  exporters/prometheus.ts     /metrics on an operator-only port; histograms with fixed
                              buckets tuned to the SLOs (50ms…5s)
  tracing/
    span.ts                   Span port: start(name, attrs) → end(); traceId propagated
                              through the request id (P0-03) and the realtime session id
    otlp.exporter.ts          the only file importing the OTel SDK
  slo/
    slos.ts                   one record per §11 bar: metric, percentile, threshold,
                              window, burn-rate alert config — mirrors testing/routing/
                              bars.ts so numbers live in one place per concern
apps/voice-worker/src/observability/
  spans.ts                    per-turn spans: speech_final → intent → plan → first_gated_
                              sentence → first_audio → playback_end; interrupt → cancel →
                              silence
apps/web/src/lib/observability/
  timing.ts                   arrival_visible_ms, audio_unlocked_ms, first_audio_ms,
                              interrupt_silence_ms sent to POST /api/v1/telemetry/turn
                              (student-scoped, no PII beyond session id)
apps/api/src/routes/telemetry.routes.ts   accepts client timings, validates, records
infra/alerts/
  slo-rules.yaml              generated from slos.ts by `npm run slo:rules`; multi-window
                              burn-rate alerts (fast: 5m/1h, slow: 6h/3d)
  runbooks/<slo>.md           what to check when each alert fires
apps/api/src/testing/synthetic/
  probe.ts                    one scripted session (arrival → 3 turns → end) against an
                              environment every 5 min; records each SLO metric; fails
                              loudly on the P0-25 failure experience appearing
  capacity.ts                 N bot-to-bot voice sessions (P2-12 runner) against staging;
                              ramps 5 → 50; records the concurrency at which any SLO
                              breaks
dev-docs/ops/capacity.md      the recorded result and the scaling rule derived from it
```

Rules:
- Every SLO in §11 is exactly one entry in `slos.ts`; a bar that cannot yet be measured is
  marked `not_instrumented`, not omitted, and `/status` shows it.
- Client timings are the source of truth for "what the child experienced"; server spans are
  for finding where the time went.
- Alerts page on burn rate, not on single samples; one alert per SLO per environment.
- The synthetic probe uses a dedicated probe student with no parent, excluded from every
  report (P1-14, P7-04) by a `is_synthetic` flag on `student`.

### Edge cases
- Vendor latency spike: spans attribute the time to `llm`/`stt`/`tts`; the alert names the
  vendor so the P0-13 fallback decision is informed.
- Clock skew between client and server: client sends durations, never absolute times.
- Telemetry route abused: rate-limited per session (X-05), payload schema-validated,
  rejected silently on mismatch.
- Metrics cardinality: labels limited to band, move kind, endpoint name, environment —
  never student or session id.
- Worker restart during the capacity run: counted as a failure at that concurrency; the
  outbox resume (P2-13) is exercised, not hidden.
- Probe student deleted by accident: the probe recreates it and alerts once.

## Acceptance criteria

- [ ] `/metrics` exports every counter and histogram from the `Metrics` port with SLO-aligned
      buckets; scraped in staging.
- [ ] A full voice turn produces one trace with spans from `speech_final` to `playback_end`
      across web, API and worker, visible in the X-01 platform.
- [ ] Every §11 bar exists in `slos.ts`; `slo:rules` generates alert rules; each rule fires
      in a test with synthetic bad data and has a runbook.
- [ ] Client timings arrive for arrival, first audio and interrupt silence, and are
      excluded from reports when `is_synthetic`.
- [ ] The synthetic probe runs on a schedule against staging and pages on a failed session.
- [ ] `capacity.md` records the concurrency at which staging first breaks an SLO and the
      resulting scaling rule.
- [ ] No label carries a student or session id (test on the exporter).

## Verification

```bash
npm run test -w @aria/api -- observability testing/synthetic
npm run slo:rules -w @aria/api
npm run synthetic:probe -w @aria/api -- --env staging
npm run voice:golden -- --capacity 20 --env staging
```

## References

- `master-plan.md` §4.1 (latency rule), §11
- `realtime-agent-harness.md` — latency measurement, SLOs
- P0-03, P0-13, P1-14, P2-12, P2-13, X-01, X-05
