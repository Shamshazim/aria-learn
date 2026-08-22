# P0-20 — Verified content cache and ahead-of-turn generation

| | |
|---|---|
| **Phase** | 0 — Foundation |
| **Track** | Backend |
| **Depends on** | P0-04, P0-18 |
| **Blocks** | P0-25, P1-07 |
| **Parallel-safe with** | P0-19, P0-21, P0-22 |
| **Size** | M |

## Why

Two of the plan's hardest requirements depend on this one module: **the child never watches
a model work**, and **a child can keep working through a short outage**. These are
reliability primitives in Phase 0, not Phase 7 optimisations. It is also the largest single
lever on cost.

## Scope

### Build
Migration `003` for `content_item`, the cache repository and service, the personalisation
boundary, and the ahead-of-turn generation interface.

### Do not build
No cross-child sharing strategy beyond the rule below, and no cache tuning. Phase 7 optimises
what exists here.

## Design

Migration `003_content_item.sql`:

```sql
CREATE TABLE content_item (
  id            UUID PRIMARY KEY,
  kind          VARCHAR(32) NOT NULL,       -- question | explanation | passage | ...
  skill_code    VARCHAR(32) NOT NULL,
  band          VARCHAR(16) NOT NULL,
  body          JSONB       NOT NULL,
  quality_score NUMERIC(4,3),
  source_model  VARCHAR(128),
  prompt_name   VARCHAR(64),
  prompt_version VARCHAR(16),
  personalised_for UUID REFERENCES student(id) ON DELETE CASCADE,  -- NULL = shareable
  verified_at   TIMESTAMPTZ NOT NULL,
  times_used    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_content_lookup ON content_item (skill_code, band, kind)
  WHERE personalised_for IS NULL;
```

```
apps/api/src/content/
  cache/
    content-cache.service.ts   lookup, store, mark used
    eligibility.ts             what may be shared vs what stays with one child
  pregeneration/
    pregenerate.service.ts     while the child works on n, prepare n+1
    queue.ts                   bounded in-process queue, with backpressure
  fallback/
    fallback.data.ts           the small verified fallback bank
    fallback.service.ts
apps/api/src/repositories/content-item.repository.ts
```

Rules:
- **Only gated content is ever stored.** Writing to the cache without a P0-18 pass is
  impossible by construction — the store method takes a `GateVerdict.pass` token, not a
  boolean.
- **Shareable vs personalised.** A verified Grade 2 regrouping problem is good for every
  Grade 2 child. A word problem about Ali's dog Rocky is generated for Ali and stays with
  Ali: `personalised_for` is set and it is never served to another child. A test must prove
  cross-child leakage is impossible.
- Pre-generation runs behind the child's thinking time, is bounded, and never blocks the
  turn. A pre-generation failure is invisible to the child.
- The fallback bank is small, verified, checked in, and covers at least one item per skill in
  the P0-17 inventory, so an outage still gives the child something real to do.

## Acceptance criteria

- [ ] Migration `003` applies and cascades from `student`.
- [ ] Un-gated content cannot be stored — the type system prevents it.
- [ ] A personalised item is never returned for another student, proven by a test.
- [ ] A cache hit records `cached = true` and `cost_usd = 0` in the P0-15 log.
- [ ] Pre-generation prepares the next item while the current one is in play, bounded by
      queue size, and its failures never surface to the caller.
- [ ] With the provider forced to fail, a session continues on cached and fallback content.
- [ ] Every skill in the P0-17 inventory has at least one verified fallback item.

## Verification

```bash
npm run test -w @aria/api -- content
```

## References

- `master-plan.md` §4.5 (caching), §4.1 (latency rule), §13 Phase 0
- `cloud-model-layer.md` §8.3, §9, §10
