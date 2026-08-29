# P2H-15 — Speech-to-speech spike: can a realtime model carry the conversation?

| | |
|---|---|
| **Phase** | 2H |
| **Track** | Voice + BE |
| **Depends on** | P2H-05, P2H-06 (needs a real planner to call as a tool) |
| **Blocks** | P2H-13 (provider decision must include the S2S verdict) |
| **Parallel-safe with** | P2H-07, P2H-08, P2H-09, P2H-10, P2H-11 |
| **Size** | M |

## Why

Even with every other 2H ticket landed, the worker is an STT → LLM → TTS pipeline gated by a
silence detector. That ceiling is audible: Aria waits for the child to fully stop, every reply
carries a fixed ~0.7–1 s gap, and an interruption is "stop, then respond" rather than a fluid
overlap. Speech-to-speech (S2S) models (OpenAI Realtime, Gemini Live) do turn-taking, prosody and
backchannels natively and can remove that ceiling — but they never surface text before it is
spoken, which collides with the safety filter, quality gate and teaching policy that all operate
on text. This spike answers, with numbers, whether a **hybrid** is viable before P2H-07/08/09
harden the pipeline design further.

LiveKit stays. It is the transport and agent runtime for both designs; LiveKit Agents ships
S2S plugins, so this is a change to `apps/voice-worker/src/agent.ts`, not to the architecture.

## Scope

### Build / do
A time-boxed (≤ 2 weeks) prototype behind a worker flag, measured against the pipeline on the
same golden set, ending in a written go / no-go / hybrid recommendation.

1. **Prototype** `apps/voice-worker/src/session/s2s-session.ts`: a LiveKit Agents realtime
   session (`openai.realtime.RealtimeModel` and/or `google.beta.realtime.RealtimeModel`) selected
   by `VOICE_S2S_PROVIDER` env; `agent.ts` picks S2S or pipeline per session, default pipeline.
2. **Tools, not free chat**: the S2S model gets exactly three tools — `plan_next_move` (calls the
   P2H-06 planner and returns the allowed move + content), `check_answer` (existing scoring), and
   `end_turn`. The model may only voice content the planner returned; the persona prompt (P2H-03)
   says so explicitly. This keeps curriculum and memory in `packages/tutor`.
3. **Safety on the way out**: the vendor's output transcript stream is fed to the existing safety
   filter as it arrives; on a hit the worker cancels the response (`session.interrupt()`) and
   plays the P2H-11 recovery line. Measure how many words escape before the cut.
4. **Measurement harness** in `apps/voice-worker/src/golden/`: run S2S and pipeline over the
   P2H-13 golden set and record, per session: first-audio p95, silence-to-reply p95,
   interruption-to-silence p95, overlap/backchannel count, off-plan utterances (spoke content the
   planner did not return), safety escapes (words before cut), STT/EoT errors on child speech,
   cost per minute, and the P2H-14 human rubric score on 20 sessions per arm.
5. **Decision memo** `dev-docs/voice-s2s-decision.md`: results table, the recommendation
   (pipeline / S2S / hybrid = S2S for conversational turns, pipeline for scripted reading and
   assessment), and which of P2H-07/08/09 change if hybrid wins.

### Do not build
No production rollout. No new consent/retention flows beyond documenting what the S2S vendor
retains (feeds P2-14 / `voice-processor-map.md`). No changes to `packages/tutor` beyond a
tool-facing wrapper over the planner. No attempt to make the vendor voice match P2H-08's chosen
voice — note the mismatch as a cost of S2S.

## Design

```
apps/voice-worker/src/
  agent.ts                         branch on VOICE_S2S_PROVIDER; unchanged when unset
  session/s2s-session.ts           realtime session, tool registration, transcript tap
  session/s2s-tools.ts             plan_next_move / check_answer / end_turn adapters
  session/s2s-safety-tap.ts        output-transcript → safety filter → interrupt
  golden/s2s-compare.ts            runs both arms over the golden set, writes runs/<date>-s2s.json
dev-docs/voice-s2s-decision.md     memo
```

