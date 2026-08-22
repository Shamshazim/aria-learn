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

## Acceptance criteria

- [ ] A test proves that no raw streamed token reaches a child-facing consumer — this is
      named in the Phase 0 exit test and must be an explicit, named test.
- [ ] The segmenter handles "Dr.", "3.5", "..." and quoted sentences without splitting wrongly.
- [ ] A failing segment cancels the stream and triggers the fallback path.
- [ ] Whole-item kinds buffer completely and are gated as one item.
- [ ] An unknown content kind buffers rather than streams.
- [ ] Cancellation propagates: aborting the consumer aborts the vendor request.
- [ ] Lint forbids importing the raw provider stream outside `ai/`.

## Verification

```bash
npm run test -w @aria/api -- ai/streaming
```

## References

- `master-plan.md` §4.1 (safety rule), `cloud-model-layer.md` §10, §13 step 6
