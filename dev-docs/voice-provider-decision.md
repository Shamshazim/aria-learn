# Phase 2 voice provider decision

Status: **blocked on measured human-labelled evidence**.

The worker defaults are integration candidates, not a provider decision:

- media and agent runtime: LiveKit;
- STT candidate: `assemblyai/universal-3-5-pro` through LiveKit Inference;
- turn detector candidate: LiveKit Turn Detector;
- TTS candidate: `fishaudio/s2.1-pro` through LiveKit Inference.

Do not label any candidate “selected” until each candidate has been run over the same
human-labelled voice set and compared using transcript/end-of-turn accuracy with confidence
intervals, interruption silence p95, first-audio/e2e p95, false-teaching defects, reviewed
spoken output, regional processing/retention terms, and cost. Synthetic smoke results are
explicitly ineligible.
