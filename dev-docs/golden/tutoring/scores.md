# Human rubric scores

Where the numbers from [`rubric.md`](rubric.md) are recorded. One table per grading round.

Two human tutors grade each round independently, against transcripts written to
`.cache/golden/tutoring/` by `npm run golden:tutoring -w @aria/api`. Do not use a model as
either reviewer — the point of the round is to hear from someone the model cannot argue with.

The bar rises across the phase:

| Gate | Bar | Set by |
|---|---|---|
| P2H-03 | ≥ 80% of eligible turns pass warmth + age fit + pedagogy | Aria persona and the per-move prompt library |
| P2H-14 | ≥ 90% | "Sounds human" acceptance |

A round is only meaningful against a recorded commit: prompts, persona and thresholds all
move, and a score without a commit cannot be compared to the next one.

## Round 1 — P2H-03 persona

| Field | Value |
|---|---|
| Commit | _pending_ |
| Persona version | 1.0.0 |
| `respond` prompt version | 1.0.0 |
| Provider / model | _pending_ |
| Scenarios graded | the 8 in `scenarios/` |
| Reviewer A | _pending_ |
| Reviewer B | _pending_ |
| Graded on | _pending_ |

### Result

| Dimension | Reviewer A | Reviewer B | Agreed |
|---|---|---|---|
| Warmth | _pending_ | _pending_ | _pending_ |
| Age fit | _pending_ | _pending_ | _pending_ |
| Pedagogy | _pending_ | _pending_ | _pending_ |
| **Combined (the bar)** | _pending_ | _pending_ | _pending_ |
| Factual support failures | _pending_ | _pending_ | _pending_ |

| | |
|---|---|
| Eligible turns | _pending_ |
| Combined passes | _pending_ |
| **Pass rate** | _pending_ |
| **Verdict vs the 80% bar** | _pending_ |

### Turns both reviewers failed

_Pending. List them by scenario and event id, with the reason in the reviewer's own words.
These are the next prompt changes; a score with no examples cannot be acted on._

### Disagreements

_Pending. Where the two reviewers split, record both readings rather than averaging. A split
usually means the rubric is ambiguous, not that one reviewer is wrong._

## What the tests already guarantee

The rubric is for judgement, not for the mechanical rules. These are enforced in code and do
not need a human's time:

- Aria never repeats her previous sentence (`SENTENCE_REPEATED` invariant, P2H-01).
- Senior-band prose has no exclamation marks; early-band prose is at most two sentences
  (`register.ts`, P2H-03).
- Readability sits inside the band (`level.check.ts`, P2H-02).
- Every generation records its prompt name and version, so a bad turn is traceable to the
  prompt that wrote it.
