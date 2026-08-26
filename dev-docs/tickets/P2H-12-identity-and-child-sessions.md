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

- [x] Migration 009 applies; `child_session` rows are created on login and revoked on logout.
      `test/identity.repository.test.ts` against a real PostgreSQL.
- [x] Every student route rejects requests without a valid child session (router walk test).
      `src/routes/student-guard.test.ts` walks the mounted router and asserts on what it finds,
      so a route added later is checked without anybody remembering to list it.
- [x] Production boot with `demoStudentId` set fails; development with the flag works. It now
      takes *both* `NODE_ENV=development` and `ALLOW_DEMO_STUDENT=true` (`config/auth.ts`).
- [x] PIN: wrong 5 times → locked 15 min; correct after lock time → succeeds (fake clock).
      `auth/pin.service.test.ts`, and again through HTTP with real Argon2 in
      `test/identity.acceptance.test.ts`.
- [x] Picture login for early band; PIN for middle/senior; family-device mode skips both.
      The method is per child rather than per band — see the note below.
- [x] Idle 30 min → tutor session paused and child session ended; picker resume restores.
      Both halves: the middleware ends it on the next stale request, and a sweeper in
      `server.ts` ends the ones nobody comes back to.
- [x] Voice consent can only be granted by the parent; realtime negotiation without it → 403.
      `POST /parent/children/{id}/consent/voice` behind `parent-auth`; the negotiation check
      was already in `realtime.service.ts` and is unchanged.
- [x] Parent email never appears in any response served to a child route (fixture test).
      Asserted on the raw response text in both the route tests and the database acceptance
      test — `childSummarySchema` is strict, so there is no field for it to arrive in.
- [x] Web: parent sign-in → add child → child picker → PIN → arrival screen works end to end
      in a browser test. `apps/web/e2e/auth.spec.ts`.
- [x] P0-28 is marked delivered in README.

## Status

**Code complete 2026-08-25** on `feat/P2H-12-identity-and-child-sessions`.

Recorded numbers: `npm run typecheck` 0 errors, `npm run lint` 0 errors, `npm test` 1576 tests
across 216 files pass, `npx playwright test auth.spec.ts` 2 passed, no source file over 300
lines.

Decisions this ticket made that the plan left open, or read differently:

- **Login is per child, not per band.** The plan says "early band login is a picture sequence,
  PIN for middle/senior". A band is derived from a grade, and a nine-year-old who cannot read
  is not served by being told their band says otherwise, so the *parent* chooses the method and
  the picker reports which one this child has. Every band can do either.
- **Two children in one family may now share a name.** Migration 001 forbade it, for a stated
  reason: the parent and the child have to be able to tell the rows apart. Migration 009 drops
  that index and answers the same objection with a picture and a grade, because refusing an
  account to step-siblings called the same thing is the worse answer. What must still be
  distinct is name *and* picture — that pair is what the picker shows.
- **No Supabase SDK.** Two typed calls against Supabase's own auth endpoint instead. The SDK's
  job is session management — where a token is kept, when it refreshes, what else is stored —
  and those are exactly the decisions this ticket exists to make deliberately.
