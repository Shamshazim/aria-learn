# P4-05 — Sounds without letters: phonemic awareness and blending activities

| | |
|---|---|
| **Phase** | 4 |
| **Track** | Backend + Frontend |
| **Depends on** | P2H-08, P4-01 |
| **Blocks** | P4-08, P4-09 |
| **Parallel-safe with** | P4-02, P4-03, P4-04, P4-07 |
| **Size** | M |

## Why

Rungs 1–3 of the ladder (`master-plan.md` §6.1) are pure listening and speaking: hear rhyme,
clap syllables, hear that "cat" starts with /k/, blend /k/ /a/ /t/. "This is why voice is
required." These activities are the entry point for every non-reader and the Phase 4 exit
("a non-reader reaches decoding CVC text") starts here. Early band only; answers are spoken
or tapped pictures, never typed.

## Scope

### Build
Five activity types as content items + move sequences; a reviewed picture-word bank; the
grading rules for spoken and tapped answers; the TTS phoneme rendering.

### Do not build
No letter tiles or word building (P4-08). No middle/senior variants. No new ASR provider.

## Design

Activity types (each a `content_item.kind`):

| kind | Aria does | child does | skill |
|---|---|---|---|
| `pa_rhyme` | says two words, asks "do they rhyme?" | speaks yes/no or taps ✓/✗ | PA.RHYME |
| `pa_syllable` | says a word, asks to clap/count | speaks a number or taps 1–4 | PA.SYLLABLE |
| `pa_first_sound` | says a word, asks "what sound does it start with?" | speaks the sound, or taps 1 of 3 pictures whose name starts with it | PA.FIRST_SOUND |
| `pa_blend` | says /k/ … /a/ … /t/ with pauses, "what word?" | speaks the word or taps 1 of 3 pictures | PA.BLEND |
| `pa_segment` | says "cat", asks for the sounds | speaks the sounds | PA.SEGMENT |

```
apps/api/src/curriculum/reading/
  pa-items.data.ts          ≥ 30 reviewed items per type; word, phonemes (IPA + child-safe
                            spelling like "kuh"), rhyme pairs, syllable counts, distractors
  picture-words.data.ts     ~120 nouns with picture asset keys, each tagged first-phoneme,
                            syllables, rhyme family; CVC subset marked
apps/api/src/services/reading/
  pa-activity.service.ts    builds the move sequence: SAY (instruction) -> SHOW (pictures,
                            when tap answer) -> LISTEN { purpose: 'answer' } or ASK { choices }
  pa-grade.ts               spoken grading: normalise transcript, accept the word, the
                            phoneme spelling variants ("kuh","k","cuh"), and the number words;
                            tap grading by option id (P0-02 rule: never by label)
packages/voice/src/spoken-form.ts   gains phoneme rendering: /k/ spoken as "kuh" with a
                            300 ms pause between sounds in pa_blend; never reads the slashes
apps/web/src/features/session/render/renderers/early/PictureChoice.tsx   3 large pictures,
                            spoken labels on tap-and-hold, no text
apps/web/src/features/session/render/renderers/early/SyllableClap.tsx     1–4 big dots
```

Rules:
- Every item is human-reviewed before merge (rhymes and phoneme spellings are easy to get
  wrong; a model does not author these).
- `pa_blend` pauses are in the spoken form, not the written caption: caption shows "k … a … t".
- Answer window for early band = 12 s (P2H-01 table); one re-ask, then `REVEAL` by saying the
  word slowly and moving on — never a third attempt (§5 "never stuck").
- After 3 consecutive `pa_*` misses on one skill the policy `SWITCH`es to a taught skill.

### Edge cases
- ASR hears "cap" for "cat" → not correct; one gentle re-ask with the blend slower.
- Child says the whole word during `pa_segment` → treat as partial; ask for "just the first sound".
- Child taps before Aria finishes → barge-in cancels speech, answer still graded.
- Pictures fail to load → fall back to spoken choices ("cat, dog, or sun?").
- Voice consent withdrawn → tap-only variants of every activity; `pa_segment` is skipped.
- Homophones in the picture bank ("sun/son") avoided by review checklist.
- Number words in syllable count: "two" vs "to" → normalise both to 2.
- Transcript is empty → `CHECK_IN` on microphone, no grade recorded.

## Acceptance criteria

- [ ] All five activity kinds produce valid move sequences against the protocol schemas.
- [ ] Spoken grading accepts documented phoneme spellings and rejects near-miss words (fixtures).
- [ ] Tap grading compares option ids only.
- [ ] `pa_blend` spoken form contains pauses and never the literal "/" — snapshot test.
- [ ] No activity requires reading or typing in the early band; a lint over the renderers
      asserts no `<input type="text">`.
- [ ] Never more than two attempts before `REVEAL`; never a `pa_*` move after 3 misses on the
      same skill — policy tests.
- [ ] Every item in the bank carries a `reviewedBy` and the review is recorded in the PR.
- [ ] Withdrawn consent path completes a session with tap-only variants (scenario test).

## Verification

```bash
npm run test -w @aria/api -- pa-
npm run test -w @aria/web -- early
npm run golden:tutoring -w @aria/api -- --scenario phonemic-awareness
```

## References

- `master-plan.md` §5 (early band), §6.1 rungs 1–3, §14 (no menu)
- P2H-08 (voice/prosody), P4-01
