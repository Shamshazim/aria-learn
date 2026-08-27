# Lesson note review

Every skill in the P0-17 inventory has a note in this directory, and every note declares its
review status in its front matter. A note grounds what Aria says about a skill, so its
`review:` line is the record of a teacher having read it — not a formality.

## Current status

**All sixteen notes are `pending`.** They were drafted while implementing P2H-10 and no
teacher has read them. An agent cannot approve its own curriculum content, so approval is
release-blocking work that a person has to do.

## Approving a note

1. Read the note against the skill it names in `../inventory/`.
2. Check the one idea is the idea, that the three stumbles are ones children actually make,
   and that the two models are genuinely different pictures rather than one restated.
3. Check the language lists: everything under "Language to use" should be sayable to a child
   in that skill's band, and everything under "Language to avoid" should be the adult word
   for the same thing.
4. Change the front matter to:

   ```yaml
   review: approved
   reviewer: <your name>
   reviewedAt: <ISO-8601 timestamp>
   ```

5. Run `npm run test -w @aria/api -- curriculum`.

## Why the loader does not block on this

An unreviewed note is still better grounding than a bare skill code, and blocking the tutor
loop on a review queue would take the whole product offline. The status is reported instead:
`lessonReviewReport()` counts what is approved, and the Phase 2H exit gate reads it.
