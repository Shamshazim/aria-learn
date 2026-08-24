# P0-19 — Streaming with sentence-segment gating

| | |
|---|---|
| **Phase** | 0 — Foundation |
| **Track** | Backend |
| **Depends on** | P0-13, P0-18 |
| **Blocks** | P2 voice work |
| **Parallel-safe with** | P0-20, P0-21, P0-22 |
| **Size** | M |

## Why

Phase 2 voice needs streaming, and streaming is where the safety rule is easiest to break.
`master-plan.md` §4.1 is absolute: **raw model tokens never go straight to a child.**
Designing the gate now, with a test that proves it, is cheaper than retrofitting it around a
live audio pipeline later.

## Scope

### Build
The segmenter and the gated release path: an internal stream is assembled into
sentence-sized segments, each segment passes the applicable checks before it is released to
any child-facing consumer, and whole-item content is buffered until the entire item passes.

### Do not build
No audio, no WebRTC, no transport. Phase 2. This ticket ends at a gated `AsyncIterable` of
released segments.

## Design

```
apps/api/src/ai/streaming/
  segmenter.ts          token chunks -> sentence-sized segments (handles abbreviations,
                        decimals, ellipses, quotes)
  segment-gate.ts       per-segment safety + level checks via P0-18
  gated-stream.ts       orchestrates: stream -> segment -> gate -> release
  policy.ts             which content kinds may stream and which must buffer whole
  move-plan.ts          validates the planner's structured move plan BEFORE any segment
                        is generated (amendment, below)
  spoken-form.ts        deterministic written -> spoken rewrite between gate and TTS
  types.ts
```

Rules:
- **Streaming may happen inside the service; release is gated.** A complete sentence-sized
  segment must pass the applicable correctness, level and safety checks before it is
  displayed or spoken.
- **Content requiring whole-item verification is buffered until the entire item passes.** A
  multiple-choice question, an arithmetic problem and a decodable passage are whole-item;
  free explanation is segment-gated. `policy.ts` decides, by content kind, and defaults to
  buffering when the kind is unknown.
- A segment that fails cancels the remainder of the stream and falls back — a child never
  sees half a sentence retracted.
- The gated stream is the **only** exported way to consume `LlmProvider.stream()`. The raw
  stream is not importable outside `ai/`, enforced by lint.

**Amendment 2026-08-23** (from the `realtime-agent-harness.md` design review):
- **A whole-move check runs before the first segment is generated.** Individually
  acceptable sentences can add up to a wrong explanation, and a spoken sentence cannot be
  withdrawn. The planner first emits a small structured *move plan* — move kind, whether
  the child's answer was judged correct, a one-line teaching claim, the verified content
  referenced, the permitted response type for the band — and `move-plan.ts` validates it
  (deterministic checks + the P0-16 checker where arithmetic is involved) before streaming
  starts. Segment gating is the final safety check, not the main correctness mechanism.
- **Written and spoken forms are separate.** `spoken-form.ts` is a pure, table-driven
  rewrite of fractions, operators, phoneme notation (`/k/`), letter names vs sounds,
  place-value digits, abbreviations and punctuation. The gate checks the written form;
  the spoken form is what TTS receives (P2-04); captions show the written form.
- **Per-segment gate latency for streaming kinds is ≤ 30 ms** and is recorded as
  `gate_ms` on the gated stream (P1-14 consumes it).

## Acceptance criteria

- [ ] A test proves that no raw streamed token reaches a child-facing consumer — this is
      named in the Phase 0 exit test and must be an explicit, named test.
- [ ] The segmenter handles "Dr.", "3.5", "..." and quoted sentences without splitting wrongly.
- [ ] A failing segment cancels the stream and triggers the fallback path.
- [ ] Whole-item kinds buffer completely and are gated as one item.
- [ ] An unknown content kind buffers rather than streams.
- [ ] Cancellation propagates: aborting the consumer aborts the vendor request.
- [ ] Lint forbids importing the raw provider stream outside `ai/`.
- [ ] A move plan that fails validation produces no segments — asserted by a test that
      counts segmenter invocations.
- [ ] `spokenForm()` has a unit test per table case for the initial reading and
      arithmetic scope (`3/4`, `/k/`, `12` in place value, `Dr.`, `e.g.`).
- [ ] `gate_ms` is emitted per streamed segment.

## Verification

```bash
npm run test -w @aria/api -- ai/streaming
```

## References

- `master-plan.md` §4.1 (safety rule), `cloud-model-layer.md` §10, §13 step 6
- `realtime-agent-harness.md` — "Segment pipelining", "What is spoken is checked"
