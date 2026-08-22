# P1-07 — Content resolution inside the turn

| | |
|---|---|
| **Phase** | 1 |
| **Track** | Backend |
| **Depends on** | P0-18, P0-20, P1-06 |
| **Blocks** | P1-15 |
| **Parallel-safe with** | P1-08, P1-09, P1-10 |
| **Size** | M |

## Why

The latency rule — **the child never watches a model work** — is only real if generation
happens ahead of need and the cache is actually consulted first. This ticket connects P0-20's
primitives to a live turn and proves the wait disappears.

## Scope

### Build
The content resolution path used by `resolve-content.ts`, ahead-of-turn generation scheduling
tied to the session, and the personalisation split.

### Do not build
No new content kinds beyond what P0-17's skills need. No cache tuning — Phase 7.

## Design

```
apps/api/src/services/content/
  resolve.service.ts        cache -> generate -> gate -> regenerate once -> fallback
  ahead.service.ts          schedules item n+1 while the child works on item n
  personalise.ts            decides shareable vs personalised, and builds the prompt input
  select.ts                 which item to serve when several verified items match
```

Rules:
- **Cache first, always.** A verified item for this skill and band is served without a model
  call, and logged with `cached = true`.
- **Pre-generate n+1 during n.** Scheduled when the current item is delivered, cancelled when
  the session ends or the plan changes. It never blocks the turn and its failures are silent
  to the child.
- Personalised content — a word problem about the child's dog — is generated for that child,
  stored with `personalised_for`, and never served to anyone else.
- Selection avoids repeating an item the child saw recently; `times_used` is incremented on
  serve.
- An arbitrary child question may still need a model. In that case Aria **acknowledges
  immediately** and the first gated sentence follows as soon as it is safe. The UI never shows
  a model spinner and never claims zero latency.

## Acceptance criteria

- [ ] A warm cache serves an item with zero provider calls, proven by call count.
- [ ] Item n+1 is ready before the child finishes item n, in a timed test.
- [ ] Cancelling a session cancels pending pre-generation.
- [ ] A personalised item is never served to another student.
- [ ] Recently seen items are not immediately repeated.
- [ ] Child wait for content is under 1s at p95 in a local benchmark (`master-plan.md` §11).
- [ ] With the provider disabled, a full session runs on cache and fallback.

## Verification

```bash
npm run test -w @aria/api -- content
npm run bench:turn -w @aria/api
```

## References

- `master-plan.md` §4.1, §4.5, §11; `cloud-model-layer.md` §10
