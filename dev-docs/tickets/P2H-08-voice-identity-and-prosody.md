# P2H-08 — Voice identity and prosody

| | |
|---|---|
| **Phase** | 2H |
| **Track** | Voice |
| **Depends on** | P2-01 (decision may be provisional; see edge cases) |
| **Blocks** | P2H-09, P4-05, P2H-13 |
| **Parallel-safe with** | P2H-01 … P2H-07, P2H-10, P2H-12 |
| **Size** | S |

## Why

`apps/voice-worker/src/config.ts` sets `ttsVoice: 'default'` and `agent.ts` sets
`expressive: false`. `spokenForm()` only expands fractions and abbreviations. The result is a
flat, generic read. Children respond to a voice, not a text-to-speech engine.

## Scope

### Build
A named voice per band, expressive synthesis, prosody hints produced by `spokenForm()`,
name pronunciation, number/money/time reading, and a recorded listening review.

### Do not build
No voice cloning, no custom TTS model, no prosody scoring (deferred per BACKLOG).

## Design

```
apps/voice-worker/src/
  config.ts                     ttsVoice removed; voices: Record<Band, VoiceId> from env/yaml
  voice/voice-catalog.ts        band -> { voiceId, rate, pitchHint, register } (data file)
  voice/voice-catalog.test.ts
  agent.ts                      expressive: true; voice chosen from room.band
packages/voice/src/
  spoken-form.ts                extend: numbers (12 -> "twelve"; 1,204), ordinals, money,
                                time, fractions (exists), "x" as "times", "=" as "equals",
                                emphasis markers *word* -> vendor emphasis, pauses "…" and
                                " — " -> short pause, sentence-final "?" kept for rising intonation
  pronunciation/names.ts        name -> phonetic hint map (per student, from student.settings)
  pronunciation/lexicon.data.ts reviewed lexicon for curriculum terms ("numerator", "digraph")
apps/api/src/services/content/
  personalise.ts                emits emphasis markers on the key noun in early-band ASK
dev-docs/voice-review.md        the listening review record
```

**Choosing the voice**: for each band pick from the provider's catalogue by criteria: early —
warm, slightly slower (rate 0.92), clearly articulated; middle — neutral adult, rate 1.0;
senior — calm, lower energy, rate 1.0, no "performing". Record the candidate voice ids and
the rejected ones with reasons.

**Prosody through text**: the harness controls text, so prosody hints are textual and
vendor-neutral in `spokenForm()`; the worker maps them to the vendor's markup (or strips them
if unsupported). Nothing in the child-facing *display* text contains markers — `speech.text`
and `text` diverge here (protocol already allows it).

**Listening review** (`dev-docs/voice-review.md`): 3 adults and 3 children (one per band)
listen to 10 fixed utterances per band (welcome, praise, hint, reteach, question, number
reading, name reading, end) and rate warmth and clarity 1–5; the PR records scores and
the chosen voices. Voice provider decision (P2-01) may still be provisional; this ticket
records which candidate the review used so it can be re-run.

### Edge cases
- Vendor lacks a marker (no pause support) → markers stripped, never spoken literally (test
  per vendor adapter).
- Name with unknown pronunciation → default TTS reading; parent can set a phonetic hint in the
  child profile (P2H-12 UI field; stored in `student.settings.pronunciation`).
- Numbers over 999,999, negative numbers, decimals ("3.5" → "three point five"), percentages.
- Math expressions in early band ("3 + 4") → "three plus four"; never "three add four".
- Text containing a URL or code → gate rejects earlier (structural); spokenForm never sees it.
- Two voices in one session (band change on class switch across bands is not allowed — band
  is per student) → n/a; assert one voice per session.
- `expressive: true` raises first-audio latency → measured in P2H-13; if p95 > 1s the flag
  is per-band configurable.

## Status (2026-08-25)

- **Complete pending review** on `feat/P2H-08-voice-identity-and-prosody`, stacked on
  `feat/P2H-07-sentence-streaming` (which is itself on `docs/harness-review-fixes`), because
  neither dependency is on `main` yet.
