# P2H-07 — Sentence-level streaming to speech

| | |
|---|---|
| **Phase** | 2H |
| **Track** | Backend + Voice |
| **Depends on** | P0-19, P2H-03 |
| **Blocks** | P2H-09, P5-03, P2H-13 |
| **Parallel-safe with** | P2H-04, P2H-05, P2H-06, P2H-08, P2H-12 |
| **Size** | M |

## Why

The worker speaks a move only after the whole text is generated, whole-gated and returned
(`agent.ts speakPending` → `session.say(text)`). `apps/api/src/ai/streaming/gated-stream.ts`
already gates sentence by sentence and is unused. The plan's latency rule: *begin the first
gated sentence as soon as it is safe*. This is the difference between a pause and a person.

## Scope

### Build
Wire the gated streamer into the turn path for both channels, stream segments to TTS in order,
cancel by `generationId`, enable preemptive generation with a proof it cannot bypass the gate,
and buffer whole items that need full verification.

### Do not build
No bridges (P2H-09). No speculative TTS of un-gated text, ever.

## Design

```
apps/api/src/services/content/
  turn-content.service.ts       returns AsyncIterable<GatedSegment> for streaming kinds
  streaming-kinds.ts            SAY, RETEACH, WELCOME, END, REVEAL(reasoning part) stream;
                                ASK, HINT, practice items are whole-item (answer key check)
apps/api/src/ai/streaming/
  gated-stream.ts               existing; add segment index, generationId, isLast
  segment.types.ts              GatedSegment { generationId, index, text, speech, isLast }
apps/api/src/controllers/
  voice.controller.ts           worker-turn endpoint streams segments (NDJSON) instead of one move
  session.controller.ts         text turn streams segments over SSE; falls back to one move
apps/voice-worker/src/session/
  move-stream.ts                consumes segments; yields per-segment text to the LLM node
  segment-order.ts              reorders/dedupes by (generationId, index); drops after cancel
apps/voice-worker/src/agent.ts  preemptiveGeneration: { enabled: true, preemptiveTts: false }
apps/web/src/features/session/
  sources/http-source.ts        SSE segment consumer; renders sentences as they pass
  model/session-machine.ts      currentMove.text grows by segment; expects set on isLast
packages/shared/src/protocol/realtime.ts   MOVE_SEGMENT message + schema
```

**Ordering and cancel**
- Segments carry `(generationId, index)`; the worker speaks index `n` only after `n-1`.
- Barge-in confirmed by the server (P2-05/06) cancels `generationId`: the api stops
  generating, the worker discards queued segments, `session.say` is interrupted. Late segments
  for a cancelled generation are dropped by `segment-order.ts`.
- `preemptiveGeneration` may start the harness on a partial transcript; the harness's draft
  path (P1-06) yields segments only after each passes the gate; `preemptiveTts: false`
  because TTS of a draft would be audible waste — measured before enabling later.

**Whole-item buffering**: kinds in the whole-item list are gated as a unit and emitted as a
single segment with `isLast: true`. A streaming kind whose *last* segment fails the gate emits
a reviewed closing sentence (from P2H-11 fallback data) so the child never hears a half-thought.

**Text channel**: the UI shows each sentence as it arrives with the existing "Aria is
thinking" indicator until the first segment; no spinner (P0-25 rule).

### Edge cases
- First segment passes, second fails, regeneration of the second passes → spoken in order,
  regeneration bounded to one attempt per segment.
- Model emits a very long sentence (> band limit) → level check fails that segment → regenerate.
- Sentence boundary inside a number ("3.5") or abbreviation ("Dr.") → boundary detector in
  gated-stream uses `spokenForm` aware splitting; fixtures.
- Network hiccup between api and worker mid-stream → worker times out at 2× the segment gate
  budget, emits `MEDIA_LOST`-style resume via the move outbox (P2-13) with the last index.
- Reconnect during a stream → outbox replays only un-acknowledged segments; duplicates by
  (generationId,index) are dropped.
- Child interrupts after segment 2 of 5 → segments 3–5 never spoken; the session_event stores
  the spoken prefix with `truncatedAt: 2`.

## Status (2026-08-25)

- **Complete pending review** on `feat/P2H-07-sentence-streaming`; no PR yet. Built on top of
  `docs/harness-review-fixes`, because P2H-03 (a dependency) is not on `main` yet.
