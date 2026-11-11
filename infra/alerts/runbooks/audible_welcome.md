# audible_welcome — Aria is slow to start talking

**The bar.** `master-plan.md` §11: after audio is activated, the welcome *starts* being spoken
in under 1s at the 95th percentile. The alert fires when the share of sessions over 1s burns
the error budget too fast.

**What a child is experiencing.** They tapped their class, the screen came up, and then
nothing happened. A five-year-old cannot read the interface, so until Aria speaks they have no
idea whether it is working — and the thing they do next is tap again.

**Where the number comes from.** The browser, not this service. `audible_welcome_ms` is
reported to `POST /api/v1/telemetry/turn` by `apps/web/src/lib/observability/timing.ts`,
measured from the moment `room.startAudio()` resolves to the first `playing` event on the
attached remote audio element. No server-side number is a substitute: the API's and the
worker's own halves are both shorter than the promise.

## Check, in this order

1. **Is the report even arriving?** `sum(rate(audible_welcome_ms_count[10m]))`. A fall to zero
   is a client that stopped reporting — a web deploy, a CSP change, a 4xx on the telemetry
   route — and is a *reporting* outage, not a latency one. Check
   `rate(client_timing_implausible_total[10m])` too: a spike there means measurements are
   arriving and being dropped as unbelievable, which usually means a timing bug in the client.
2. **Which band?** `sum by (band) (rate(audible_welcome_ms_count[5m]))`. The early band is the
   one that matters most and the one with the most pre-synthesised audio, so it should be the
   fastest. Early being the slowest points at the asset path, not at the model.
3. **Is it the worker or the vendor?** The worker's per-turn spans (P2H-07) split
   `speech_final → plan → first_gated_sentence → first_audio`. If `first_gated_sentence` is
   late, it is the model or the quality gate; if the gap between that and `first_audio` is
   late, it is TTS.
4. **Is the welcome being generated at all?** A cached, reviewed welcome clip should be playing
   for the early band. Check `rate(fallback_used_total[5m])` and the speech-asset cache hit
   rate: a cache miss turns a playback into a synthesis.
5. **Is the room connecting late?** `audio_unlocked_ms` (same route) is the time from the
   arrival painting to the browser permitting sound. It is not this bar, but a large value
   there alongside a large value here usually means one slow negotiation is being counted
   twice by a reader, not that the speech pipeline is slow.

## What to do

- TTS latency: P0-13's fallback should already be routing away from a slow vendor. If it is
  not, check the breaker state on the speech provider before changing anything else.
- Cache miss on the welcome: pre-generation (P0-20) is the fix, not a shorter welcome.
- A client that stopped reporting: fix the reporting. Do not silence the alert — a bar with no
  data looks exactly like a bar being met, which is the failure this SLO exists to prevent.

**Do not** make the number go down by having Aria say something generic first. A fast wrong
welcome is worse than a slow right one: the welcome is personalised from what happened last
session (P1-04), and that is the part a child notices.
