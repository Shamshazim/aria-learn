# P0-06 — Bring the student session UI forward

| | |
|---|---|
| **Phase** | 0 — Foundation |
| **Track** | Frontend |
| **Depends on** | P0-05 |
| **Blocks** | P0-07, P0-08 |
| **Parallel-safe with** | P0-02, P0-03, P0-04 |
| **Size** | L |

## Why

`legacy/frontend/src/session/` is the only implementation that carries forward. Its age-band
design, its class-first entry and its refusal to show a child a menu were deliberate product
decisions and they still hold. This ticket moves that visual and experiential starting point
into `apps/web` so it can be seen running before anything beneath it is replaced.

**"Carries forward" is not "frozen."** We do not redraw it without reason, but its
components, controls, layout, state machine and API contract all change in later tickets when
`master-plan.md` requires it. This ticket preserves the *look and the child experience*; it
does not preserve the architecture.

## Scope

### Build
A one-time copy of the session UI into `apps/web/src/features/session/`, restructured to the
frontend layering contract, compiling under strict TypeScript, running against local mock
data, with **no import of `legacy/` anywhere**.

### Do not build
- No new behaviour. Arrival, interruption and the new protocol are P0-08 and P0-09.
- No backend calls. Nothing in this ticket talks to a server.

### Deliberately left behind
| Legacy file | Why it does not come |
|---|---|
| `sources/replies.ts` | The `localReply()` regex that faked Aria talking in the browser. It is gap 2 in `master-plan.md` §3 — the exact defect the rewrite exists to end. |
| `sources/apiSession.ts` | Written against the old Java endpoints and the old quiz contract. A real source is written in P1-11 against the new protocol. |
| `useSpeech.ts` (as the voice system) | Copy it only as a temporary stub behind a port. Real voice is Phase 2. |

## Design

Source of the copy (read-only reference):
`legacy/frontend/src/session/` — `SubjectPicker.tsx`, `SessionPage.tsx`, `band.ts`,
`types.ts`, `subjects.ts`, `text.ts`, `useSession.ts`, `session.css`, `components/` (15
files), `layouts/` (3 files), `sources/mockSession.ts`, `sources/mockContent.ts`.

Destination:

```
apps/web/src/features/session/
  components/          the 15 presentational components, one per file
  layouts/
    EarlyLayout.tsx    TK–2: owl, speech bubble, huge tap tiles, star jar
    MiddleLayout.tsx   3–5: text and picture together, progress dots
    SeniorLayout.tsx   6–8: quiet and adult, segmented bar, work pad
  model/               logic extracted out of components — no JSX in here
  api/                 empty in this ticket; filled in P1-11
  styles/session.css   rebased onto the tokens from P0-05
  index.ts
apps/web/src/pages/
  SubjectPickerPage.tsx
  SessionPage.tsx      selects a layout from bandForGrade()
```

Changes required on the way in:
1. `band.ts`, and any band or grade vocabulary, is **deleted from the feature and imported
   from `@aria/shared`** (P0-02). There must be one definition of a band in the repo.
2. `SubjectPicker.tsx` and `SessionPage.tsx` referenced `../api` and `../auth`. Point them at
   the P0-05 client; where auth is required, take the student from a context with a fake
   provider for now and a `// P0-26` note.
3. `useSession.ts` keeps driving the UI **in this ticket only**, against `mockSession.ts`.
   P0-08 replaces it. Do not invest in it.
4. Any component over 300 lines is split. Any decision logic inside a component moves to
   `model/` and gets a unit test.
5. `session.css` is rebased onto `styles/tokens.css`: hard-coded colours and sizes become
   token references. Keep the three band visual languages exactly as they look today.
6. Every `any`, implicit or explicit, is removed.

## Acceptance criteria

- [ ] The class picker renders and navigates to a session.
- [ ] All three layouts render a full scripted session from `mockSession.ts` with no backend
      running.
- [ ] No file in `apps/web` imports from `legacy/`; the P0-01 lint rule proves it.
- [ ] `replies.ts` and `apiSession.ts` do not exist in `apps/web`.
- [ ] Band selection comes from `@aria/shared`, and no duplicate band table remains.
- [ ] Strict typecheck passes; no `any`; no file over 300 lines.
- [ ] Axe reports no violations in any of the three layouts.
- [ ] Every interactive control is reachable and operable by keyboard, with a visible focus
      state.
- [ ] The PR description lists every file that was changed on the way in and why.

## Verification

```bash
npm run typecheck && npm run lint
npm run dev -w @aria/web    # walk all three bands by hand
npm run test -w @aria/web
```

## References

- `rewrite.md` §2 — what survives, what changes, how to bring it forward
- `master-plan.md` §5 — what the child actually sees
