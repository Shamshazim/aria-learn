# Content golden set

This directory contains 500 grouped, deterministic evaluation cases: 300 arithmetic, 150
reading and 50 writing. Arithmetic and early decoding are intentionally the majority because
an incorrect answer or an untaught decoding pattern causes the most direct learner harm.

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
   and `reviewedAt` to an ISO timestamp.
4. Run the loader tests and the complete set. Do not approve a generated model response; the
   approval is for the checked-in expectation used to grade future responses.

New skills must add approved cases before release. Never weaken a bar to make a model pass.
