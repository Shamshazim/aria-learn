# P4-08 — Reading and writing in the band UIs

| | |
|---|---|
| **Phase** | 4 |
| **Track** | Frontend |
| **Depends on** | P4-03, P4-05, P4-07 |
| **Blocks** | P4-09 |
| **Parallel-safe with** | P4-04, P4-06 |
| **Size** | M |

## Why

`master-plan.md` §5: early band is "big, loud, spoken, almost no text — the child taps,
drags, or talks"; middle band starts writing; senior band is text-first. The reading and
writing services of P4-01…07 produce moves; this ticket renders them in all three bands,
including the live word highlighting during oral reading that lets a five-year-old follow
the passage with their eyes.

## Scope

### Build
Renderers for: letter tiles and word building (early), picture tap (from P4-05, integrated),
the passage reader with word highlighting during `LISTEN read_aloud`, the writing box (P4-07,
integrated), the syllable/rhyme controls. Visual baseline snapshots for every new renderer
in every band it applies to.

### Do not build
No new moves or content types — everything renders from existing `MoveContent` (`passage`,
`visual`, `choices`, `workpad`, `text`). No business logic in components (CODE-STANDARDS §3).

## Design

```
apps/web/src/features/session/render/renderers/
  early/LetterTiles.tsx        visual='letter_tiles' params { letters[], target?: length }
                               drag or tap to build a word; emits ANSWER { optionIds: tile ids
                               in order }; large targets (≥ 64px); spoken letter sound on tap
  early/WordBuild.tsx          visual='word_build' params { onset, rime } — tap to blend
  early/PictureChoice.tsx      (P4-05) choices with picture asset keys in option.label 'img:'
  shared/PassageReader.tsx     passage content; words wrapped in spans; during a read_aloud
                               LISTEN, highlights follow SPEECH_PARTIAL word index from the
                               realtime channel; band styles: early = 3–4 words/line, 32px+,
                               middle = normal, senior = plain
  shared/passage-highlight.ts  pure: (passageWords, partialTranscriptWords) -> highlighted
                               index using the same normalisation as packages/voice/reading.ts
                               (imported from @aria/voice, not duplicated)
  middle/WritingSurface.tsx    hosts features/writing/components/WritingBox
  senior/WritingSurface.tsx    workpad mode 'answer' with a quiet note panel
apps/web/src/features/session/render/registry.tsx     register visuals per band
apps/web/src/features/session/hooks/useReadingHighlight.ts   subscribes to partials
apps/web/src/features/session/styles/reading.css
```

Rules:
- Early band never renders a keyboard input; `LetterTiles` is the only "typing".
- The passage reader never sends the passage to the voice channel (P2-09 rule holds
  client-side too: partial transcripts come *in*; nothing goes *out* but audio).
- Highlighting is a hint for the eyes, not a judgement: a missed word is not marked red
  during reading; Aria's move afterward carries feedback.
- Reduced-motion preference disables highlight animation; highlight remains as a static
  underline.
- Every renderer has a visual baseline (P0-07 tooling) in each band it registers for.

### Edge cases
- Partial transcript runs ahead of the passage (child skipped) → highlight jumps forward
  using alignment, never backwards past a confirmed word.
- Partial transcript is empty for > 3 s while reading → highlight holds; no timer fires (the
  server's silence handling owns that, P2H-01).
- Passage longer than the viewport (middle/senior) → auto-scroll keeps the highlighted line
  in the upper third.
- Tiles: duplicate letters ("egg") → tile ids differ, labels equal; grading by id.
- Tile drag on touch with a shaking hand → drop targets 1.5× tile size; tap-to-place works
  as an alternative to drag.
- Picture asset fails → alt text is spoken on tap (early) and shown (middle+).
- Writing box loses focus / app backgrounded → draft kept in `sessionStorage` keyed by
  `writingId`; restored on return; cleared on submit.
- Screen reader user in senior band → passage reader exposes words as one paragraph, not
  hundreds of spans (ARIA `aria-hidden` on span decorations).
- Landscape phone (unsupported per X-03) → layout still doesn't overflow horizontally.

## Acceptance criteria

- [ ] All P4-03/05/07 move sequences render in their bands without falling back to the
      generic text renderer — test iterates the golden scenarios through the registry.
- [ ] `passage-highlight.ts` uses `@aria/voice` normalisation (import asserted) and never
      moves the highlight backwards (property test).
- [ ] Early band: no text input element exists in the DOM during any Phase 4 scenario.
- [ ] Tile answers submit option ids in order; duplicate letters grade correctly.
- [ ] Visual baselines exist and match for every new renderer per band.
- [ ] Reduced-motion turns off highlight animation (test via `matchMedia` mock).
- [ ] Draft persistence survives a reload within a session.

## Verification

```bash
npm run test -w @aria/web -- reading writing
npm run baseline:check -w @aria/web
```

## References

- `master-plan.md` §5, §4.7 (oral reading), `rewrite.md` §2
- P0-07 (baseline), P0-09 (rendering), P2-06 (barge-in UI), X-03
