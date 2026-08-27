# P6-01 — Parent app shell

| | |
|---|---|
| **Phase** | 6 |
| **Track** | Frontend + Backend |
| **Depends on** | P2H-12 |
| **Blocks** | P6-02, P6-05, P6-08, P6-09 |
| **Parallel-safe with** | P6-03, P6-04, P6-06, P6-07 |
| **Size** | L |

## Why

`master-plan.md` §7: a parent does not want a dashboard, they want to know their kid is okay.
Today there is no parent-facing surface at all — a parent cannot add a child, cannot give
voice consent without a developer, and has never been told in plain words that Aria uses a
cloud model (§12.1). Every other Phase 6 ticket renders inside this shell.

## Scope

### Build
A parent area of `apps/web` under `/parent/*`: sign in / sign up through the identity port
from P2H-12, the children list, add / edit / archive a child, the consent and controls page
(§7 "Controls"), and the plain-language cloud disclosure shown **before** the account is
created. Backend: `GET/POST /api/v1/parent/children`, `PATCH /parent/children/{id}`,
`GET/PUT /parent/children/{id}/controls`.

### Do not build
No digest, ask, goals, transcripts, memory view (P6-02…P6-05). No teacher surface (P6-08).
No billing (X-02). No charts, ever.

## Design

```
apps/web/src/features/parent/
  pages/       SignIn.tsx, SignUp.tsx, Disclosure.tsx, Children.tsx, ChildForm.tsx,
               Controls.tsx
  components/  ChildCard.tsx, ConsentToggle.tsx, DisclosureText.tsx, ControlRow.tsx
  hooks/       useParentSession.ts, useChildren.ts, useControls.ts
  api/         parent.client.ts          (typed fetch, no business logic)
  model/       controls.ts               (types + defaults, no React)
  copy/        disclosure.en.ts          (reviewed wording, one file, versioned)
apps/api/src/
  routes/parent.routes.ts
  controllers/parent/children.controller.ts, controls.controller.ts
  services/parent/children.service.ts, controls.service.ts
  repositories/student-controls.repository.ts
  schemas/parent/children.schema.ts, controls.schema.ts
  db/migrations/017_student_controls.sql
```

```sql
student_controls  student_id UUID PK REFERENCES student(id) ON DELETE CASCADE,
                  session_minutes_max SMALLINT NOT NULL,          -- band default if null on read
                  allowed_hours JSONB NOT NULL DEFAULT '[]',      -- [{dow, from, to}] local time
                  subjects JSONB NOT NULL,                        -- subset of reading/writing/arithmetic
                  voice_enabled BOOLEAN NOT NULL DEFAULT true,
                  microphone_enabled BOOLEAN NOT NULL DEFAULT true,
                  personalisation_enabled BOOLEAN NOT NULL DEFAULT true,
                  shareable_fact_kinds JSONB NOT NULL DEFAULT '[]', -- which relationship-fact kinds may cross the vendor boundary
                  tutor_register VARCHAR(16) NOT NULL DEFAULT 'default',
                  disclosure_version VARCHAR(16) NOT NULL,        -- which wording the parent accepted
                  disclosure_accepted_at TIMESTAMPTZ NOT NULL,
                  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
student           + archived_at TIMESTAMPTZ NULL
```

Rules:
- The disclosure page states what is sent, to which vendor, and why (§12.1). It is the first
  screen after choosing "create account"; sign-up cannot complete without
  `disclosure_accepted_at`. Wording lives in one versioned file; a changed version re-prompts.
- There is no control that turns cloud inference off while implying the tutor still works
  (§7). Turning off `personalisation_enabled` stops relationship facts reaching prompts; it
  does not stop inference. The UI says so in one sentence.
- `shareable_fact_kinds` is honoured by P0-23's scrubber and P1-10 retrieval: a kind not in
  the list never reaches `ScrubbedContext`. The default is empty — nothing optional is shared
  until the parent opts in.
- Voice consent is the existing `voice_consent` row (P2-03); `ConsentToggle` writes through
  `services/voice/consent.service.ts`, never a second table. Withdrawal closes open voice
  sessions before returning (`voice-processor-map.md`).
- Every parent route is authorised by parent id from the session; a child id not owned by
  that parent is a 404, not a 403 (no existence leak).
- The controls service is the only reader of `student_controls`; the tutor loop (P1-06)
  consumes it through a `SessionLimits` port so policy stays in `packages/tutor`.
- Archiving a child hides it from the picker and stops sessions; it deletes nothing (P6-06
  deletes).

### Edge cases
- Parent with zero children → the children page is the add-child form, not an empty state.
- Two children with the same name → rejected by the existing unique index; UI shows the error.
- `allowed_hours` empty → no restriction. Overlapping windows → merged server-side.
- `session_minutes_max` below the band minimum (early 8, middle 15, senior 20) → rejected.
- `subjects` empty → rejected; a child must have at least one class to pick.
- Disclosure version bumped while a parent is signed in → next parent page load re-prompts;
  child sessions continue on the old acceptance until the parent accepts.
- Parent deletes their account mid-child-session → P2H-12 revocation ends the session; the
  child sees the P0-25 failure screen, not an error.
- Voice consent withdrawn while a voice session is live → session closed within one turn.
- Unverified email → parent area is read-only until verified; child sessions unaffected.

## Acceptance criteria

- [ ] Sign-up cannot complete without accepting the current disclosure version; the accepted
      version and time are stored.
- [ ] A parent can add, edit, archive and list children; archived children do not appear in
      the child picker and cannot start a session.
- [ ] Every control in §7 "Controls" is present, persisted and read by the tutor loop through
      a port; a test proves `session_minutes_max` ends a session.
- [ ] `shareable_fact_kinds` gates what the scrubber emits, proven by a test with a fact kind
      absent from the list.
- [ ] Voice consent toggling uses `voice_consent`; withdrawal closes a live voice session.
- [ ] A parent cannot read or write another parent's child (404, tested).
- [ ] Migration `017` applies and cascades from `student`.
- [ ] No chart, percentage or leaderboard appears anywhere in the parent area.
- [ ] Disclosure wording reviewed by counsel; review recorded in the PR.

## Verification

```bash
npm run test -w @aria/api -- parent
npm run test -w @aria/web -- parent
npm run typecheck && npm run lint
```

## References

- `master-plan.md` §7, §10, §12.1, §12.2, §14
- `rewrite.md` §6 (identity decision), P0-26, P2H-12, P2-03, P0-23