- Done: `MOVE_SEGMENT` and the two turn-frame unions in the protocol; a `respond-stream` prompt
  (the same situation, plain prose, because JSON cannot be cut at a full stop); the gated
  streamer numbering its segments; a `RespondStreamer` seam so a content service can stream
  without ever seeing an `LlmRequest`; a per-session segment bus; SSE on the text turn and
  NDJSON on the worker turn, both opt-in by `Accept` and both parsed against the channel's own
  frame schema on the way out; segment ordering, deduplication, gap recovery and barge-in
  dropping in the worker; `preemptiveGeneration` on with `preemptiveTts` off; `truncatedAt`
  recorded on the event that interrupted; and incremental rendering in the web session.
- Two decisions the ticket did not settle:
  - **`isLast` is a hint, not the end of a turn.** A sentence can only be known to be the last
    one after the model stops, and holding each sentence until the next arrives would give back
    exactly the latency this ticket buys. So `isLast` is set where it is knowable without
    waiting — a whole-item segment, a flushed remainder, a reviewed closing sentence — and the
    closing `TURN_MOVES` frame is what authoritatively ends a turn. A stream that ends without
    it failed, and both clients treat it that way.
  - **Streaming is off unless something is listening.** A buffered client is still a supported
    client, and a turn that generates into nothing has spent a model call for no one.
- Two deviations from the Design, both deliberate:
  - **`ASK` never reaches the segment channel.** Every other model-written move does, including
    the whole-item ones — a `HINT` and an early-band answer arrive as exactly one gated segment,
    which is what the Design asks for. An `ASK` is different in kind: its words come from the
    verified content bank rather than the respond stream, so there is nothing here to gate and
    publishing the bank's text as a "segment" would only invite a client to render it twice. Its
    whole-item check is where the answer key is, in `turn-question.ts`.
  - **The idle timeout is not "2× the segment gate budget".** That is 60 ms, which is how long
    *gating* a sentence may take, not how long a model may take to write the next one; at that
    bound every answer would be abandoned mid-sentence. `STREAM_IDLE_TIMEOUT_MS` is 10 s — long
    enough for a slow tier, short enough to end the turn while the child is still waiting.
- Deliberately not built:
  - **Per-segment regeneration.** The ticket's edge case asks for one bounded retry of a sentence
    that failed the gate. That needs a second model call mid-utterance carrying the already-spoken
    prefix, and the child waits through all of it. The reviewed closing sentence is faster, safer,
    and already the rule for the last segment — so any failed segment ends the answer with it.
    Worth revisiting with real first-audio numbers.
  - **Segments in the move outbox.** The Design's reconnect story replays "only un-acknowledged
    segments"; the bus is per-request and in memory, so segments are not durable. What is durable
    is the move, and the recovery path now uses it: a stream that never reaches its closing frame
    leaves its moves marked unspoken, so the ordinary outbox replay says the whole answer rather
    than the half the child heard. Durable segments would need a table and an acknowledgement
    cursor of their own, which no acceptance criterion asks for.
- Remaining: the **first-audio p95 report** needs a live provider run (P2H-13 sets the bar).
  `npm run voice:golden` fails on `unreviewedSpokenTeachingCount: 1`, which it also does on
  `main` — a pre-existing gap in that fixture, not a regression from this ticket.

## Acceptance criteria

- [x] First audio starts before the model finishes generating a 4-sentence SAY (test with a
      slow fake provider; first `say` call time < full generation time).
      `ai/streaming/respond-stream.test.ts`.
- [x] No segment reaches TTS or the UI without a gate pass; the gate-invocation counter
      equals the segment count. The streamer releases nothing else, and the worker speaks only
      what it was sent.
- [x] `preemptiveGeneration` enabled with `preemptiveTts: false`. A draft still goes through
      the API, which releases a sentence only after it passes the gate, so a failed one is never
      sent and never spoken.
- [x] Out-of-order and duplicate segments are reordered/dropped; a cancelled generation's
      late segment is dropped. `session/segment-order.test.ts`.
- [x] Barge-in mid-stream: no further segments spoken, the in-flight request is aborted so the
      API stops generating, and the stored event carries `truncatedAt` — a count of what was
      heard, so "interrupted after segment 2 of 5" reads as 2.
- [x] Whole-item kinds emit exactly one segment, with `isLast` set — `HINT` and every early-band
      answer, end to end through the turn path. `ASK` is excluded on purpose; see Status.
- [x] Text channel renders segments incrementally. `features/session/render/streaming.test.tsx`.
- [ ] Voice golden run reports first-audio p95 (P2H-13 sets the bar). Needs a live provider.

## Verification

```bash
npm run test -w @aria/api -- streaming
npm run test -w @aria/voice-worker
npm run test -w @aria/web -- http-source
npm run voice:golden -w @aria/voice-worker
```

## References

- `master-plan.md` §4.1 latency rule, safety rule
- `realtime-agent-harness.md` — "Gated segments as the LLM stage", "Preemptive generation"
- P0-19, P2-04, P2-13
