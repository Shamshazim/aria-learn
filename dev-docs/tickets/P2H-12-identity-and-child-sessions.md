# P2H-12 — Identity and child sessions (completes P0-28)

| | |
|---|---|
| **Phase** | 2H |
| **Track** | Frontend + Backend |
| **Depends on** | P0-26 (decision), P0-04, P2-03 |
| **Blocks** | P2H-13, P6-01, P6-06, X-02 |
| **Parallel-safe with** | P2H-01 … P2H-11 |
| **Size** | L |

## Why

`apps/api/src/phase1/student-access.runtime.ts` returns a demo student in dev and `null` in
production: every student route 503s in prod. There is no parent account, no child login, no
authorization on any route. P0-26 decided Supabase Auth for adults and Aria-owned child rows.
Nothing end to end exists until this is built.

## Scope

### Build
Parent auth (Supabase), child rows linked to a parent, a shared-device child picker with
PIN/picture login, a child session cookie, authorization middleware on every student route,
parental voice-consent UI writing `voice_consent`, logout and idle expiry. Production never
uses the demo stub.

### Do not build
No teacher accounts (P6-08). No billing (X-02). No parent dashboard beyond the child list and
consent (P6-01).

## Design

```
apps/api/src/
  auth/
    supabase-jwt.verifier.ts        verifies parent JWT (JWKS cached, clock skew ±60s)
    parent-auth.middleware.ts       req.parent = { id, email } or 401
    child-session.service.ts        issues/rotates/revokes child session tokens (httpOnly cookie,
                                    signed, 12h max, 30min idle, bound to parent id + child id)
    child-auth.middleware.ts        replaces student-access.runtime; req.student from cookie
    pin.service.ts                  4-digit PIN hashed (argon2), 5 attempts then 15-min lock
  routes/auth.routes.ts             POST /auth/child/login (childId, pin|pictureSeq)
                                    POST /auth/child/logout   POST /auth/child/refresh
  routes/parent.routes.ts           GET/POST /parent/children, PATCH /parent/children/{id}
                                    (name, grade, band, settings: share_first_name, pronunciation, pin)
                                    POST /parent/children/{id}/consent/voice
  controllers/, services/, repositories/, schemas/ for the above (one file each)
  db/migrations/009_identity_complete.sql   parent.supabase_user_id UNIQUE, child_pin_hash,
                                    child_session (id, student_id, parent_id, issued_at, expires_at,
                                    revoked_at, device_label), voice_consent gains granted_by parent_id
  phase1/student-access.runtime.ts  deleted; config.demoStudentId only honoured when
                                    NODE_ENV=development AND ALLOW_DEMO_STUDENT=true
apps/web/src/
  features/auth/                    parent sign-in (Supabase UI), child picker, PIN pad, picture login
  features/auth/model/              session state, idle timer, refresh
  app/router.tsx                    guards: /student/* requires child session; /parent/* parent
  api/client.ts                     credentials: 'include'; 401 -> child picker
```

**Rules**
- Every `/student/*` and `/session/*/realtime` route runs `child-auth.middleware`; a route
  without it fails a lint test that walks the router.
- A child session token is bound to (parent, child); a parent can revoke all child sessions.
- Voice consent (P2-03) is granted by an authenticated parent only; the consent record
  stores who, when, which processor map version. The realtime negotiation checks it.
- Early band login is a picture sequence (tap 3 of 6 pictures) set by the parent; PIN for
  middle/senior. Both are optional if the parent marks the device "family device" — then the
  picker alone suffices (shared-tablet reality).
- Idle expiry: 30 min without an event ends the child session and the tutor session (PAUSE
  then LEAVE); resume from the picker restores the tutor session (`/session/current`).
- Nothing identifying leaves the api: the web app never receives the parent's email on a
  child screen; the child picker shows first names and pictures only.

### Edge cases
- Parent JWT valid but no `parent` row → auto-create parent row on first authenticated call.
- Parent deleted in Supabase → JWT verification fails → all child sessions revoked at next
  refresh.
- Two children with the same first name under one parent → picker shows picture + grade.
- PIN lockout → child sees "Ask a grown-up" (fixed text), never a countdown.
- Child session cookie present but tutor session belongs to another child (stale device) →
  403 and picker; test.
- Clock skew on the device → server-side expiry only; the client timer is advisory.
- Demo student in production → refused at boot with a clear error.
- Multiple tabs → one child session; second tab shares the cookie; logout in one logs out all.
- Consent withdrawn mid-session → realtime tokens stop being issued; current room ends within
  the token TTL; text mode continues.

## Acceptance criteria

- [ ] Migration 009 applies; `child_session` rows are created on login and revoked on logout.
- [ ] Every student route rejects requests without a valid child session (router walk test).
- [ ] Production boot with `demoStudentId` set fails; development with the flag works.
- [ ] PIN: wrong 5 times → locked 15 min; correct after lock time → succeeds (fake clock).
- [ ] Picture login for early band; PIN for middle/senior; family-device mode skips both.
- [ ] Idle 30 min → tutor session paused and child session ended; picker resume restores.
- [ ] Voice consent can only be granted by the parent; realtime negotiation without it → 403.
- [ ] Parent email never appears in any response served to a child route (fixture test).
- [ ] Web: parent sign-in → add child → child picker → PIN → arrival screen works end to end
      in a browser test.
- [ ] P0-28 is marked delivered in README.

## Verification

```bash
npm run test -w @aria/api -- auth
npm run test -w @aria/web -- auth
npm run e2e -w @aria/web -- auth
```

## References

- `master-plan.md` §2, §12
- P0-26, P0-28, P2-03, P2-14
