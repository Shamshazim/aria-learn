# P0-27 — Voice protocol amendment (P0-02 follow-up)

| | |
|---|---|
| **Phase** | 0 — Foundation |
| **Track** | Shared |
| **Depends on** | P0-02 |
| **Blocks** | P0-08, P0-09, P1-06, P2-02, P2-05, P2-06, P2-13 |
| **Parallel-safe with** | P0-05, P0-16, P0-22, P0-26 |
| **Size** | S |

## Why

P0-02 shipped the protocol before the realtime harness was designed. The design review of
[`realtime-agent-harness.md`](../realtime-agent-harness.md) (2026-08-23) found the envelope
has no way to know what the child actually received after a reconnect, no way to cancel
audio by identity, and no vocabulary for back-channels, media loss or client reflexes. These
are small, vendor-neutral, and far cheaper to add before P0-08/P0-09 render every move than
after.

## Scope

### Build
The additions below, in `packages/shared`, with a `PROTOCOL_VERSION` bump and updated
fixtures. Nothing else in P0-02 changes.

### Do not build
No transport, no outbox implementation (P2-13), no worker. This ticket is types, schemas
and fixtures only.

## Design

**Events (new kinds):** `BACKCHANNEL` (child sound during Aria's speech that is not an
interrupt), `SPEECH_STARTED` (client VAD start, for reflexes and telemetry), `MEDIA_LOST`,
`MEDIA_RESTORED`.

**Envelope (all events and moves), alongside `id`, `at`, `sessionId?`, `protocolVersion`:**

| Field | On | Meaning |
|---|---|---|
| `turnId` | both | groups the events and moves of one child turn |
| `connectionEpoch` | both | increments on every reconnect; a stale epoch is dropped |
| `serverSeq` | moves | per-session monotonic, server-assigned; the replay cursor |
| `causationId` | moves | the event `id` this move answers |
| `acknowledgedSeq` | events | the highest `serverSeq` the client has played/rendered |

**Moves:** `resumeOf?: MoveId` (a resumed sentence after a false interrupt),
`reflexes?: { duckOnSpeech: boolean }` (the client may *duck*, never cancel, on local VAD),
`generationId` on any move with `speech` (audio is cancelled by this id, not by timing),
`speech.assetId?` (reference to pre-synthesised audio), `vocabularyHint?: string[]` on
`ASK` / conversational listening moves only — **never** the passage on `LISTEN`.

Rules:
- All new fields are optional on the wire for one version so P0-08's scripted source keeps
  parsing; `serverSeq` and `generationId` become required in P2-02.
- The schema remains the single source of the type (`z.infer`), as in P0-02.

## Acceptance criteria

- [ ] Sixteen event kinds parse; the union rejects an unknown kind with a readable error.
- [ ] Every new envelope and move field has a schema, a type, and a fixture that round-trips.
- [ ] `PROTOCOL_VERSION` is bumped and a fixture from the previous version still parses.
- [ ] `vocabularyHint` is rejected by the schema on `LISTEN` moves.
- [ ] `reflexes` only admits `duckOnSpeech`; there is no `stopOnSpeech`.
- [ ] No file over 300 lines.

## Verification

```bash
npm run test -w @aria/shared
npm run typecheck
```

## References

- `realtime-agent-harness.md` — "Turn-taking for children" (protocol additions), "Worker
  topology" (outbox), "Phase 2 ticket delta"
- `master-plan.md` §4.1
