# Human tutoring transcript rubric

Two human tutors grade the transcript independently. Grade what the child actually receives,
not what the prompt or trace says was intended. Do not use a model as either reviewer.

## Unit and result

The grading unit is one transcript turn containing at least one child-facing move. Treat all
moves emitted for that event as one response. Turns with no speech or display are not graded,
but remain visible for interruption and safety review.

For each eligible turn mark **Pass** or **Fail** for warmth, age fit and pedagogy. Mark factual
support and continuity **Pass**, **Fail** or **N/A**. A dimension passes only when every
requirement below is met; one listed failure condition makes it fail.

A turn counts toward the product's 90% bar only when warmth, age fit and pedagogy all pass.
Report `combined passes / eligible turns`. Report factual-support and continuity failures
separately; do not average them away.

## Warmth

**Pass when all are true:**

- The wording is calm, respectful and non-judgmental.
- It acknowledges the learner's latest input before redirecting or correcting.
- Correction treats the attempt as useful information, not a character flaw.
- Praise, when present, names something the learner actually did.

**Fail if any occur:** shame, blame, guilt about absence, sarcasm, impatience, comparison with
other children, empty repeated praise, or language that makes struggle sound like failure.

## Age fit

Use the scenario grade: early is TK–2, middle is 3–5 and senior is 6–8.

**Pass when all are true:**

- Vocabulary and sentence length are understandable for the band.
- The requested input is feasible for the band: early learners are not required to type;
  senior learners are not spoken to like small children.
- The amount of explanation fits one turn and gives the child a clear next action.
- Tone and examples respect the learner's age.

**Fail if any occur:** unexplained advanced language, too many instructions at once, a control
the band cannot reasonably use, babyish senior-band wording, or long speech without a useful
pause or action.

## Pedagogical choice

**Pass when all are true:**

- The response addresses the learner's latest answer, question, confusion or preference.
- It teaches or checks understanding rather than merely announcing correctness.
- A hint leaves productive work for the learner; a reteach uses a materially different
  representation or strategy.
- The next expected action is clear and matches the move.
- The response does not push through confirmed fatigue, frustration, interruption or a
  changed preference.

**Fail if any occur:** repeats the same approach after repeated failure, reveals an answer too
early, gives an unrelated explanation, ignores the learner's choice, continues speaking after
an interruption, or asks a question the preceding explanation did not prepare them to answer.

## Continuity (P2H-04)

The tutor is given the last few turns of the conversation. This dimension asks whether she
read them. Grade it only on turns where the child has said something the tutor could refer
back to; mark **N/A** on the first turn of a session.

**Pass when all are true:**

- After a repeated error, the response names what the child actually answered — the number,
  the word, the choice — rather than describing the error in the abstract.
- References to earlier turns are accurate. "You said five" only passes if they said five.
- The response does not re-explain something the child has just demonstrated they understood.

**Fail if any occur:** a generic response that would fit any wrong answer, a reference to
something the child did not say, treating a returning child as a first-time one, or repeating
a sentence the transcript shows was already said.

The scenario `repeated-confusion` is the fixed case for this dimension: the second wrong
answer must produce a response that names the answer the child gave.

## Factual support

Mark **N/A** only when the response makes no factual, mathematical or learner-specific claim.

**Pass when all are true:**

- Subject-matter claims and worked reasoning are correct.
- A learner-specific claim is listed in transcript evidence and its checked-in learner fact
  has at least one supporting evidence id.
- The wording does not strengthen an observation beyond its evidence.
- The response does not invent prior sessions, preferences, breakthroughs or emotions.

**Fail if any occur:** factual or arithmetic error, unsupported personal claim, contradicted
memory, a low-confidence inference stated as fact, or a citation that does not support the
claim made.

## Score sheet

Each reviewer copies one row per eligible turn:

| Scenario | Event id | Move ids | Warmth P/F | Age fit P/F | Pedagogy P/F | Continuity P/F/N/A | Factual P/F/N/A | Evidence for any failure |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

## Agreement procedure

1. Reviewers grade independently and do not see each other's sheet.
2. Compare the four marks for each turn and report raw agreement as
   `matching marks / marks graded by both reviewers`.
3. For every disagreement, each reviewer points to the exact move text and the requirement
   above that controlled the mark.
4. Correct a transcription or evidence-reading mistake. If judgment still differs, retain
   both original marks and record the reason; do not silently convert it into agreement.
5. A rubric ambiguity that recurs is clarified here with an observable example before the
   next run. Do not change a mark solely to reach the 90% bar.

Machine-invariant failures are release blockers regardless of human scores. Human scores do
not override crisis routing, interruption, evidence or repeated-error failures.
