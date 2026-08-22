# P1-11 — The real tutor source in the browser

| | |
|---|---|
| **Phase** | 1 |
| **Track** | Frontend |
| **Depends on** | P0-08, P0-09, P1-05, P1-06 |
| **Blocks** | P1-15 |
| **Parallel-safe with** | P1-12, P1-13 |
| **Size** | M |

## Why

P0-08 proved the protocol against scripted scenarios. This ticket swaps the scripted source
for the real one. Because the UI depends on the `TutorSource` port and not on a backend
shape, this should change no component — and if it does, the port was wrong and we want to
find that out here.

## Scope

### Build
An HTTP implementation of `TutorSource` against `POST /session/turn`, session create/resume/
end wiring, and the visible tutor-state affordances backed by real timing.

### Do not build
No WebSocket or WebRTC. Phase 2. The port's async-iterable shape already accommodates it.

## Design

```
apps/web/src/features/session/
  api/
    session.api.ts        create, current, end, turn — one function each
    session.schemas.ts    zod parsing of every response, from @aria/shared
  sources/
    http-source.ts        implements TutorSource over session.api
    retry.ts              client-side retry for idempotent reads only
```

Rules:
- **No component changes should be required.** List any that were, and why, in the PR — that
  is design feedback on the protocol, not a footnote.
- Every response is parsed with the shared schema before it becomes state. A malformed
  response is a typed error, never a partial render.
- The scripted source stays, and stays wired for tests and for the P0-07 baseline. It is now
  the fixture, not dead code.
- `TutorStatus` reflects real state: thinking while a turn is in flight, listening when a
  `LISTEN` move is active, ready otherwise. **Still no spinner.**
- Resume on load: if `GET /session/current` returns an open session, the child continues
  where they were with no re-entry.
- Turn requests carry an abort signal; leaving the page aborts cleanly.

## Acceptance criteria

- [ ] A full session runs end to end against the real API in all three bands.
- [ ] Zero component files changed, or every change is justified in the PR.
- [ ] Malformed or unexpected responses surface as a typed error and the degraded experience
      from P0-25, never a crash.
- [ ] Reloading mid-session resumes exactly where the child was.
- [ ] The scripted source still drives the tests and the visual baseline.
- [ ] No `fetch` outside `api/`; no business decision inside a component.
- [ ] An e2e test covers create → several turns → wrong answer → hint → end.

## Verification

```bash
npm run dev   # api + web
npm run e2e -- session
```

## References

- `master-plan.md` §10, §13 Phase 1; `rewrite.md` §2 step 5
