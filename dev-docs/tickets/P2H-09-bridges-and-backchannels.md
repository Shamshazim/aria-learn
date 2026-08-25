# P2H-09 — Bridges and backchannels wired (closes P2-11)

| | |
|---|---|
| **Phase** | 2H |
| **Track** | Voice |
| **Depends on** | P2H-07, P2H-08 |
| **Blocks** | P2H-13, P2H-14 |
| **Parallel-safe with** | P2H-10, P2H-11, P2H-12 |
| **Size** | M |

## Why

`packages/voice/src/bridge.ts` decides when a short acknowledgement should cover the gap
before Aria's real answer; nothing calls it. A human tutor says "mm, let me think" — a
machine goes silent. With P2H-07 the gap is short; bridges cover the remainder and make an
unavoidable wait feel attended to.

## Scope

### Build
The v1 bridge system from P2-11: a reviewed clip library per band and voice in `speech_asset`,
a bucket picker driven by intent, skip rules, seam quality, and an audible-repetition meter.

### Do not build
No personalised bridges, no preloading beyond the session's own band, no bulk generation
(P2-11b, only on evidence).

## Design

```
packages/voice/src/
  bridge.ts                     existing decision; inputs gain intent + expectedFirstAudioMs
  bridge-buckets.ts             'acknowledge' | 'thinking' | 'encourage' | 'transition' | 'confirm-heard'
  bridge-picker.ts              picks a clip: bucket, band, voice, not in last 6 used, seeded
  bridge-rules.ts               skip rules (below)
apps/api/src/services/voice/
  bridge-library.service.ts     loads clips for (band, voice) from speech_asset; hash-addressed
  bridge-seed/                  reviewed text per bucket per band (≥ 8 per bucket) + synth script
apps/api/src/scripts/
  synth-bridges.ts              synthesises seed clips with the band voice; writes speech_asset
apps/voice-worker/src/session/
  bridge-player.ts              plays a clip via session.say(audio) with allowInterruptions
  move-stream.ts                asks the picker after a child final transcript, before segments
observability: bridge_played_total{bucket,band}, bridge_skipped_total{rule}, bridge_repeat_total
```

**Skip rules** (`bridge-rules.ts`):
1. No bridge when the first gated segment is expected within 400 ms (P2H-07 measured
   estimate from the last 5 turns).
2. Never two bridges in a row; never a bridge after a bridge-only turn.
3. Never while the child is speaking (`SPEECH_STARTED` since the transcript).
4. Never for `PERSONAL_INFO`, crisis or `STOP_REQUEST` turns (their responses are fixed and instant).
5. Bucket by intent: ANSWER → `acknowledge` ("okay…", "let's see…"); QUESTION → `thinking`;
   CONFUSED → `encourage`; CHAT → `acknowledge`; UNCLEAR → `confirm-heard`; SWITCH/BREAK →
   `transition`.
6. Early band gets a bridge at most every other turn; senior band only `thinking`.

**Seam quality**: a bridge must end before the first segment starts; if the segment arrives
while the clip plays, the clip finishes (clips ≤ 1.2 s) and the segment starts — no cut.
Clips are synthesised with the same voice as the session so the seam is not audible.

**Repetition meter**: `bridge_repeat_total` increments when the same clip plays twice within
10 turns; a session-level report in the voice golden run lists repeats.

### Edge cases
- Library missing for (band, voice) → no bridges, warning at boot, not an error.
- Clip fails to play (asset 404) → skip, log, mark asset unhealthy.
- Barge-in during a bridge → bridge cancelled like any speech; no `INTERRUPT` penalty.
- Very fast child (answers before Aria's segment) → rule 3 prevents overlap.
- Voice provider changes → library re-synthesised by script; hash includes voice id.
- Text channel → bridges are voice-only; the UI shows the "thinking" indicator instead.

## Acceptance criteria

- [ ] `bridge.ts` is invoked in the worker path (coverage shows it) and P2-11's row in
      BACKLOG can be marked delivered.
- [ ] Skip rules 1–6 each have a test; rule 1 uses a fake latency estimate.
- [ ] Seed texts reviewed by a human; review recorded in the PR; ≥ 8 per bucket per band.
- [ ] `synth-bridges.ts` is idempotent (re-run creates no duplicate `speech_asset` rows).
- [ ] A 30-turn bot session plays no clip twice within 10 turns (picker test with seed).
- [ ] Bridge + segment seam: no overlapping `say` calls (worker test with fake session).
- [ ] Voice golden run reports bridge counts and repeats.

## Verification

```bash
npm run test -w @aria/voice -- bridge
npm run test -w @aria/voice-worker -- bridge-player
npm run synth:bridges -w @aria/api -- --dry-run
npm run voice:golden -w @aria/voice-worker
```

## References

- `realtime-agent-harness.md` — "The bridge system"
- BACKLOG P2-11
- `master-plan.md` §4.1 latency rule
