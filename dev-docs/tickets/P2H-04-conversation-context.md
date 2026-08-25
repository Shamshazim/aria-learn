# P2H-04 — Conversation context in every prompt

| | |
|---|---|
| **Phase** | 2H |
| **Track** | Backend |
| **Depends on** | P0-23, P2H-03 |
| **Blocks** | P2H-06, P2H-11, P2H-14 |
| **Parallel-safe with** | P2H-05, P2H-07, P2H-08, P2H-10 |
| **Size** | M |
| **Status** | 🟡 Core implemented on branch `docs/harness-review-fixes` (commits `ab1ef4b`, `ccba913`), no PR yet. |

## Why

No prompt today sees what was said. `services/tutor/context.loader.ts` computes only recent
move *kinds*; the child's name is stripped by `scrubLearnerContext(…, { pseudonym: 'omit' })`.
A tutor who cannot remember the last sentence cannot say "you said seven — what made you
think seven?" This ticket gives every prompt a short, scrubbed dialogue window and settles the
first-name question with an explicit privacy decision.

## Scope

### Build
`ScrubbedContext.dialogue[]`, a band-tuned window, a first-name policy amendment to P0-23 with
its tests, and token budgeting.

### Do not build
No durable memory changes (P3-*). No retrieval changes beyond passing what P1-10 already returns.

## Design

```
apps/api/src/privacy/
  types.ts                         ScrubbedContext gains dialogue: ScrubbedTurn[], firstName?: string
  rules/first-name.rule.ts         allows exactly the student's first name token; nothing else
  rules/dialogue.rule.ts           scrubs each turn's text with the full rule set
  disclosure/categories.ts         adds 'first_name' and 'recent_dialogue' to the parent-facing list
apps/api/src/services/tutor/
  context.loader.ts                loads last N session_events (actor, moveKind, text, correct)
  dialogue-window.ts               N by band: early 6, middle 10, senior 14 turns; hard cap 1,500 tokens
apps/api/src/ai/prompts/render/
  dialogue.render.ts               renders turns as "Aria: … / Child: …" inside an untrusted block
apps/api/src/services/content/
  to-context.ts                    passes pseudonym: 'first-name' when the decision flag is on
apps/api/src/config/
  privacy.config.ts                PRIVACY_SHARE_FIRST_NAME (default true; documented)
dev-docs/tickets/P0-23-privacy-scrubber.md   amendment note pointing here
```

**First-name decision** (record in the PR and in `disclosure/`): the child's *first name only*
may cross the vendor boundary. Rationale: a first name is not identifying at scale, the plan's
own welcome example uses it ("Welcome back, Ajmal"), and warmth requires it. Everything else in
P0-23 stands: no surname, school, address, parent email, birthday, photos. The parent-facing
disclosure (P0-23) lists it as a shared category. If the parent opts out (`student.share_first_name
= false`, migration-free: stored in the existing `student.settings` JSONB), the pseudonym path
is used and prompts say "you".

**Dialogue window**: the last N turns where a turn is one `session_event` with `actor` in
`aria | child`. Each child turn is scrubbed by the full rule set (a child who typed their
address does not get it echoed to the vendor). Aria turns are included verbatim (they already
passed the gate). System/decision events are excluded. Voice turns include `confidence` so the
prompt can say "I think you said…".

### Edge cases
- First turn of a session → `dialogue: []`; prompts must render without the block.
- Resumed session after a day → window continues across the gap with a rendered marker
  "(the next day)".
- A child turn flagged by safety (`safety_flag` exists for the event) is replaced by
  "[the child said something Aria did not repeat]".
- Two children share a first name → irrelevant; the name is per-session.
- Name that is also a common word ("Sunny", "May") → allowlisted only as the capitalised token.
- Token cap hit → drop oldest turns first, never truncate mid-sentence.
- Parent opt-out toggled mid-session → next turn uses "you".

## Status (2026-08-25)

- Done: `recentDialogue` in raw/scrubbed context, scrubber redacts dialogue and passes first name only (decision recorded), per-band dialogue window, `renderDialogue`, context loader wiring, pseudonym tests.
- Remaining: type test that only the scrubber sets `dialogue`/`firstName`, surname/email/address fixture over child turns, 1,500-token cap, safety-flagged turn redaction, parent disclosure entries, `repeated-confusion` golden scenario.

## Acceptance criteria

- [ ] `ScrubbedContext` is the only type prompts accept; `dialogue[]` and `firstName` are set
      by the scrubber, not by callers (type test).
- [ ] A fixture with a surname, email, address and school in child turns produces a prompt
      containing none of them (existing bounds tests extended).
- [ ] The first name appears in a rendered prompt when opted in and never when opted out.
- [ ] Window sizes per band are enforced and the 1,500-token cap drops oldest turns first.
- [ ] A safety-flagged child turn is redacted in the window.
- [ ] The parent disclosure lists `first_name` and `recent_dialogue`.
- [ ] Golden tutoring scenario "repeated confusion" shows Aria referencing the child's earlier
      answer (rubric item added).

## Verification

```bash
npm run test -w @aria/api -- privacy
npm run test -w @aria/api -- context
npm run golden:tutoring -w @aria/api -- --scenario repeated-confusion
```

## References

- `master-plan.md` §4.1 (welcome example), §12 rule 2
- `cloud-model-layer.md` §11 (privacy boundary)
- P0-23, P1-10
