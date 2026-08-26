# Content golden set

This directory contains 572 grouped, deterministic evaluation cases.

**500 model cases** (P0-21) grade a prompt: 300 arithmetic, 150 reading and 50 writing.
Arithmetic and early decoding are intentionally the majority because an incorrect answer or an
untaught decoding pattern causes the most direct learner harm.

**72 generator cases** (P2H-10) grade code rather than a prompt. Twelve per arithmetic
generator — four points of its parameter space in each of the three bands. They run no model
and cost nothing, and every check still applies to them: the arithmetic is solved
independently by the P0-16 checker, exactly one option may be correct, and the prompt must
clear the readability bar for its band. A generator that starts producing an unreadable prompt
or a second correct option fails here rather than in front of a child.

A case says which it is in its `origin` field, which defaults to `model`. Generator cases name
the point they pin in `generatorIndex` instead of carrying a `promptName` and an `input`.

## Current release status

The cases and expectations are checked in, but their `humanReview.status` values are
`pending`. This is deliberate and release-blocking. An AI agent cannot truthfully satisfy the
ticket's independent human-grading requirement. A curriculum reviewer must inspect the
instruction, structured expectation, band, skill and notes, then add their name and review
time and change the status to `approved`. The harness reports pending reviews and cannot pass
while any remain.

## Run

```bash
npm run golden:content -w @aria/api -- --endpoint anthropic-sonnet
npm run golden:content -w @aria/api -- --endpoint openai-gpt --json
```

The endpoint must exist in `apps/api/config/ai.yaml`, and its referenced environment key must
be present. Selection is by endpoint name; no source change is needed. Human-readable output
is the default and `--json` emits the same report for CI. A failed generation is recorded
against the item and the run continues.

The report includes prompt version, endpoint, subject coverage, every quality check, failing
item ids, mean and p95 latency, and total cost. A check with no eligible items is reported as
`n/a`, never silently treated as 100%.

## Review one item

1. Recompute arithmetic independently or verify the reading/writing expectation against the
   named skill.
2. Check the band and ensure the instruction tests one observable requirement.
3. Write a specific note. Set `status` to `approved`, `reviewer` to the reviewer's real name,
   and `reviewedAt` to an ISO timestamp. For a generator case the note already quotes the
   prompt and key the generator produces; confirm the wording suits the band and that exactly
   one option is correct.
4. Run the loader tests and the complete set. Do not approve a generated model response; the
   approval is for the checked-in expectation used to grade future responses.

New skills must add approved cases before release. Never weaken a bar to make a model pass.
