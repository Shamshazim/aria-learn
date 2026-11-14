# Phase 3 exit evidence

Current status: **not passed**.

`master-plan.md` §13: "the tutor opens already knowing the child without inventing facts;
every durable claim links to evidence; a parent can correct it; and Aria changes approach
when a child appears tired or frustrated without turning a temporary state into a permanent
label." §11: a model grading its own tutoring is not acceptance.

`evaluatePhase3Exit()` in `@aria/tutor` is the executable gate. `npm run phase3:report -w
@aria/api` collects its evidence and writes `.cache/phase3/report.json`. Every criterion is
`passed`, `failed`, `missing` or `insufficient_sample`; a source that cannot be reached is
`missing`, never zero problems. No criterion is met by a model judging its own output: the
automated evidence is SQL counts and deterministic transcript invariants, the rest is
recorded by people.

## How to run it

```bash
npm run golden:tutoring -w @aria/api -- --scenario 'phase3/*'   # the six Phase 3 scenarios
npm run memory:rebuild -w @aria/api -- --all --report           # criterion 6 reads the latest run
npm run bench:arrival -w @aria/api                              # criterion 1's p95, against a running API
npm run phase3:report -w @aria/api                              # the gate
```

Human observations go in `dev-docs/phase3-observations.json` (child ids only; the schema
refuses anything else). An observation older than 60 days at evaluation, or dated in the
future, is not counted.

## Latest run

Run on the developer database at `6b1eb00` (P3-07 complete, before this branch), 2026-11-14.
That database holds no learner memory and no observations have been recorded, so this run
says what is still to be gathered, not how Aria behaves with real children.

| #   | Criterion                                | Status              | Automated evidence                                                   | Human evidence               |
| --- | ---------------------------------------- | ------------------- | -------------------------------------------------------------------- | ---------------------------- |
| 1   | Opens knowing the child                  | missing             | cohort below 20 returning children; no arrival benchmark recorded    | 0 of 10 parent confirmations |
| 2   | No invented facts                        | missing             | `invented-fact-trap` and `brief-drift`: 0 unsupported claims         | 0 of 50 reviewed briefs      |
| 3   | Every durable claim links to evidence    | insufficient sample | no facts or episodes in this database                                | —                            |
| 4   | Parent correction reflected next session | missing             | `correction-next-session`: passed                                    | 0 of 5 parent corrections    |
| 5   | Adapts without a label                   | missing             | `tired-adapts-no-label`: adapted, 0 state labels; 0 engagement facts | 0 of 10 check-in ratings     |
| 6   | Memory rebuild drift                     | missing             | no rebuild run recorded                                              | —                            |
| §11 | Two wrong answers without a change: 0    | passed              | 0 across all 16 golden scenarios                                     | —                            |
| §11 | Low-confidence affect stated as fact: 0  | passed              | 0 across all 16 golden scenarios                                     | —                            |
| —   | Human observation protocol               | missing             | —                                                                    | 0 of 3 children per band     |

No criterion has **failed**, so no fix ticket is owed by the gate itself yet. Findings from
building it are filed: [P3-08-F1](tickets/P3-08-F1-procedure-step-answers.md) (procedures
take only the whole answer) and [P3-08-F2](tickets/P3-08-F2-suite-timing-flakes.md) (timing
flakes under full-suite load).

The gate is re-run after every fix PR; this section records each run's commit and date, and
the passing run's observation table below.

## Protocol

For each band (early, middle, senior), at least three children who have used Aria for two
weeks or more. An adult observer sits in on a session and notes:

- **each welcome** — what Aria said she remembered, and whether the parent confirms it is
  true for their child (criterion 1);
- **each check-in** — whether it was a real question, warm and brief, scored on the rubric's
  Warmth and Age fit (criterion 5's 90% bar);
- **each change of approach** — what Aria changed to and whether it was a real change (§11).

The parent then reads that week's brief and marks every sentence true, false or unsure; a
false or unsure learner claim is an unsupported claim (criterion 2). Five parents also make
one correction in the parent view, and the observer checks the next session uses it and
never the old fact (criterion 4).

Recorded one row per child, child id only, never a name:

| Child id | Band | Weeks of use | Welcome true | Check-ins warm / total | Brief sentences false or unsure | Correction reflected | Observed on |
| -------- | ---- | ------------ | ------------ | ---------------------- | ------------------------------- | -------------------- | ----------- |
|          |      |              |              |                        |                                 |                      |             |
