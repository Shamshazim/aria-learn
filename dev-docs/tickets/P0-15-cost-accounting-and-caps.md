# P0-15 — Cost accounting, the AI log and the per-student cap

| | |
|---|---|
| **Phase** | 0 — Foundation |
| **Track** | Backend |
| **Depends on** | P0-04, P0-13 |
| **Blocks** | P0-21, P0-24 |
| **Parallel-safe with** | P0-14, P0-16, P0-17 |
| **Size** | M |

## Why

Every token is now money, and cost per child per month decides whether the product exists at
a consumer price. Instrument it on day one, not after the first surprising invoice.

## Scope

### Build
Migration `002` for `ai_generation_log`, cost computation in the adapters, the logging
repository and service, and the per-student daily spend cap.

### Do not build
No dashboards. A query and a test are enough this phase.

## Design

Migration `002_ai_generation_log.sql` — created with the cost columns present, because this
is a new database and there is no `ALTER` to write:

```sql
CREATE TABLE ai_generation_log (
  id            UUID PRIMARY KEY,
  student_id    UUID REFERENCES student(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  endpoint_name VARCHAR(64)  NOT NULL,
  model         VARCHAR(128) NOT NULL,
  tier          VARCHAR(16)  NOT NULL,
  prompt_name   VARCHAR(64),
  prompt_version VARCHAR(16),
  tokens_in     INTEGER NOT NULL,
  tokens_out    INTEGER NOT NULL,
  latency_ms    INTEGER NOT NULL,
  cost_usd      NUMERIC(10,6) NOT NULL DEFAULT 0,
  cached        BOOLEAN NOT NULL DEFAULT FALSE,
  ok            BOOLEAN NOT NULL
);
CREATE INDEX idx_ai_log_student_day ON ai_generation_log (student_id, created_at);
```

```
apps/api/src/ai/cost/
  cost.calculator.ts     tokens + endpoint prices -> costUsd. Pure, tested.
  spend.service.ts       today's spend per student, cap check, cap-trip event
  cost.types.ts
apps/api/src/repositories/
  ai-generation-log.repository.ts
```

- `LlmResponse` carries `endpointName` and `costUsd`, computed by the adapter from the
  endpoint's `cost-per-mtok-*` values. Cost is `NUMERIC`, never a float column.
- Every call is logged — success and failure, cached and uncached. A cached hit logs with
  `cached = true` and `cost_usd = 0`, so the cache's saving is measurable.
- **The log row never contains the prompt body, the response text, a name or an email.**
- The per-student daily cap comes from config. When it trips: Aria moves to cached content
  and **we** are alerted, not the child. The child's experience does not change.
- Provide `spend.service.ts` queries for cost per student per day and per month, and one
  npm script that prints them.

## Acceptance criteria

- [ ] Migration `002` applies cleanly and cascades from `student`.
- [ ] Cost is computed correctly for both adapters, proven against fixed token counts.
- [ ] Every provider call produces exactly one log row, including failures and cache hits.
- [ ] No log row or log line contains prompt text, response text, a name or an email.
- [ ] The cap trips at the configured value, switches the caller to cached content, and
      emits an operator alert — and the child sees no error.
- [ ] `npm run cost:report -w @aria/api` prints cost per student per day and per month.
- [ ] Cost per child per month is derivable from the table with one SQL query, documented in
      the module header.

## Verification

```bash
npm run test -w @aria/api -- ai/cost
npm run db:migrate -w @aria/api && npm run cost:report -w @aria/api
```

## References

- `cloud-model-layer.md` §9
- `master-plan.md` §13 Phase 0, Phase 7
