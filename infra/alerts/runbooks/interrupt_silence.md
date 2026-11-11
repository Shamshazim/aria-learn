# interrupt_silence — Aria talks over a child who is talking

**The bar.** `master-plan.md` §11: a child's interruption stops Aria's speech in under 250ms
at the 95th percentile. The alert fires when the share of interruptions over 250ms burns the
error budget too fast.

**What a child is experiencing.** They tried to say something and were talked over. This is
the single most machine-like failure the product has: a person who keeps talking while you
interrupt them is a person who is not listening, and a five-year-old reads that instantly.
It is also self-worsening — a child who is not heard says it again, louder.

**Where the number comes from.** The browser. `interrupt_silence_ms` is reported to
`POST /api/v1/telemetry/turn` by `apps/web/src/lib/observability/timing.ts`, measured from the
local VAD deciding the child has started speaking to the client observing the room go quiet.
The worker's own half — detection to cancel — is shorter than the promise by exactly the
network legs on either side, which is why this bar is not sourced from it.

## Check, in this order

1. **Is the report arriving?** `sum(rate(interrupt_silence_ms_count[10m]))`. Zero is a
   reporting outage, not a fixed bar. A drop to a very low rate can also mean children have
   stopped interrupting, which in this product is not good news either.
2. **Client or server?** The client ducks on local VAD before the server confirms, so the
   *audible* part should already be nearly instant. A large number here with a healthy worker
   cancel time means the duck is not happening: check that `startVad` is running, that the
   microphone track is published, and that `setRemoteVolume` is reaching the remote
   participants.
3. **Did the cancel reach the worker?** `SPEECH_STARTED` is published on the data channel and
   only when a generation is in flight (`generationRef` is non-null). If `generationId` is
   stale, the client is publishing interrupts the worker correctly ignores — which looks like
   a slow cancel and is actually a lost one.
4. **Is the gate holding segments?** P0-19's segment gate is what makes a cancel possible
   mid-turn: audio already handed to the speaker cannot be recalled. A large pre-buffered
   segment makes 250ms unreachable no matter how fast the cancel is. Check the segment size
   before looking anywhere else at the transport.
5. **Which band?** `sum by (band) (rate(interrupt_silence_ms_count[5m]))`. The early band has
   the shortest endpointing windows and is where this matters most.

## What to do

- Duck not happening: that is a client bug and the fastest fix available — the duck is what
  buys the time the server round trip costs.
- Segments too large: reduce the gated segment size for the affected band. Latency to silence
  is bounded below by how much audio is already in flight.
- Worker not cancelling by `generationId`: this is P2H-07's server-confirmed interrupt. A
  cancel that does not name a generation cancels the wrong turn after a reconnect.

**Do not** fix this by lowering the VAD threshold until any noise stops Aria mid-sentence. A
false interrupt on a sibling's voice or a passing truck is its own failure — P2-05's
false-interrupt resume exists because of it — and trading one for the other moves the problem
rather than solving it.