Guardrails that must hold in the prototype exactly as in the pipeline:
- Child audio never leaves the vendor set already in `voice-processor-map.md` without a map
  update; the child's name follows the P2H-04 rule.
- Every spoken sentence is still logged as a move in `move_outbox` (from the output transcript),
  so consolidation (P3) sees the same event shape.
- Silence handling stays ours: the P2H-01 escalation runs on top of the vendor's VAD, so a child
  who goes quiet gets the same ladder, not the vendor's default re-prompt.

### Edge cases
- Vendor drops the tool call and answers freely → counted as off-plan; > 2% off-plan is a
  fail regardless of latency.
- Vendor transcript lags audio by > 300 ms → safety tap cannot cut in time; record the lag,
  this alone can decide no-go.
- Vendor has no voice suitable for a 5-year-old → hybrid at best.
- Reading assessment (P4-04) needs word-level STT timings → S2S is never used for oral reading;
  the harness excludes those sessions from the S2S arm and says so.
- Cost/min > 3× pipeline → note against P7-04 budget; not automatically a no-go.
- Region/data-residency terms fail counsel review → excluded, same rule as P2H-13.

## Acceptance criteria

- [x] Flag-gated S2S session runs a full 2H nominal session end to end with the three tools (built; not yet run against a vendor).
- [ ] Both arms measured over the same golden set; table with CIs in `voice-s2s-decision.md`.
- [ ] Safety-escape words, off-plan rate and transcript lag reported per vendor.
- [ ] 20 human-rubric sessions per arm scored under the P2H-14 rubric.
- [ ] Written recommendation with the concrete list of P2H-07/08/09 changes if hybrid wins;
      P2H-13 provider decision references this memo.
- [x] With the flag unset, pipeline behaviour and tests are byte-for-byte unchanged.

## Status

**Prototype built 2026-08-28** on `feat/P2H-15-speech-to-speech-spike`; **not measured**.

Built: `VOICE_S2S_PROVIDER` flag (`openai` | `google`, key required at boot), realtime session
behind it (`session/s2s-session.ts`, LiveKit Agents realtime plugins), the three tools over the
existing move stream (`plan_next_move`, `check_answer` → `ANSWER` event, `end_turn`), the
output-transcript safety tap that cuts off-plan speech and counts escaped words, per-turn
metrics to a JSONL run log, the two-arm comparison with the ticket's rules and Wilson CIs, the
`voice:s2s-compare` CLI writing `dev-docs/golden/voice/runs/<date>-s2s.json`, and the memo
`dev-docs/voice-s2s-decision.md` with an empty results table. Pipeline unchanged with the flag
unset; the move stream gained an `answer` path and a serializer file split, tests green.

Left, and all of it needs a person and vendor keys: run the openai and google arms against
consented testers, score 20 sessions per arm under the P2H-14 rubric, run the compare, paste
the table into the memo, and write the recommendation. `transcriptLag` is recorded by the
metrics but the session does not yet measure it (needs audio-vs-transcript timestamps from
the vendor); until it is measured the compare reports it as a failure, by rule.

## Verification

```bash
VOICE_S2S_PROVIDER=openai npm run dev -w @aria/voice-worker
npm run voice:s2s-compare -w @aria/voice-worker -- --set dev-docs/golden/voice/set
npm test -w @aria/voice-worker
```

## References

- `master-plan.md` §11 (latency bars), §13 Phase 2 exit
- `voice-provider-decision.md`, `voice-processor-map.md`, `phase2-exit.md`
- LiveKit Agents realtime plugins (OpenAI Realtime, Gemini Live)
- P2H-01, P2H-03, P2H-05, P2H-06, P2H-07, P2H-08, P2H-09, P2H-13, P2H-14
