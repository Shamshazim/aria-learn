# P0-02 — Shared tutor protocol (events, moves, bands)

| | |
|---|---|
| **Phase** | 0 — Foundation |
| **Track** | Shared |
| **Depends on** | P0-01 |
| **Blocks** | P0-08, P0-09, P0-14, P0-22, P1-04, P1-06, P1-11 |
| **Parallel-safe with** | P0-03, P0-05, P0-06 |
| **Size** | M |

## Why

The old UI spoke `start / answer / hint / next / ask` — a quiz contract. It cannot express a
tutor who arrives first, speaks, listens, gets interrupted, or decides to stop. The new
protocol is the spine of the product: the frontend renders it, the backend produces it, and
both golden sets are written against it. It must exist before either side is built.

## Scope

### Build
The full `TutorInputEvent` and `TutorMove` unions from `master-plan.md` §4.1, their zod
schemas, the band vocabulary, and the session/turn envelope types — in
`packages/shared`, with no dependency on React, Express or a database driver.

### Do not build
- No transport. How a move reaches the browser (HTTP now, WebRTC in Phase 2) is not this
  ticket.
- No persistence shapes. Table rows are P1-01.
- No legacy `SessionStep` / `StepResult` types. They are not carried forward.

## Design

```
packages/shared/src/
  index.ts                 the public surface, re-exports only
  band/
    band.ts                Band = 'early' | 'middle' | 'senior'; bandForGrade()
    band.data.ts           grade -> band table
  protocol/
    events.ts              TutorInputEvent union
    moves.ts               TutorMove union
    content.ts             MoveContent: text, choices, visual, passage, workpad
    session.ts             SessionId, TurnRequest, TurnResponse envelopes
    schemas/
      events.schema.ts     zod, one schema per event kind + the union
      moves.schema.ts      zod, one schema per move kind + the union
      session.schema.ts
  version.ts               PROTOCOL_VERSION, sent on every envelope
```

Events (`kind` discriminant), from the plan: `ARRIVED`, `SUBJECT_CHOSEN`, `ANSWER`,
`QUESTION`, `CONFUSED`, `SPEECH_PARTIAL`, `SPEECH_FINAL`, `SILENCE`, `INTERRUPT`, `PAUSE`,
`RESUME`, `LEAVE`.

Moves (`kind` discriminant): `WELCOME`, `CHECK_IN`, `RECOMMEND`, `SAY`, `SHOW`, `ASK`,
`LISTEN`, `HINT`, `RETEACH`, `REVEAL`, `PRAISE`, `SWITCH`, `BREAK`, `END`.

Shape rules:
- Every event and move carries `id`, `at` (ISO-8601 UTC), `sessionId?` (arrival has none
  yet) and `protocolVersion`.
- Every move carries `speech: { text: string; ssml?: string } | null` so Phase 2 can speak
  any move without a protocol change, and `display` content typed per kind.
- A move that expects a response declares `expects: 'choice' | 'text' | 'number' | 'speech'
  | 'drag' | 'none'` — the UI derives its input control from this, never from the move kind.
- Nothing in the protocol is band-specific. The band selects a *rendering*, never a
  different set of moves.
- Every schema is exported alongside its type, and the type is `z.infer` of the schema so the
  two can never drift.

## Acceptance criteria

- [ ] All twelve events and all fourteen moves exist as a discriminated union with a zod
      schema each, plus a union schema that parses any valid instance.
- [ ] `type X = z.infer<typeof xSchema>` for every protocol type — no hand-written duplicate.
- [ ] `bandForGrade()` covers TK through Grade 8 and is table-driven with unit tests.
- [ ] `packages/shared` has zero runtime dependencies other than zod.
- [ ] Round-trip test: every fixture parses, serialises and re-parses identically.
- [ ] An unknown `kind` fails parsing with a readable error.
- [ ] No file over 300 lines; unions that would exceed it are split per kind group.

## Verification

```bash
npm run test -w @aria/shared
npm run typecheck
```

## References

- `master-plan.md` §4.1 (the event and move tables), §5
- `rewrite.md` §2 ("What survives and what does not"), §5 step 3
