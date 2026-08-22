# P1-05 — Session lifecycle endpoints

| | |
|---|---|
| **Phase** | 1 |
| **Track** | Backend |
| **Depends on** | P1-01 |
| **Blocks** | P1-06, P1-11 |
| **Parallel-safe with** | P1-04, P1-07 |
| **Size** | M |

## Why

A session has to be creatable, resumable and endable before the tutor loop has anywhere to
run. Resume matters more than it looks: children close tabs, and a tutor who forgets what you
were doing five minutes ago is the failure this whole product is against.

## Scope

### Build
`POST /session`, `GET /session/current`, `POST /session/end`, with auth-scoped access and the
resume path.

### Do not build
No turn handling — that is P1-06's `POST /session/turn`. No realtime negotiation — Phase 2.

## Design

```
apps/api/src/routes/student.routes.ts
apps/api/src/controllers/session.controller.ts       one handler per endpoint, thin
apps/api/src/schemas/session.schema.ts
apps/api/src/services/session/
  session.service.ts        create, resume, end
  resume.service.ts         rebuild client state from session_event
  end.service.ts            end reason, summary hook for P1-09
```

- `POST /session` takes the chosen subject, creates the session, and returns its **first
  moves** — the session begins with Aria speaking, never with an empty screen waiting for the
  child.
- `GET /session/current` returns the open session and enough recent events to restore the UI
  exactly where the child left it.
- `POST /session/end` records an end reason (`complete | break | child_left | timeout`) and
  triggers the consolidation hook (P1-09) asynchronously — ending must not wait on it.
- Every endpoint verifies the caller may act for this student. A student id in a body or a
  path is never trusted on its own.
- Session length limits per band (`master-plan.md` §5: 8–12, 15–20, 20–30 minutes) are policy
  values in config, and **Aria ends the session** — the child never has to decide to stop.

## Acceptance criteria

- [ ] Create, resume and end all work, with supertest coverage of success, validation failure
      and cross-student access denial.
- [ ] Creating a second session while one is open resumes the open one rather than erroring.
- [ ] Resume restores the UI state for a session interrupted mid-move, proven by a test.
- [ ] Ending is idempotent, and a second end does not overwrite the first end reason.
- [ ] Consolidation is triggered asynchronously and a failure there never fails the request.
- [ ] Band session limits come from config, not constants.

## Verification

```bash
npm run test -w @aria/api -- session
```

## References

- `master-plan.md` §5, §10, §13 Phase 1
