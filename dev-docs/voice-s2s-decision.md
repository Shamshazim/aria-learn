# Speech-to-speech spike: pipeline, S2S, or hybrid (P2H-15)

Status: **prototype built, not measured**. Recommendation: **insufficient evidence** — the
pipeline stays until the table below is filled from real sessions.

## What was built

A worker flag, `VOICE_S2S_PROVIDER=openai|google`, that carries every session on that worker
on the vendor's realtime model instead of the STT → harness → TTS pipeline. With the flag
unset nothing in this path loads; the pipeline and its tests are unchanged.

| Piece                                          | Where                                             |
| ---------------------------------------------- | ------------------------------------------------- |
| Flag, model, voice, run log                    | `apps/voice-worker/src/session/s2s-config.ts`     |
| Realtime session, tools wired, silence ladder  | `apps/voice-worker/src/session/s2s-session.ts`    |
| `plan_next_move` / `check_answer` / `end_turn` | `apps/voice-worker/src/session/s2s-tools.ts`      |
| Output-transcript safety tap                   | `apps/voice-worker/src/session/s2s-safety-tap.ts` |
| Per-turn measurement → JSONL run log           | `apps/voice-worker/src/session/s2s-metrics.ts`    |
| Two-arm comparison and the rules               | `apps/voice-worker/src/golden/s2s-compare.ts`     |

The model is a mouth and an ear, not a tutor. It gets exactly three tools; `plan_next_move`
and `check_answer` are adapters over the same move stream the pipeline uses, so the planner,
grading, memory and the P2H-01 silence ladder all stay in the API and `packages/tutor`, and
every sentence still reaches `move_outbox` through the API. The persona prompt says the model
may only voice what a tool returned.

**Safety on the way out.** The API gates every planned sentence; the tap's rule is that
anything the model says that is not in the plan is cut (`session.interrupt`) and the recovery
line is voiced. Off-plan means "not gated", whether or not it was harmful, so this is stricter
than a filter on the way out and it is what produces the _safety escape words_ figure.

## How to run it

```bash
# one worker on the s2s arm, logging every closed turn
VOICE_S2S_PROVIDER=openai VOICE_S2S_RUN_LOG=/tmp/s2s-openai.jsonl npm run dev -w @aria/voice-worker

# the pipeline arm is a voice:golden result; compare and write dev-docs/golden/voice/runs/<date>-s2s.json
npm run voice:s2s-compare -- --pipeline dev-docs/golden/voice/results/<candidate>.json --s2s /tmp/s2s-openai.jsonl
```

The compare command exits non-zero while the evidence is insufficient.

## Rules (fixed in code, quoted here)

- Off-plan rate above **2%** fails S2S regardless of latency.
- Output-transcript lag p95 above **300 ms** means the tap cannot cut in time: no-go on its own.
  An unmeasured lag counts as a failure, never as zero.
- Cost per turn above **3×** the pipeline is noted against P7-04; it does not decide.
- **20** rubric-scored sessions per arm (P2H-14 rubric) before any recommendation.
- Oral reading (P4-04) needs word timings and is never on the S2S arm; turns that reach it are
  reported, not hidden.
- The best S2S can win is **hybrid**: S2S for conversational turns, pipeline for scripted
  reading and assessment.

## Results

| metric                          | pipeline | s2s (openai) | s2s (google) |
| ------------------------------- | -------- | ------------ | ------------ |
| first audio p95 (ms)            | not run  | not run      | not run      |
| silence → reply p95 (ms)        | not run  | not run      | not run      |
| interruption → silence p95 (ms) | not run  | not run      | not run      |
| overlaps / turn                 | not run  | not run      | not run      |
| off-plan rate [95% CI]          | —        | not run      | not run      |
| safety escape words             | —        | not run      | not run      |
| transcript lag p95 (ms)         | —        | not run      | not run      |
| STT / end-of-turn error rate    | not run  | not run      | not run      |
| cost / turn (USD)               | not run  | not run      | not run      |
| rubric mean (20 sessions)       | not run  | not run      | not run      |

Paste the table `voice:s2s-compare` prints; do not edit numbers by hand.

## Known costs of S2S, before any number

- **Voice mismatch.** The vendor voice is not the P2H-08 band voice. A hybrid would switch
  voices between conversational and scripted turns unless one vendor can do both.
- **Prosody.** `@aria/voice` prosody markers are for a TTS engine; the S2S arm renders plain
  text and relies on the model's own delivery.
- **Retention.** Child audio reaches a second vendor. `voice-processor-map.md` carries the
  row; counsel review is required before any child who is not a consented tester hears it.

## If hybrid wins

- P2H-07: sentence streaming stays for the pipeline arm; the S2S arm needs a turn-level
  "plan then voice" contract instead — `plan_next_move` already is that contract.
- P2H-08: the band voice has to be chosen from voices the S2S vendor offers, or the mismatch
  accepted for conversational turns only.
- P2H-09: bridges are unnecessary on the S2S arm (the model fills gaps natively); the bridge
  player stays pipeline-only.

## What this memo waits on

Twenty rubric-scored sessions per arm from consented testers, run through
`voice:s2s-compare`. P2H-13's provider decision references this memo and must not be recorded
before the table is filled.
