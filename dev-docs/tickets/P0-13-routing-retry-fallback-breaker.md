# P0-13 — Tier routing, retry, fallback and circuit breaker

| | |
|---|---|
| **Phase** | 0 — Foundation |
| **Track** | Backend |
| **Depends on** | P0-11, P0-12 |
| **Blocks** | P0-14, P0-15, P0-19, P0-24, P0-25 |
| **Parallel-safe with** | P0-16, P0-17 |
| **Size** | M |

## Why

Network failure is now a normal condition, not an exception. Without a circuit breaker a
vendor outage means every child waits the full timeout on every turn. This ticket is the
difference between "the internet hiccuped" and "Aria is broken today".

## Scope

### Build
`factory.ts` (endpoint → adapter at boot) and `routing.ts` (tier → endpoint, retry,
fallback, circuit breaker). After this, `routing.ts` is the **only** `LlmProvider` the rest
of the application ever sees.

### Do not build
No prompts, no business logic, no cost table. P0-14 and P0-15.

## Design

```
apps/api/src/ai/provider/
  factory.ts          builds one adapter per configured endpoint at boot
  routing.ts          the routed LlmProvider (thin orchestrator)
  resilience/
    retry.ts          exponential backoff + jitter, Retry-After aware
    circuit-breaker.ts  per-endpoint state machine: closed | open | half-open
    policy.ts         which AiError categories are retryable, which are fallback-worthy
```

The four layers, in order (`cloud-model-layer.md` §8):

1. **Retry.** On `429` and `5xx`: exponential backoff with jitter, **3 attempts maximum**,
   honouring `Retry-After` when the vendor sends one. Never retry a `4xx` other than `429` —
   a bad request stays bad.
2. **Fallback endpoint.** If the primary for a tier fails after retries, use the `fallback`
   named in `routing`, and log the switch. **Do not fall back on a content error** — only on
   a transport or availability error.
3. **Cache.** Handled by P0-20; routing exposes the failure cleanly so the caller can fall
   back to verified cached content.
4. **Say it plainly.** Routing raises a typed exhaustion error. The child-facing sentence is
   P0-25's job; routing never composes child-facing text.

Circuit breaker: after N consecutive failures on an endpoint, open it for a cooling period
and go straight to the fallback; a half-open probe closes it again on success. N and the
cooling period are configuration, not constants.

Every attempt, retry, fallback and breaker transition is logged with the endpoint name,
category and latency — never the prompt.

## Acceptance criteria

- [ ] `AiClient` and every future caller depend only on the routed provider; adapters are
      not importable outside `ai/provider/`, enforced by lint.
- [ ] `TEACH` and `FAST` route to their configured endpoints; a test proves the config
      decides, not the code.
- [ ] 429 retries up to 3 attempts with growing delay and honours `Retry-After`; a 400 does
      not retry.
- [ ] A primary failing all retries falls back and logs the switch; a content error does
      **not** fall back.
- [ ] N consecutive failures open the breaker; subsequent calls skip the endpoint entirely
      (proven by call count); the half-open probe closes it.
- [ ] Total failure raises a typed exhaustion error with no vendor name in its safe message.
- [ ] Timers are injected — the whole suite runs with fake time and no real sleeping.
- [ ] Changing the `TEACH` endpoint in `ai.yaml` changes which vendor is called, with zero
      code changes.

## Verification

```bash
npm run test -w @aria/api -- ai/provider
```

## References

- `cloud-model-layer.md` §6, §8, §13 step 4
