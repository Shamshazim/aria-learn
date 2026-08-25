# P5-03 — The story in the session: voice register, visuals, band fit

| | |
|---|---|
| **Phase** | 5 |
| **Track** | Backend + Frontend + Voice |
| **Depends on** | P5-01, P5-02, P2H-07 |
| **Blocks** | P5-04 |
| **Parallel-safe with** | P4-08 |
| **Size** | M |

## Why

A story beat delivered in the same flat register as a hint is not a story. Early-band
children need narration with pace and pictures; senior-band children read decoration "as an
insult" (`master-plan.md` §5) and need a quieter, adult register. This ticket makes the
beats land in each band.

## Scope

### Build
`narration` register in the voice pipeline; illustration `SHOW` payloads for early/middle
beats from a reviewed asset set; senior-band prose register; the SAY/SHOW/ASK sequence for a
beat; captions during narration.

### Do not build
No generated images (reviewed static asset set only). No video (§14). No sound effects
beyond the P2H-09 bridge library.

## Design

```
apps/api/src/services/story/
  beat-moves.ts            beat -> [SAY { register: 'narration' }, SHOW? { visual: 'illustration',
                           params: { assetKey, alt } }, ASK/LISTEN (the lesson item)]
  illustration-picker.ts   frame + chapter + location -> reviewed asset key; none for senior
packages/shared/src/protocol/schemas/moves/move-base.ts   `register?: 'teach' | 'narration' | 'aside'`
                           (additive, optional — P0-27 amendment rules apply: bump protocol version)
packages/voice/src/spoken-form.ts       narration: longer pauses at sentence ends, quoted
                           speech read with a slight change of rate; no character voices
apps/voice-worker/src/session/move-stream.ts   passes register to TTS options (P2H-08 prosody
                           hints); narration never uses bridges mid-beat
apps/web/src/features/session/render/renderers/
  early/Illustration.tsx   full-width picture, caption spoken; tap does nothing
  middle/Illustration.tsx  picture beside text
  senior/                  no illustration renderer registered; SAY renders as prose
public/story-assets/       reviewed illustrations per frame (≤ 30 per frame), WebP, alt text
```

Rules:
- Narration register still passes every gate; register only changes delivery.
- Senior band: no `SHOW` illustration, no owl, prose only; the story is text the student
  reads, Aria's voice optional as everywhere in that band.
- Captions on during narration in early/middle (P2-07 caption toggle respected).
- Barge-in during narration cancels exactly like teaching speech (P2-06).

### Edge cases
- Asset missing → SAY only; logged; never a broken image.
- Beat text exceeds band sentence limits → level gate fails → regenerate → storyless.
- Reduced-motion → no illustration transitions.
- Autoplay blocked on first beat → visible text immediately (P2-08 rule), speech when unlocked.
- Child interrupts narration with the answer to the coming question → intent ANSWER;
  narration cancelled; grade proceeds; beat outcome recorded.
- Senior student on a phone-sized viewport → prose wraps; no horizontal scroll.
- Voice consent withdrawn → narration is captions only; no audio.

## Acceptance criteria

- [ ] `register` is optional and additive; every existing protocol fixture still validates;
      protocol version bumped per P0-27 rules.
- [ ] Early/middle beats render an illustration when an asset exists and degrade to SAY when
      not; senior never renders one — registry tests.
- [ ] Narration spoken form differs from teach form for the same text (snapshot).
- [ ] Barge-in cancels narration within the P2-06 bar (voice golden run).
- [ ] Every asset has alt text and a recorded review.
- [ ] Visual baselines added for illustration renderers in early and middle.

## Verification

```bash
npm run test -w @aria/shared @aria/voice @aria/web
npm run golden:voice -w @aria/voice-worker -- --scenario narration
npm run baseline:check -w @aria/web
```

## References

- `master-plan.md` §5 (bands), §4.7, §14 (no video)
- P2H-07/08/09, P2-06/07/08, P0-27
