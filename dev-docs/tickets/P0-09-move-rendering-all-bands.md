# P0-09 — Render every move, accessibly, in all three bands

| | |
|---|---|
| **Phase** | 0 — Foundation |
| **Track** | Frontend |
| **Depends on** | P0-07, P0-08 |
| **Blocks** | P0-25, P1-11, P1-12 |
| **Parallel-safe with** | P0-10 … P0-24 |
| **Size** | L |

## Why

The carried-forward components were built for a question and an answer. The protocol has
fourteen moves, and `master-plan.md` §5 requires each band to express them in its own visual
language — the same `RETEACH` looks and sounds different for a five-year-old and a
thirteen-year-old. This is where "carries forward, not frozen" gets cashed in.

## Scope

### Build
A move-renderer registry per band, the components each band needs for moves it could not
previously show, and the visible tutor-state affordances (thinking, speaking, listening,
waiting for you).

### Do not build
- No audio playback. Phase 2. `speech.text` renders as text and the spoken affordance is
  present but silent.
- No new backend.

## Design

```
apps/web/src/features/session/
  render/
    registry.ts             Record<Band, Record<MoveKind, MoveRenderer>>
    renderers/early/*.tsx   one file per move kind that needs a band-specific renderer
    renderers/middle/*.tsx
    renderers/senior/*.tsx
    renderers/shared/*.tsx  the default renderer for moves that do not differ by band
  components/
    TutorStatus.tsx         thinking | speaking | listening | waiting — never a spinner
    InputSurface.tsx        chooses the control from move.expects, never from move.kind
    RecommendationCard.tsx
    BreakCard.tsx
```

Band requirements, from `master-plan.md` §5:
- **Early (TK–2):** big, loud, almost no text. Answers are tapped pictures, dragged objects
  or spoken words — never typed. Aria's presence leads. A `LISTEN` move must read as "talk to
  me" without words.
- **Middle (3–5):** text and voice together, Aria's reasoning visible, progress dots, the
  child starts writing.
- **Senior (6–8):** quiet, clean, adult, no cartoon owl. Text-first, work pad, argument.

Cross-band rules:
- The renderer is chosen by `(band, move.kind)` from the registry. Adding a move kind means
  adding a file, never editing a switch — see `CODE-STANDARDS.md` §4.
- The input control is derived from `move.expects`. A move kind never hard-codes a control.
- **No model spinner, ever** (`master-plan.md` §4.1, latency rule). `TutorStatus` says what
  Aria is doing in the child's language; it never implies zero latency and never shows a
  progress bar for a network call.
- Two wrong answers must never produce the same move twice — the machine already prevents it;
  the UI must make the change visible.
- Every move is announced to assistive technology via a polite live region.

## Acceptance criteria

- [ ] The registry is exhaustive: a missing `(band, kind)` pair fails typecheck.
- [ ] Every one of the fourteen moves renders in all three bands, verified by tests and by
      the P0-08 scenarios.
- [ ] The early band renders a complete session with no typed input.
- [ ] `TutorStatus` shows all four states and no spinner appears anywhere in the feature.
- [ ] Axe passes on every band × every move state.
- [ ] Full keyboard operation of every band, with visible focus.
- [ ] `prefers-reduced-motion` removes animation without removing meaning.
- [ ] The P0-07 baseline is updated, and the PR explains each intended visual change.

## Verification

```bash
npm run test -w @aria/web
npm run e2e:baseline
```

## References

- `master-plan.md` §4.1, §5, §11 (teaching-quality bars)
- `rewrite.md` §2 ("How to bring it forward", step 4)