- **`student.settings` is one JSONB column**, parsed through one schema. It carries
  `shareFirstName`, `pronunciation` and `avatar`; the first two are wired all the way through
  (the model context and P2H-08's `PronunciationSource`, which was written waiting for it).
- **Credentials live in `child_credential`, beside the student rather than on it.** Every
  existing read of `student` would otherwise drag a password hash up through the mappers, and
  the lockout counters are written on failed logins — a hot path with no business touching the
  profile row.
- **A network failure is not a sign-out.** `identity.refresh()` returns `null` only on a 401.
  A child losing signal for ten seconds keeps their session; the server's own deadline decides.

Left open, and not fixable in this ticket:

- **Adult verification is "signed in", not P2-03's card check.** The consent record now says
  who granted it and which processor-map wording they were shown, and its
  `verificationReference` is `supabase-authenticated-parent` — which is true, and is weaker
  than P2-03 will eventually want. Strengthening it is a change to the verification, not to
  this schema.
- **"Family device" is a flag on the child, not on the device.** `child_credential.family_device`
  says "this child needs no PIN"; the spec says "the parent marks *the device* 'family
  device'". In practice the two nearly coincide, because a child can only sign in where their
  parent's own session is live — but a parent who marks it on the kitchen tablet has marked it
  on every tablet they are signed in on. A genuinely per-device flag needs a device registry,
  which is a concept this ticket was not asked to add; it is recorded here rather than faked.
- **Only this device notices a deleted Supabase account.** The web app renews the parent token
  before it lapses, and a refusal to renew clears the remembered parent and signs this device's
  child out. Sessions on *other* devices end when those devices next fail to renew. Ending them
  sooner needs a webhook from Supabase, which is a deployment concern rather than a code one.
- **Two e2e specs were already failing before this ticket** and still are, for reasons that
  have nothing to do with identity: `arrival.spec.ts` asserts a session URL that lost its
  shape when `voice=1` was added in `bdea10d`, and `failure.spec.ts` trips an axe
  colour-contrast rule on `.voice-controls__stop`. `phase1-session.spec.ts` needs a live API
  and times out without one. All three are recorded here rather than fixed, because each
  belongs to the ticket that owns the code it is about.

## Verification

```bash
npm run test -w @aria/api -- auth
npm run test -w @aria/web -- auth
npm run e2e -w @aria/web -- auth
```

## References

- `master-plan.md` §2, §12
- P0-26, P0-28, P2-03, P2-14

## What the review pass changed

Two reviews ran against `e01196c`, on the standards axis and the spec axis. What they found,
and what happened to it:

- **`endAllForParent` had no caller, and the Status section above claimed it did.** The rule
  it exists for — "a parent can revoke all child sessions" — was half built: the service and
  the repository could do it and nothing ever asked them to. There is now
  `POST /parent/sessions/revoke`, and signing the device out from the picker calls it, so
  handing a tablet back ends every session on the account rather than the one in front of you.
  The false sentence in this file was the worst part of the finding and is gone.
- **The parent's token was never renewed.** `SupabaseApi.refresh` was dead code, and both the
  picker and child login sit behind the parent's token — so about an hour after signing in, a
  family tablet stopped being able to sign a child in until a grown-up retyped a password.
  That is the opposite of the shared-tablet arrangement the ticket is built around. The
  session is now renewed five minutes before it lapses, and a refusal to renew is what this
  device makes of "the parent was deleted in Supabase".
- **`GET /auth/children` duplicated `GET /parent/children`.** One list, one route; the picker
  uses the one the Design block names.
- **The stale-device edge case had no test**, which the ticket asks for by name. There is one
  now, against a real database: one child's cookie cannot end another child's lesson, and the
  other child's lesson is still open afterwards.
- **`ParentPage` deep-imported four internals of `features/auth` and built a second api
  client.** The singletons moved to `app/services.ts`, which is where composition belongs, and
  the page now goes through the barrel like every other consumer.
- **Two barrels were wider than their consumers, and one export was unused.**
  `apps/api/src/auth/index.ts` no longer exports what nothing outside it imports, and
  `childLoginPatchSchema` is internal to its own module again.
- **The domain default lived in `schemas/`.** `DEFAULT_STUDENT_SETTINGS` moved next to the
  mapper that produces it, and `StudentSettingsPatch` is a domain type in `types/student.ts`;
  neither the repository nor the service reaches into an HTTP schema module now.
- **Six modules had no unit tests.** `secret-hasher` (against the real Argon2), `lib/tokens`,
  `useParentChildren`, `useIdleWatch`, `AddChildForm` and `ChildSettingsRow` do now.

Declined, with reasons:

- **Controllers re-parsing what `validate` middleware already checked.** It is the repo's
  existing idiom for recovering the type — `session.controller.ts` and `voice.controller.ts`
  do the same — and changing it is a tree-wide refactor, not this ticket's.
- **Migration 009 dropping `student_parent_display_name_key`.** Flagged as unrequested schema
  change; it is what makes the ticket's own edge case ("two children with the same first name
  under one parent") reachable at all, and the replacement index keeps the pair the picker
  actually shows unique.
