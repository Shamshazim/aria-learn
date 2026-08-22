# P0-24 — Endpoint health checks and status route

| | |
|---|---|
| **Phase** | 0 — Foundation |
| **Track** | Backend |
| **Depends on** | P0-13, P0-15 |
| **Blocks** | — |
| **Parallel-safe with** | P0-19 … P0-23 |
| **Size** | S |

## Why

A missing key or a dead endpoint must be discovered at boot, by us — not at 4pm, by a child.
`cloud-model-layer.md` §13 makes this the last step of the model layer for a reason: it is
what turns a configuration mistake into a loud, immediate failure.

## Scope

### Build
`health.ts`: one cheap call per routed endpoint at boot, failing loudly, plus an operator
status route reporting endpoint health, breaker state and today's spend.

### Do not build
No dashboard, no alerting integration. Log loudly and expose the route.

## Design

```
apps/api/src/ai/provider/health.ts       startup probe per routed endpoint
apps/api/src/routes/status.routes.ts     operator route, not public
apps/api/src/controllers/status.controller.ts
apps/api/src/services/status.service.ts
```

- At boot, one minimal completion per **routed** endpoint (primary and fallback). Unreferenced
  endpoints are not probed.
- A failure is fatal in production and a loud warning in development, so a laptop without a
  Groq key still runs.
- `GET /api/v1/status` (operator-only) reports, per endpoint: configured, reachable, last
  probe latency, circuit-breaker state, consecutive failures — plus today's total spend and
  the number of students at their cap.
- **The route never returns a key, a base URL with credentials, or a prompt.** Endpoint names
  and vendor-neutral state only.
- The child-facing app never calls this route. Failure text for children is P0-25.

## Acceptance criteria

- [ ] Boot probes every routed endpoint exactly once and logs a one-line result each.
- [ ] A dead routed endpoint fails startup in production with the endpoint name.
- [ ] In development the same case warns and the process continues.
- [ ] `/api/v1/status` reports health, breaker state and today's spend.
- [ ] The response contains no key, credential or prompt, proven by a test.
- [ ] The probe's token cost is logged like any other call (P0-15) and is negligible.

## Verification

```bash
npm run test -w @aria/api -- ai/provider/health status
curl -s localhost:3000/api/v1/status | jq
```

## References

- `cloud-model-layer.md` §13 step 8, §4 rule 2
