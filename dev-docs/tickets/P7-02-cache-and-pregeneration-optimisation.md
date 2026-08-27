# P7-02 — Cache and pre-generation optimisation

| | |
|---|---|
| **Phase** | 7 |
| **Track** | Backend |
| **Depends on** | P0-20, P7-01, P1-14 |
| **Blocks** | P7-05 |
| **Parallel-safe with** | P7-03, P7-04, X-04 |
| **Size** | M |

## Why

`master-plan.md` §4.1: "the child never watches a model work." The primitives exist since
Phase 0 — `content-cache.service.ts`, `pregenerate.service.ts`, a serial `BoundedQueue` —
but nothing measures whether they work: no hit rate, no eviction, no speculative-waste
number, and pre-generation is one in-process queue that dies with the process. Phase 7
makes the cache observable and then tunes it against the p95 < 1s bar (§11).

## Scope

### Build
Cache and pre-generation metrics, a warmer for the next likely moves, a speculative-waste
meter, eviction of stale/unused items, and a durable pre-generation queue.

### Do not build
No new content kinds, no changes to gate order, no Redis or external queue unless the
measurement in this ticket proves the Postgres-backed queue insufficient (record the
numbers; that decision is its own follow-up). No speculative *TTS* (explicitly deferred
by `BACKLOG.md` Phase 2).

## Design

```
apps/api/src/content/
  cache/
    cache-metrics.ts        increments content.cache.lookup{result=hit|miss|ineligible},
                            observes content.cache.lookup_ms; uses observability/metrics.ts
    eviction.service.ts     marks items unservable when: verified_at older than
                            CONTENT_MAX_AGE_DAYS, or times_used = 0 after
                            CONTENT_UNUSED_DAYS, or the prompt version they were generated
                            with is retired; never deletes rows (audit + golden replay)
  pregeneration/
    predictor.ts            given session state + skill plan, returns the ordered set of
                            (kind, skill, band) the next 1–2 moves are likely to need:
                            next ASK item, its HINT, its RETEACH, the SWITCH candidate
    warm.service.ts         enqueues predictor output through the existing queue; dedupes
                            against in-flight and cached
    speculative-waste.ts    tracks pregenerated items that were never served within the
                            session → content.pregen.waste ratio; alert above 40%
    durable-queue.repository.ts  migration 025 `pregeneration_job` (id, key, payload,
                            state queued|running|done|failed, attempts, created_at,
                            locked_at, locked_by); FOR UPDATE SKIP LOCKED claim
    queue.ts                (edit) wrap: in-process bounded queue stays for latency; each
                            enqueued job is also persisted so a restart resumes it
apps/api/src/services/status.service.ts   (edit, one block) expose cache hit rate, pregen
                            waste, queue depth, eviction counts
```

Config (`.env.example`): `CONTENT_MAX_AGE_DAYS=180`, `CONTENT_UNUSED_DAYS=90`,
`PREGEN_QUEUE_CAPACITY=64`, `PREGEN_MAX_ATTEMPTS=2`.

Rules:
- Pre-generation never bypasses the gate and never bypasses the per-child daily cap: a
  warmed item for a capped child is generated as *shared* (P7-01) if the cell is shareable,
  otherwise skipped.
- The warmer runs after the turn response is sent, never before (measured: turn latency
  must not rise; test asserts response before enqueue).
- Eviction is soft (`servable = false`), so golden replays of old sessions still resolve.

### Edge cases
- Process restart mid-job: `locked_at` older than `PREGEN_LOCK_TIMEOUT_S` is reclaimed;
  attempts increment; after `PREGEN_MAX_ATTEMPTS` the job is `failed` with the error.
- Two API instances claim the same job: `SKIP LOCKED` prevents it; test with two workers.
- Predictor guesses wrong (child answers correctly, HINT never used): the waste meter
  counts it; nothing else happens — waste is a number, not an error.
- Queue full: `enqueue` returns false (existing), the durable row is still written as
  `queued` and picked up later; the active turn is never blocked.
- Cache poisoned by a retired prompt version: eviction marks every item from that version
  unservable in one statement; hit rate dips and is visible.
- Spend cap tripped during warming: job ends `skipped_cap`, not `failed`; no alert spam.
- Clock skew across instances: eviction uses database `now()`, never the app clock.

## Acceptance criteria

- [ ] Migration `025` applies; the claim query uses `FOR UPDATE SKIP LOCKED`.
- [ ] `content.cache.lookup` counters and latency histogram appear in `/api/v1/status`.
- [ ] Hit rate on the tutoring golden set is reported before and after the warmer; the
      after number is ≥ 90% and recorded in the PR.
- [ ] Speculative-waste ratio is reported per session and aggregated; a test drives it above
      40% and sees the alert.
- [ ] A killed process resumes its queued jobs on restart, proven by a test that persists a
      job, drops the queue, and re-creates the service.
- [ ] Turn p95 does not rise with warming enabled, measured by P1-14 spans on the golden set.
- [ ] Eviction never deletes a row; evicted items are excluded from lookup but present in
      golden replay.
- [ ] Warming for a capped child produces no `ai_generation_log` row for that child.
- [ ] No warmed item reaches a child without a `GatePass` — the gate-invocation counting test
      from P1-06 is extended to the warm path.

## Verification

```bash
npm run test -w @aria/api -- content/cache content/pregeneration
npm run golden:tutoring -w @aria/api -- --report cache
npm run golden:content -w @aria/api
```

## References

- `master-plan.md` §4.1 (latency rule), §4.5, §11, §13 Phase 7
- `cloud-model-layer.md` §6, §9
- P0-20, P1-14, P7-01
