# P2H-13 — Voice golden set, browser suite and the provider decision

| | |
|---|---|
| **Phase** | 2H |
| **Track** | QA |
| **Depends on** | P2H-01, P2H-02, P2H-05, P2H-07, P2H-08, P2H-09, P2H-12, P2-12 |
| **Blocks** | P2H-14, P3-* (Phase 3 does not start until Phase 2 exits) |
| **Parallel-safe with** | P2H-10, P2H-11 |
| **Size** | M |

## Why

`dev-docs/phase2-exit.md` is **not passed** and `voice-provider-decision.md` is blocked on
measured, human-labelled evidence. The runners exist (`voice:golden`, `evaluatePhase2Exit()`)
but have never been fed real evidence. Phase 3 may not start until they are.

## Scope

### Build / do
Collect a human-labelled voice set, run every candidate provider over it, run the real-browser
suite, record the P2-01 decision, fill `phase2-exit.md`, and make `evaluatePhase2Exit()` pass
or print exactly what is missing.

### Do not build
No new runners. No new providers unless a candidate fails the bar.

## Design

```
dev-docs/golden/voice/
  set/                           ≥ 200 child utterances across bands (recorded with consent, or
                                 licensed child-speech corpus), each with: transcript, end-of-turn
                                 label, intent label, expected move, reading passage where relevant
  labels.md                      labelling protocol, two labellers, disagreement resolution
  runs/<date>-<provider>.json    runner output per candidate
dev-docs/voice-provider-decision.md   filled: table per candidate (WER, EoT accuracy ± CI,
                                 interruption p95, first-audio p95, e2e p95, false-teaching count,
                                 reviewed output score, retention terms, cost/min); decision
dev-docs/phase2-exit.md          each bullet with evidence link, date, who observed
apps/voice-worker/src/golden/
  report.ts                      add confidence intervals (Wilson) if missing; bridge/repeat counts
apps/web/e2e/voice/              real-browser suite: mic permission, sound check, autoplay
                                 unlock via class selection, barge-in silence < 250ms, reconnect,
                                 captions, mute, device swap, text fallback
```

**Exit evidence required** (from `phase2-exit.md`, each must be a recorded artefact):
1. An independent full session by a five-year-old who cannot read (observed, parent consented,
   notes + timing, no identifying data in the repo).
2. Zero false praise / incorrect reteach on the human-labelled core set.
3. Zero low-confidence reading observations updating durable skill state (DB assertion after
   the run).
4. Human approval of spoken teaching correctness for the initial scope (teacher sign-off).
5. Passing `voice:golden` and browser suite.
6. Processor/retention verification and counsel sign-off (P2-14 records).

**Bars** (`master-plan.md` §11): first audio after activation < 1 s p95; interruption stops
speech < 250 ms p95; end-of-turn ≥ 98% is a target — report the CI and decide whether the set
supports calling it.

### Edge cases
- A candidate provider fails safety/retention terms → excluded regardless of accuracy.
- Labellers disagree > 10% → protocol revised before results count.
- Real-browser suite flaky on CI → runs on a dedicated runner with a real audio device;
  flakiness rate reported, not hidden.
- Child observation cannot be scheduled → Phase 2 stays "not passed"; this ticket still
  delivers every other artefact and lists that one as missing.
- `evaluatePhase2Exit()` represents missing counts as missing, never zero (existing rule) —
  do not "fix" it to pass.

## Acceptance criteria

- [ ] Labelled set ≥ 200 utterances with protocol and inter-labeller agreement recorded.
- [ ] Every candidate STT/TTS/turn-detector run over the same set; results table in
      `voice-provider-decision.md`; decision recorded with rationale.
- [ ] Browser suite passes on the reference devices (Chromebook, iPad Safari, Windows Chrome).
- [ ] p95 first-audio and interruption numbers recorded against the bars.
- [ ] `phase2-exit.md` lists evidence for every bullet or names precisely what is missing.
- [ ] `evaluatePhase2Exit()` output committed as `dev-docs/golden/voice/runs/phase2-exit.json`.

## Verification

```bash
npm run voice:golden -w @aria/voice-worker -- --set dev-docs/golden/voice/set
npm run e2e -w @aria/web -- voice
npm run phase2:exit -w @aria/voice
```

## References

- `phase2-exit.md`, `voice-provider-decision.md`, `voice-processor-map.md`
- `master-plan.md` §11, §13 Phase 2 exit
- BACKLOG P2-01, P2-10, P2-12