- Done: a voice per band with no default and a boot failure when one is missing; `expressive`
  on; the band's speaking rate sent in the provider's own word for it; `spokenForm` extended to
  numbers, ordinals, decimals, negatives, money, clock times, percentages, expressions and
  emphasis/pause marks; a vendor-neutral prosody vocabulary that the worker's vendor adapter
  renders or strips; a curriculum lexicon; the pronunciation path from the participant token to
  the engine; emphasis on the key noun of an early-band `ASK`; and `dev-docs/voice-review.md`.
- Three decisions the ticket did not settle:
  - **Prosody rides in `speech.prosody`, not in `speech.text`.** The ticket says the display
    text and the spoken text diverge, and the protocol does allow it — but the web renders
    `speech.text` as a caption in four places, so a marker in that field would be a marker on
    screen. A new optional `speech.prosody` carries the marked, already-spoken form; every
    display path keeps reading `text` and needs no change to stay clean.
  - **The marker vocabulary is `[[emphasis]]…[[/emphasis]]` and `[[pause:short]]`**, not SSML.
    SSML is a vendor format and two of the five candidates cannot parse it. Authors write
    `*word*` and `…`; `spokenForm` converts; `voice/vendor.ts` is the only file that knows what
    an engine can do with the result.
  - **The key noun of a question is guessed, and declines to guess twice.** "How many *quarters*
    make a whole?" leans on the word after "how many", and everything else falls back to the
    last content word. A word that appears twice in the sentence is left unmarked, because
    emphasising the wrong one of them is worse than emphasising neither.
- Deliberately not built:
  - **The listening review itself.** It needs six people and a provider decision, neither of
    which is code. `dev-docs/voice-review.md` is the protocol it will be run against and the
    table it will be written into; §4 and §5 are empty and say so.
  - **The profile field.** `student.settings.pronunciation` arrives with P2H-12's migration 009,
    which owns that column. Everything downstream of the value exists and is tested end to end —
    `PronunciationSource` is the port, `NO_PRONUNCIATION_SOURCE` is what is wired today, and it
    answers "nothing known" so a name is read as written.
  - **Per-band `expressive`.** The ticket makes it configurable only if P2H-13 measures first
    audio over 1s p95. It is one flag today; the escape hatch is recorded in `voice-review.md` §7.

## Acceptance criteria

- [x] `ttsVoice: 'default'` no longer exists; each band resolves to a named voice; boot fails
      loudly if a band has no voice configured. `config.test.ts`, `voice/voice-catalog.test.ts`.
- [x] `spokenForm` fixtures: 48 cases across numbers, money, time, fractions, expressions,
      emphasis and pauses, including the edge cases above. `spoken-form.test.ts`.
- [x] Display text never contains prosody markers. `services/content/personalise.test.ts`
      asserts it over the early-band `ASK` path, which is the only place a marker is authored.
- [x] Unsupported markers are stripped for the configured vendor. `voice/vendor.test.ts`,
      including an engine the table has never heard of.
- [ ] Listening review recorded with scores >= 4/5 mean warmth and clarity per band. Needs six
      listeners and a provider; the protocol and the empty record are in `dev-docs/voice-review.md`.
- [x] Name pronunciation hint round-trips from profile to synthesis.
      `voice/pronunciation.round-trip.test.ts` starts from the minted participant token and ends
      at a fake engine that records what it was asked to say; the published move keeps the name
      as it is written. The profile column itself belongs to P2H-12 — see Status.

## Verification

```bash
npm run test -w @aria/voice -- spoken-form
npm run test -w @aria/voice-worker
npm run test -w @aria/api -- personalise
npm run voice:golden -w @aria/voice-worker -- --report first-audio
```

## References

- `master-plan.md` §4.7, §5
- `realtime-agent-harness.md` — "TTS through the segment gate", "spokenForm()"
- `voice-provider-decision.md`, P2-01, P2-04
