# P6-05 — Transcripts, learner memory view and correction UI

| | |
|---|---|
| **Phase** | 6 |
| **Track** | Frontend + Backend |
| **Depends on** | P3-06, P6-01 |
| **Blocks** | P6-09 |
| **Parallel-safe with** | P6-02, P6-03, P6-04, P6-07 |
| **Size** | L |

## Why

`master-plan.md` §12.6: "The parent sees and can correct the learner memory. Full
transcripts, learner facts, episodes and briefs are available. Corrections take effect in the
next session." §7: "Nothing about their child is hidden from them." P3-06 built the
correction endpoint; nothing renders it, and no transcript endpoint exists.

## Scope

### Build
`GET /api/v1/parent/children/{id}/transcript` (paged by session), `GET .../learner-memory`
(facts, episodes, briefs, corrections), the parent pages that render them, the correction
form calling P3-06, and safety-flag visibility per the matrix.

### Do not build
No editing of transcripts. No deletion (P6-06). No teacher view (P6-08).

## Design

```
apps/api/src/
  controllers/parent/transcript.controller.ts, learner-memory.controller.ts
  services/parent/transcript.service.ts        sessions -> events -> TranscriptView
  services/parent/learner-memory.service.ts    facts+evidence, episodes, briefs, corrections
  mappers/transcript.mapper.ts                 session_event -> {at, actor, moveKind, text,
                                               skill, correct, latencyMs, flags[]}
  mappers/learner-memory.mapper.ts
  schemas/parent/transcript.schema.ts, learner-memory.schema.ts
apps/web/src/features/parent/
  pages/Transcripts.tsx, SessionTranscript.tsx, LearnerMemory.tsx
  components/TranscriptTurn.tsx, FactCard.tsx, EpisodeCard.tsx, BriefVersion.tsx,
             CorrectionForm.tsx, EvidenceLink.tsx, FlagBanner.tsx
  hooks/useTranscript.ts, useLearnerMemory.ts, useCorrection.ts
```

Rules:
- The transcript is the raw layer-1 log rendered plainly (§4.2): every move and every child
  input, in order, with what Aria decided (`evidence.decision` from P1-06) available under
  "why did Aria do this?". Nothing is filtered out except by the safety matrix below.
- Safety flags: `general_distress` and `self_harm` rows are visible to the parent with the
  reviewed wording from P6-07. `household_abuse` rows are **not** shown to the parent
  (the parent may be the subject — P1-13 amendment); the transcript shows the turn as
  "Aria paused the lesson and contacted a safeguarding contact" with no child text.
  `immediate_danger` visibility follows the matrix row's `parent_visible` field.
- Learner memory shows each fact with kind, value, confidence, first observed, last confirmed,
  and a link to each evidence event in the transcript. Superseded facts are shown struck
  through with the correction and who made it. Briefs list every version by period.
- The correction form offers: "this is wrong", "this is no longer true", "please don't use
  this", with an optional replacement value. It calls P3-06; the response confirms "Aria will
  use this from the next session".
- Audio: if `retained_child_audio` exists for a reading turn (opt-in only), a play control
  appears with its expiry date; otherwise the transcript says audio was not kept.
- Pagination: 20 sessions per page; a session page loads all its events (bounded by session
  length limits).
- The child's writing (P4-07) appears inline in the transcript at the turn it was submitted.

### Edge cases
- Session still live → shown with a "in progress" marker and refreshed on load; no polling.
- Event with a discarded draft (P1-06 speculation) → not in the log, so not shown.
- Fact with zero evidence rows → rendered with a warning and reported to observability (this
  violates the 100% bar in §11 and must be visible, not hidden).
- Brief version rolled back → both versions listed, current marked.
- Correction of a fact that a live session already loaded → takes effect next turn's
  retrieval, guaranteed by next session; the UI says "next session".
- Very long transcript (senior band, 30 min voice) → virtualised list.
- Text in a transcript that is itself a prompt-injection attempt → rendered as text, never
  as HTML (structural gate already strips markup; the UI escapes anyway).
- Parent of two children → child switcher on every page; no cross-child leak (tested).

## Acceptance criteria

- [ ] Transcript endpoint returns every `session_event` for an owned session, paged; a test
      compares counts against the repository.
- [ ] Household-abuse flags never appear in the parent transcript; general-distress ones do,
      with the reviewed wording; proven by fixture.
- [ ] Every fact card links to at least one evidence event that opens in the transcript; a
      fact without evidence is flagged in UI and in a metric.
- [ ] A correction submitted in the UI is visible as superseded immediately and absent from
      the next session's retrieval (integration test).
- [ ] Brief versions render by period; rollback state is visible.
- [ ] Ownership enforced on every route; child switcher cannot reach another parent's child.
- [ ] Transcript renders in early/middle/senior fixtures with voice and text sessions.

## Verification

```bash
npm run test -w @aria/api -- parent-transcript parent-memory
npm run test -w @aria/web -- parent
```

## References

- `master-plan.md` §4.2, §7, §10, §12.6; P1-13 (matrix amendment), P3-01, P3-03, P3-06, P6-07
