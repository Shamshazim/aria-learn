# P0-25 — What the child sees when the network fails

| | |
|---|---|
| **Phase** | 0 — Foundation |
| **Track** | Frontend + Backend |
| **Depends on** | P0-09, P0-13, P0-20 |
| **Blocks** | Phase 0 exit |
| **Parallel-safe with** | P0-21, P0-22 |
| **Size** | S |

## Why

Going cloud-only made network failure a normal condition. A child hitting a spinner, a stack
trace or a vendor name is a product failure, not an infrastructure one. This ticket is the
last layer of `cloud-model-layer.md` §8: after retry, fallback and cache, say it plainly.

## Scope

### Build
The end-to-end degraded experience: cached content first, then one plain sentence, plus
recovery when the connection returns.

### Do not build
No offline mode. Aria needs internet and we never imply otherwise.

## Design

Backend: routing (P0-13) raises a typed exhaustion error; the content path (P0-20) first
serves verified cached or fallback content. Only when both are impossible does the API return
a typed `service_unavailable` code. **The API never composes the child's sentence** — the
copy belongs to the UI, so it can be band-appropriate.

Frontend:

```
apps/web/src/features/session/
  components/ConnectionNotice.tsx     the child-facing message, one per band
  model/connection-state.ts           online | degraded | offline, and recovery
  copy/failure.copy.ts                the exact wording, per band
```

The sentence, from the plan: *"Aria can't reach her brain right now. Check the internet and
try again in a minute."* Early band says it more simply and speaks it when Phase 2 lands.

Rules:
- **No vendor name, no model name, no status code, ever.** The parent view may show detail;
  the child never does.
- Degraded mode is visible but calm — the child keeps working on cached content and is told
  only when nothing is possible.
- Recovery is automatic and visible: when the connection returns, the session resumes where
  it stopped, without the child re-entering anything.
- No spinner, and no message implying it is the child's fault.

## Acceptance criteria

- [ ] With the provider forced to fail, a session continues on cached and fallback content
      with no visible error.
- [ ] With cache and fallback also empty, the child sees exactly the plain sentence for their
      band, and nothing else.
- [ ] No vendor name, model name, status code or stack trace can appear in the child UI,
      proven by a test that fails the build if one does.
- [ ] Restoring the connection resumes the session automatically, and the child loses no work.
- [ ] Axe passes on the degraded and failed states; the message is announced politely.
- [ ] An e2e test covers fail → degraded → recover.

## Verification

```bash
npm run test -w @aria/web
npm run e2e -- failure
```

## References

- `cloud-model-layer.md` §8.4, `master-plan.md` §4.1
