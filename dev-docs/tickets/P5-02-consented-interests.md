# P5-02 — The child's life in the story: consented, current facts only

| | |
|---|---|
| **Phase** | 5 |
| **Track** | Backend |
| **Depends on** | P5-01, P3-06 |
| **Blocks** | P5-03 |
| **Parallel-safe with** | P4-* |
| **Size** | M |

## Why

`master-plan.md` §13 Phase 5: "The child's own life shows up only through consented, current
relationship facts." Rocky the dog re-engages Ali; a dog that died last month, a friend the
parent corrected out, or a sensitive disclosure must never appear. This ticket implements
the `StoryContext` port with those rules in code.

## Scope

### Build
`story-context.service.ts` implementing the port from P5-01; the interest-fact selection
rules; expiry and correction honouring; the sensitivity filter; parent consent flag for
"use interests in stories"; audit of which facts fed which beat.

### Do not build
No new fact kinds (P3-01 owns the schema). No inference of interests from a single
mention — that is consolidation's threshold (P3-02).

## Design

```
apps/api/src/services/story/
  story-context.service.ts   (studentId) -> StoryContext
  interest-rules.ts          eligible fact iff: kind='preference' AND sensitivity='none' AND
                             confidence >= 0.7 AND superseded_by IS NULL AND
                             (expires_at IS NULL OR expires_at > now()) AND
                             last_confirmed_at > now() - 60 days AND
                             parent story-consent = granted
  name-rules.ts              first name only, from student row, only if P2H-04 first-name
                             policy is on; never surname, never siblings' names unless a
                             consented preference fact names them
  beat-audit.ts              writes { beatId, factIds[] } into narrative_beat.metadata
apps/api/src/db/migrations/013 (reserved by P6-02) — NOT used; consent flag lives in the
                             existing `voice_consent`? No: add column via 016 in this ticket:
apps/api/src/db/migrations/016_story_consent.sql   ALTER TABLE student ADD COLUMN
                             story_interests_consent BOOLEAN NOT NULL DEFAULT false
```

Rules:
- Absence of consent yields a neutral story, never an error.
- A corrected fact (P3-06) disappears from context in the **next** turn, not the next
  session, because `story-context` reads live state per beat.
- Facts about other people (family, friends, pets) require `sensitivity='none'` and a
  preference kind; episodes are never used as story material.
- The beat writer receives labels only ("likes trucks"), never fact ids or evidence text.
- Retrieval passes through the P0-23 scrubber like every prompt input.

### Edge cases
- Interest expired between beats → dropped mid-thread; the character built on it is written
  out gracefully at the next chapter (frame supports a "character leaves" beat).
- Parent withdraws consent mid-thread → thread `paused`; resumes neutral with a new frame.
- Child corrects in-session ("I don't like Minecraft anymore") → P2H-05 intent + P3-06
  supersession; current beat finishes, next beat excludes it.
- Interest is a real brand/franchise → allowed as a label but the beat writer is instructed
  to avoid copyrighted characters; reviewed frame rules; safety check catches trademarks list.
- Conflicting facts (likes cats / scared of cats) → the lower-confidence one loses; tie →
  neither is used.
- More than 5 eligible interests → top 3 by `last_confirmed_at`.
- Fact confidence drops below 0.7 after rebuild (P3-02) → excluded.

## Acceptance criteria

- [ ] Every eligibility rule has a test; a fact failing any one is excluded.
- [ ] A superseded fact is absent from the very next beat's context.
- [ ] Episodes and sensitive facts never reach `StoryContext` (property test over generated
      fact sets).
- [ ] Without consent the story runs with zero fact ids in `beat-audit`.
- [ ] `beat-audit` links every beat to the facts used, so a parent view (P6-05) can show why
      Rocky appeared.
- [ ] The prompt input is a `ScrubbedContext` by type.

## Verification

```bash
npm run test -w @aria/api -- story-context
npm run golden:tutoring -w @aria/api -- --scenario changed-preference
```

## References

- `master-plan.md` §4.2 (layer 3 rules), §12.2/12.4/12.6, §13 Phase 5
- P3-06 (correction), P0-23 (scrubber)
