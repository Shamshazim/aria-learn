# Voice golden set

This folder is the blocking evidence surface for P2-01, P2-10 and P2-12. Synthetic runs
may prove wiring, but they cannot select a provider or pass the Phase 2 exit.

Run a captured candidate result with:

```sh
npm run voice:golden -- dev-docs/golden/voice/results/<candidate>.json
```

The command exits non-zero when the result cannot be used for a provider decision. A usable
result must contain human-labelled observations, zero false teaching, zero low-confidence
durable reading updates, and human approval for every spoken teaching sample. Accuracy is
reported with a 95% Wilson interval; 98% is shown as a target only after the set is large
enough to support that claim.

Do not commit child audio. Store only bounded measurements and labels here. The real-browser
run and the independent-session observation require verified voice consent and the approved
audio-handling process.

## Speech-to-speech arm (P2H-15)

`runs/<date>-s2s.json` is written by `npm run voice:s2s-compare -- --pipeline <result.json>
--s2s <run.jsonl>`; the s2s run log comes from a worker started with `VOICE_S2S_PROVIDER` and
`VOICE_S2S_RUN_LOG`. Same rule as above: timings and labels only, never audio.
