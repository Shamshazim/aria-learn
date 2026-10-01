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

## Status

**Part 1 delivered** — the export path, the SLO registry and the alert rules. Three of the
seven bars were watched; the other four were in `slos.ts` as `not_instrumented` with the
reason, and `/status` and the generated rule file both reported the gap.

**Part 2: client timings delivered.** Five of the seven bars are now watched. The two the
browser alone can see — the audible welcome and interrupt-to-silence — are instrumented from
`POST /api/v1/telemetry/turn`:

- `packages/shared/src/protocol/schemas/telemetry.schema.ts` — the report: a list of
  `{ kind, ms }` durations and an optional session id, and nothing else about the child.
  Durations, never timestamps, so a tablet with a wrong clock still reports a true number.
  `sessionId` is optional because `arrival_visible` is measured on the class picker, before a
  session exists.
- `apps/api/src/routes/telemetry.routes.ts` + controller + `services/telemetry/` — behind the
  child gate, rate-limited under a new `telemetry` route class (X-05), strict-schema validated
  and covered by `routes/input-guard.test.ts` like every other route.
- `apps/api/src/observability/client-metrics.ts` — the histograms, labelled by band and by
  nothing else. It refuses a duration no bar could believe (a backgrounded tab reports four
  minutes for a one-second measurement) and counts the refusal in
  `client_timing_implausible_total`; the ceilings are far above anything a working system
  produces and are **not** a second copy of the §11 thresholds.
- `apps/web/src/lib/observability/timing.ts` — the stopwatch: marks, durations, a batched
  outbox, and a send that is allowed to fail silently. Its clock, sender and scheduler are
  injected, so the whole module is unit-tested without a browser.
  `features/voice/model/voice-timings.ts` decides which room event means "the speaker made a
  sound" and which worker state means "she stopped".
- Migration `029` adds `student.is_synthetic`, and every statement in
  `phase1-metrics.repository.ts` now filters on it — asserted per statement, because the
  mistake worth guarding is one query out of five forgetting the join.

Two decisions the ticket did not settle:

- **`visible_welcome` stays sourced from the server's `arrival_ms`.** The client's
  `arrival_visible_ms` is the truer number and is exported beside it, but that bar is already
  watched, and moving it onto a signal that depends on a browser choosing to report would
  trade coverage for accuracy. Re-sourcing is one line in `slos.ts` once staging shows what
  share of real sessions report.
- **The visible stop button is not measured.** The §11 bar is "child interruption stops
  Aria's speech"; the button silences the room locally and instantly, so folding it in would
  dilute the bar with a path that cannot miss it.

**Part 2, still not built.** Neither is blocked by the other:

- **Per-turn spans and the OTLP exporter.** The traces the tracing criterion asks for. The
  histograms here answer "is a bar being missed"; spans answer "where did the time go", and
  the second question is only worth the dependency once somebody is asking it.
- **The synthetic probe and the capacity run.** Both need a deployed staging environment to
  run against, so neither can be written and *verified* from here — and an unrun capacity test
  would put a number in `capacity.md` that nobody measured. Migration `029` prepares the way:
  the flag exists, the reports honour it, and `client_timing_synthetic_total` already counts
  what a probe reports. Creating the probe student belongs with the probe — note that
  `student.parent_id` stays `NOT NULL`, so it gets a probe parent rather than none.

## Acceptance criteria

- [x] `/metrics` exports every counter and histogram from the `Metrics` port with SLO-aligned
      buckets. **Scraped in staging: not verified** — no staging environment to scrape from.
- [ ] A full voice turn produces one trace with spans from `speech_final` to `playback_end`
      across web, API and worker, visible in the X-01 platform. (**Part 2**)
- [x] Every §11 bar exists in `slos.ts`; `slo:rules` generates alert rules; each rule fires
      in a test with synthetic bad data and has a runbook.
- [x] Client timings arrive for arrival, first audio and interrupt silence, and are
      excluded from reports when `is_synthetic`. **End-to-end in a browser: not verified** —
      the measuring, the route and the exclusion are each tested, but no real session has been
      driven through a deployed environment.
- [ ] The synthetic probe runs on a schedule against staging and pages on a failed session.
      (**Part 2** — needs staging)
- [ ] `capacity.md` records the concurrency at which staging first breaks an SLO and the
      resulting scaling rule. (**Part 2** — needs staging)
- [x] No label carries a student or session id (test on the exporter, and on the client
      timing observer — the report carries a session id, so the one thing that must never
      happen is that id becoming a label).

## Verification

```bash
npm run test -w @aria/api -- observability routes/status routes/telemetry services/telemetry
npm run test -w @aria/api -- repositories/phase1-metrics
npm run test -w @aria/web -- lib/observability features/voice/model/voice-timings
npm run slo:rules -w @aria/api -- --check   # fails if the committed rules are stale
```

What is left of part 2 adds `synthetic:probe`, the spans and the capacity run — the probe and
the capacity run both need a deployed environment.

## References

- `master-plan.md` §4.1 (latency rule), §11
- `realtime-agent-harness.md` — latency measurement, SLOs
- P0-03, P0-13, P1-14, P2-12, P2-13, X-01, X-05
