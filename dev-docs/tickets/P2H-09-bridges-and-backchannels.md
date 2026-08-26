# P2H-09 — Bridges and backchannels wired (closes P2-11)

|                        |                        |
| ---------------------- | ---------------------- |
| **Phase**              | 2H                     |
| **Track**              | Voice                  |
| **Depends on**         | P2H-07, P2H-08         |
| **Blocks**             | P2H-13, P2H-14         |
| **Parallel-safe with** | P2H-10, P2H-11, P2H-12 |
| **Size**               | M                      |

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

- [x] `bridge.ts` is invoked in the worker path (`move-stream.bridge.test.ts` drives it through
      `handleTranscript`) and P2-11's row in BACKLOG is marked delivered.
- [x] Skip rules 1–6 each have a test; rule 1 uses a fake latency estimate.
- [ ] Seed texts reviewed by a human; review recorded in the PR; ≥ 8 per bucket per band. The
      counts, the non-committal rule and the length are enforced by test; **the human review
      has not happened** and no clip may be synthesised until it does.
- [x] `synth-bridges.ts` is idempotent (re-run creates no duplicate `speech_asset` rows).
- [x] A 30-turn bot session plays no clip twice within 10 turns (picker test with seed).
- [x] Bridge + segment seam: no overlapping `say` calls (worker test with fake session).
- [x] Voice golden run reports bridge counts and repeats.

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

## Status

**Code complete 2026-08-25** on `feat/P2H-09-bridges-and-backchannels`, except the two things
that are not code: the human review of the seed lines, and the recordings themselves.

### What is built

The decision lives in `packages/voice`: `bridge-buckets.ts` maps an intent to one of the five
buckets, `bridge-rules.ts` is skip rules 1–6, `bridge-picker.ts` is the seeded choice with its
recency window and repetition meter, and `bridge.ts` is the single call the worker makes.
`apps/api` holds the library — a `speech_asset` repository, a service that serves one band and
voice at a time, seed texts per bucket per band, and `synth-bridges.ts`. `apps/voice-worker`
fetches its band's clips once at session start, plays one through `session.say(text, { audio })`
when a final transcript opens a gap, and holds the turn's first sentence until the clip ends.

### Deviations from the Design, and why

- **The intent vocabulary is P2H-05's, not `bridge.ts`'s old one.** The ticket's rule 5 is
  written in `ANSWER` / `QUESTION` / `CONFUSED` / `CHAT` / `UNCLEAR`, which is exactly the
  intent set P2H-05 shipped. `classifyBridgeByRule` and `BridgeIntent` were a second, worse
  vocabulary for the same thing and are deleted. `@aria/voice` now depends on `@aria/tutor`
  for the type; the dependency is acyclic and the classification the worker runs is the same
  pure rules pass the API runs, with no answer key.
- **`SWITCH` / `BREAK` are read as the _previous_ move's kind.** They are move kinds, not
  intents, and the next move does not exist when the bucket is chosen — waiting for it is the
  wait this ticket exists to cover. A child answering after Aria said "let's switch" gets a
  `transition`.
- **Rule 4's crisis clause is only partly enforceable here.** `PERSONAL_INFO` and
  `STOP_REQUEST` are both visible to the worker's rules pass and both skip. Crisis detection
  lives in `apps/api/src/safety/crisis/`, which the worker cannot import and must not
  duplicate, so a crisis turn may still get a bridge. Every bridge is non-committal by test,
  so the worst case is "okay" in front of a safety response that is itself unchanged.
- **Rule 6's early-band clause is not written twice.** "At most every other turn" is the
  cadence rule 2 already enforces on every band; `bridge-rules.ts` says so where the rule
  would otherwise sit.
- **No `duration_ms` column.** Clip length is derived from the PCM byte count, so P2H-09 needs
  no migration and does not take the `009` number P2H-12 owns.
- **Recency is per bucket, not overall.** The Design says "not in last 6 used" and the
  acceptance says "no clip twice within 10 turns"; those are only compatible if the six are
  counted within the bucket. With eight clips a bucket and a bridge every other turn, the
  earliest a clip can return is fourteen turns.

### Blocked on people, not on code

- **The listening review of the seed lines.** 120 lines are written and machine-checked; none
  has been heard. `synth-bridges.ts` refuses a wet run until a synthesiser is configured, so
  nothing can be recorded before the review.
- **P2-01, the provider decision.** No voice ids exist, so `--dry-run` plans against
  placeholders and prints which bands are unconfigured.
- **An object store.** `SpeechAudioPort` is wired to a port that reports itself unavailable,
  which is the documented "library missing → no bridges, warning at boot" path.

### Not persisted: an unhealthy asset

A clip whose audio 404s is dropped for the life of the session and logged, and the picker never
offers it again. Marking the row itself unhealthy needs a column, and a 404 is not a review
outcome, so `review_status` is left alone.

## Verification run 2026-08-25

```
npm run typecheck        0 errors
npx eslint apps packages 0 errors
npx vitest run           1152 tests / 170 files pass
npm run synth:bridges -w @aria/api -- --dry-run   120 clips planned across 3 bands
npm run voice:golden -w @aria/voice-worker        reports bridgesPlayed / bridgeRepeats /
                                                  bridgesByBucket; still exits 1 on the
                                                  pre-existing unreviewedSpokenTeachingCount
```
