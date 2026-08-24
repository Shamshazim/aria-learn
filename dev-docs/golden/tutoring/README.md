# Tutoring golden set

This set measures Aria's conduct across a conversation, not the quality of a standalone
question. It contains the eight scenarios required by P0-22 and replays them through one
small tutor interface: `handle(event)` returns protocol moves plus deterministic trace
evidence.

The checked-in adapter is scripted. P1-06 replaces that adapter with the real tutor loop;
the scenario files, replay code, invariant checks and transcript format do not change.

## Run it

From the repository root:

```bash
npm run golden:tutoring -w @aria/api
```

Run one scenario while investigating a failure:

```bash
npm run golden:tutoring -w @aria/api -- --scenario safety-disclosure
```

The command writes Markdown transcripts and `invariant-report.json` to
`.cache/golden/tutoring/`. A failed invariant exits non-zero. Read the Markdown directly;
no viewer or grading model is required.

## What a scenario contains

Each JSON file has:

- a stable id, title, grade and description;
- learner facts with the evidence ids that support them;
- low- or high-confidence affect observations;
- human-authored answer outcomes, independent of the tutor implementation;
- ids of events known to be safety disclosures;
- an ordered sequence of valid `TutorInputEvent`s;
- scripted moves and trace evidence for the current adapter.

`answerOutcomes` is deliberately scenario-owned. A tutor cannot evade the repeated-error
check by omitting or changing its own grading trace. Other trace fields identify the
teaching approach, durable facts asserted, affect claims, response origin, crisis routing
and moves stopped by an interruption.

## Add or change a scenario

1. Copy the closest scenario and give every event and move a unique stable id.
2. Use only fields accepted by the shared event/move schemas.
3. Put known answer outcomes and safety disclosures in `context`, not in tutor evidence.
4. Add only evidence that the tutor actually used or actions it actually performed.
5. Run the full command and read the generated transcript.
6. Have two human tutors grade it independently with [`rubric.md`](rubric.md).

Never weaken an invariant to make a new transcript pass. A prompt, model, memory or voice
change that regresses either the invariant report or the human review is blocked.

## Human review

The invariant report does not grade warmth, age fit, pedagogy or factual support. Two human
tutors independently review every child-facing turn using the rubric. Record the move ids
behind every failure or disagreement so a rerun can be compared to the same evidence.

The release bar is at least 90% of eligible turns passing warmth, age-appropriateness and
pedagogical usefulness together. A model grading its own transcript is never acceptance.
