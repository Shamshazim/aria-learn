# The listening review

P2H-08. What Aria sounds like, who decided, and on what evidence.

The code half of the ticket is done and merged: a voice per band, expressive synthesis, a
prosody vocabulary the harness writes and the vendor adapter renders or drops, and a
pronunciation path from the child's profile to the engine. **The review itself has not been
run** — it needs six people and a provider decision, and neither is a thing code can supply.
This file is the protocol it will be run against, and the record it will be written into.

---

## 1. What is fixed before a voice is chosen

| Band   | Rate | Pitch   | Register | Why                                                              |
| ------ | ---- | ------- | -------- | ---------------------------------------------------------------- |
| early  | 0.92 | bright  | warm     | A five-year-old needs the words slower and the consonants clear. |
| middle | 1.0  | neutral | neutral  | An adult talking to them, not down at them.                      |
| senior | 1.0  | low     | calm     | A thirteen-year-old hears performance as condescension.          |

These live in `apps/voice-worker/src/voice/voice-catalog.ts` as `VOICE_CRITERIA` and are what
a candidate is judged against. The voice **ids** are configuration
(`VOICE_TTS_VOICE_EARLY|MIDDLE|SENIOR`), so the review can change a voice without a code
change — and a band with no id fails the worker at boot rather than falling back to whatever
the engine offers.

## 2. Provider status

P2-01 is **not decided**. `VOICE_TTS_MODEL` defaults to `fishaudio/s2.1-pro`, which is the
integration candidate, not the choice. The vendor table in
`apps/voice-worker/src/voice/vendor.ts` records what each candidate can do with prosody and
speaking rate:

| Vendor          | Emphasis          | Pause          | Rate option     | Notes                                      |
| --------------- | ----------------- | -------------- | --------------- | ------------------------------------------ |
| elevenlabs      | SSML `<emphasis>` | SSML `<break>` | `speed`         | Needs `enable_ssml_parsing`.               |
| cartesia        | SSML `<emphasis>` | SSML `<break>` | `speed`         |                                            |
| inworld         | —                 | —              | `speaking_rate` | Markers stripped.                          |
| xai             | —                 | —              | `speed`         | Markers stripped.                          |
| fishaudio       | —                 | —              | `speed`         | Plain text only; markers stripped.         |
| _anything else_ | —                 | —              | —               | Treated as an engine that renders nothing. |

A vendor that cannot render a marker never receives it. `vendor.test.ts` proves a stripped
marker is removed rather than spoken, for every case in this table.

## 3. The review protocol

**Panel.** Three adults and three children — one child per band. The children listen to their
own band only; the adults listen to all three.

**Material.** Ten fixed utterances per band, generated from the live tutor path so they are
the sentences a child would actually hear, not a script written for the microphone:

1. Welcome back (arrival, uses the child's name)
2. Specific praise
3. A hint, first attempt
4. A reteach after a wrong answer
5. A question (early band: with the emphasis this ticket adds)
6. Number reading — `1,204`, `$1.50`, `3:45`, `3/4`
7. Name reading — the panel child's own name
8. A short explanation, three sentences, streamed a sentence at a time (P2H-07)
9. A break offer
10. The end of a session

**Scoring.** Warmth 1–5 and clarity 1–5, per utterance, per listener. The bar is a mean of
**≥ 4** on both, per band. Anything below that fails the candidate for that band; a candidate
may pass one band and fail another, and that is a normal outcome.

**Recording.** Every run appends a row to §4 naming the model, the three voice ids, the date,
and the means. Rejected candidates go in §5 **with the reason**, because "we already tried
that one" is only useful if it says why.

## 4. Runs

_None yet._

| Date | Model | early / middle / senior ids | Warmth (e/m/s) | Clarity (e/m/s) | Verdict |
| ---- | ----- | --------------------------- | -------------- | --------------- | ------- |

## 5. Rejected candidates

_None yet._ Each entry: vendor, voice id, band, and the specific failure — "clipped final
consonants", "sounded amused during a reteach", "read `3/4` as `three slash four`".

## 6. Lexicon

`packages/voice/src/pronunciation/lexicon.data.ts` holds the curriculum words an engine reads
wrongly, as respellings rather than phonemes — not every engine reads the same phoneme
alphabet, and all of them read letters. It is seeded from the terms most likely to appear in
the initial scope; **every entry is provisional until a run in §4 confirms it was needed**,
and a run that finds an entry unnecessary should delete it rather than leave it.

A child's own name is not in this file. It comes from `student.settings.pronunciation`,
travels in the participant token, and is applied per session
(`apps/voice-worker/src/voice/speech-renderer.ts`). The profile field that stores it arrives
with P2H-12; until then the source answers "nothing known" and the name is read as written.

## 7. Latency

`expressive: true` costs something in first audio. P2H-13 measures it — the bar is first
audio < 1s p95. If expressive synthesis puts a band over that bar, the flag becomes per-band
configuration and the band that cannot afford it loses it. That decision belongs to measured
evidence, and is recorded here when it is made.
