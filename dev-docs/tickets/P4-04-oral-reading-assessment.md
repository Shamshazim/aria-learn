# P4-04 — Oral reading assessment feeding phonics and skill state

| | |
|---|---|
| **Phase** | 4 |
| **Track** | Backend |
| **Depends on** | P2-09, P4-01 |
| **Blocks** | P4-06, P4-09 |
| **Parallel-safe with** | P4-02, P4-03, P4-05, P4-07 |
| **Size** | L |

## Why

"The single most valuable signal in early reading and no screen-only product can get it"
(`master-plan.md` §4.7). P2-09 already produces `ReadingAssessment` (`packages/voice/src/
reading.ts`): WCPM with a confidence band, aligned words, `mayCreateDurableEvidence`. This
ticket turns that into durable evidence — but only when it is trustworthy. A low-confidence
result must never move skill state; that rule is the P2-10 exit bar.

## Scope

### Build
`oral_reading` writes; missed-word → phonics-pattern attribution; `student_phonics.mastered_at`
and `skill_state` updates above threshold; miscue observations; the event → move path for a
finished `read_aloud` LISTEN; a placement routine for a new child.

### Do not build
No prosody scoring, no speaker recognition, no automated diagnosis (BACKLOG deferrals). No UI
(P4-08). The ASR is never given the passage — enforced already by P2-09; re-asserted here.

## Design

```
apps/api/src/services/reading/
  assess.service.ts        onReadAloudFinal(sessionId, eventId, passage, timings, onTaskMs,
                           speaker) -> assessOralReading (P2-09) -> record -> attribute -> update
  attribute-miscues.ts     for each substitution/omission: classify-word (P4-02) on the
                           reference word -> required pattern code -> group counts per pattern
  reading-evidence.ts      decides durability: assessment.mayCreateDurableEvidence AND
                           aligned.length >= 8 AND accuracy >= 0.5 (below that the child was
                           not reading this text; it is a placement signal, not a skill signal)
  reading-state.ts         durable path: per-pattern accuracy -> student_phonics.mastered_at
                           (>= 95% over >= 2 durable readings featuring the pattern);
                           FL.WCPM.* skill_state from wcpm_lower (the conservative bound)
                           against grade norms table; PH.* skill_state from pattern accuracy
  placement.service.ts     first-reading placement: three short bank passages at rungs 1, 2, 3;
                           taught set initialised from the highest rung read >= 90% accurate
                           (durable rows only); otherwise empty set + PA.* start
  norms.data.ts            WCPM norms by grade and season (published Hasbrouck–Tindal table)
apps/api/src/repositories/oral-reading.repository.ts     (from P4-01, extended)
packages/tutor/src/steps/update-state.ts                 gains a `readingEvidence` branch
apps/api/src/services/tutor/reading-turn.service.ts      SPEECH_FINAL for a LISTEN read_aloud
                           routes here instead of grading; returns PRAISE (specific: names a
                           word they got), HINT (re-read one sentence), or SAY (teach the
                           pattern behind ≥ 2 misses) by policy
```

Moves after a reading, decided in `policy/` (P1-08 extension, deterministic):
- accuracy ≥ 95% → `PRAISE` naming what went well, then next passage or end.
- 2+ misses share a pattern that *is* taught → `HINT` on that pattern, re-read that sentence.
- 2+ misses share a pattern **not** taught → the passage generator failed (bug); log at error,
  `SWITCH`, and mark the passage unverified.
- accuracy < 50% or `confidence.level === 'low'` → no correction of the child; `CHECK_IN`
  ("Was that hard to hear? Let's try a shorter one") and a shorter passage.

### Edge cases
- `speaker: 'uncertain'` (a sibling or parent read it) → row written with `durable=false`;
  no state change; never praised for reading they did not do — reviewed neutral text.
- Child stops mid-passage (silence) → assess the words attempted; `onTaskMs` excludes leading
  silence; below 8 aligned words → non-durable.
- Child skips a line → omissions; accuracy drops; still assessed.
- Child self-corrects ("cat—no, cap") → ASR yields insertion + correct; count as correct,
  insertion ignored (self-correction is not an error, per standard ORF scoring).
- Reconnect mid-reading (`MEDIA_LOST`) → discard partial timings; re-issue the LISTEN with the
  same passage; nothing durable from the partial.
- Same passage read twice in one session → second reading counts for fluency only.
- Zero-word transcript → `wcpm 0`, non-durable, `CHECK_IN` on microphone.
- Passage id missing on the LISTEN → error; no assessment.
- WCPM above the 99th percentile for grade → flag as probable ASR/timing error, non-durable.
- Placement for a child whose parent withdrew voice consent → skip; text-only reading path
  (comprehension only, P4-06) and the taught set is filled by teaching.

## Acceptance criteria

- [ ] A `confidence.level === 'low'` or `speaker: 'uncertain'` assessment writes an
      `oral_reading` row with `durable=false` and changes **zero** `skill_state`,
      `student_phonics` rows — proven by a test with row-count assertions.
- [ ] Missed words are attributed to pattern codes; two misses on CVCE yield one HINT on
      CVCE, not two hints — proven by test.
- [ ] `mastered_at` is set only after ≥ 2 durable readings ≥ 95% on that pattern.
- [ ] FL skill state uses `wcpm_lower`, never `estimate`.
- [ ] The ASR call in the read-aloud path carries no passage text or vocabulary hint —
      asserted by inspecting the port call arguments.
- [ ] Self-corrections are scored correct (fixture).
- [ ] Placement initialises the taught set only from durable readings.
- [ ] A miss on an untaught pattern marks the passage unverified and logs at error level.
- [ ] Every assessment links `event_id` so the parent transcript shows the reading.

## Verification

```bash
npm run test -w @aria/api -- reading
npm run test -w @aria/voice
npm run golden:voice -w @aria/voice-worker -- --scenario oral-reading
```

## References

- `master-plan.md` §4.7 (oral reading), §6.1 (assessment is oral), §11 (WCPM tracked)
- `realtime-agent-harness.md` — oral reading section; P2-09; `packages/voice/src/reading.ts`
