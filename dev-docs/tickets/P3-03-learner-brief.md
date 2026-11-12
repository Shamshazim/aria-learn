# P3-03 — The learner brief

| | |
|---|---|
| **Phase** | 3 |
| **Track** | Backend |
| **Depends on** | P3-01, P3-02 |
| **Blocks** | P3-08, P6-02 |
| **Parallel-safe with** | P3-04, P3-05, P3-06 |
| **Size** | M |

## Status

**Code complete 2026-11-12** on `feat/P3-03-learner-brief`, pending review. Stacked on P3-06
(#36) ← P3-05 (#35) ← P3-04 (#34) ← P3-01 (#33). P3-02 is not built; nothing here needs it
except its rebuild, which can compare against the `evidence_snapshot` every brief now stores.

- **Every sentence cites its evidence.** The prompt gives each fact, episode and skill a short
  reference (`F1`, `E1`, `S1`); the model returns sentences with the references they rest on,
  and a sentence citing nothing, or a reference that was never offered, is dropped. That is
  what makes the snapshot exactly the ids the body uses, and why removing a fact removes its
  sentence.
- **The prompt input has no field for a previous brief**, and its schema is strict; a test
  proves both (a `@ts-expect-error` and a refused parse).
- **The child is `[child]` to the model**; the first name goes back in afterwards, so it is in
  the stored body and in no request (asserted with a provider that records every request).
  `renderPrompt` scrubs again on the way out.
- **Lint → regenerate once with the violations → template**, logged `brief.lint.failed`. The
  same template is written when no model is configured, the model fails, or the safety check
  refuses the paragraph (`generator = 'template'`). The lint shares P3-06's describe-never-judge
  patterns and adds the ticket's labels, diagnoses, scores, grade letters and skill codes.
  "Behind" counts only as a verdict ("is behind", "falling behind in maths"), and "add" is not
  a label (it is arithmetic).
- **Safety** is the P0-18 gate's safety check only, at the senior band: the gate's reading-level
  and claims checks are about text a child reads.
- **Retrieval:** `currentForTurn` is the newest current week brief from the last 14 days, or
  `null`. It reaches the turn as a new scrubbed-context category, `learner_brief` (with a parent
  disclosure entry), and the `respond` prompts now open with it — both bumped to 1.1.0. With no
  brief there is no heading at all.
- **P3-06's rebuild is real now:** a parent's correction, or a child's after their turn commits,
  regenerates the current week brief in the background, and a test asserts the corrected value
  is gone from it.
- **Not done:** "no percentage, grade or label over the tutoring golden set" — the golden
  scenarios are scripted and never call the brief; the lint enforces it on every write instead.

## Why

`master-plan.md` §4.2 Layer 4: a short, parent-readable paragraph the tutor reads at the top
of a conversation — "a generated view of Layers 1–3, never the authoritative memory itself",
"regenerated from current evidence, not recursively summarised from the previous paragraph",
versioned by week, month and school year, and it "describes, never judges". Today the tutor
opens on a JSON blob of facts. The brief is what makes Aria open a session *knowing* the
child.

## Scope

### Build
Brief generation, the describe-never-judge lint, versioning, the retrieval hook that puts the
current brief into `ScrubbedContext`, and a CLI/job entry point.

### Do not build
No parent-facing route (P6-05 reads `learner_brief`). No digest (P6-02). No scheduler
infrastructure; the job is a CLI that cron or CI can call.

## Design

```
apps/api/src/services/brief/
  brief.service.ts              generate(studentId, period, periodStart) -> LearnerBrief
  evidence.collector.ts         gathers current facts, episodes, skill_state, goals for the period
  brief.prompt.input.ts         builds the scrubbed structured input (never the previous body)
  lint/
    describe-not-judge.ts       deterministic lint: banned-label list + patterns
    banned-labels.data.ts       "gifted", "slow", "lazy", "behind" (as a label), "ADHD",
                                "dyslexic", any diagnosis, IQ, percentile, grade letter
    readability.ts              parent-readable bar: ≤ 120 words week, ≤ 200 month, ≤ 350 year
  brief.cli.ts                  `npm run brief:generate -w @aria/api -- --student <id> --period week`
apps/api/src/ai/prompts/definitions/learner-brief.ts   registered in registry.ts
apps/api/src/services/memory/present/to-context.ts     EXTEND: ScrubbedContext.brief (current week)
```

Interfaces:

```ts
export type BriefPeriod = 'week' | 'month' | 'year';
export type BriefService = Readonly<{
  generate(input: { studentId: string; period: BriefPeriod; periodStart: Date }): Promise<LearnerBrief>;
  currentForTurn(studentId: string, now: Date): Promise<string | null>;  // week brief body
}>;
```

Rules:
- **Input to the model is the evidence, never the prior brief.** `brief.prompt.input.ts`
  has no parameter for a previous body; enforced by type.
- Every generated body is stored with `evidence_snapshot` (ids used) so P3-02's rebuild can
  regenerate and compare.
- The lint runs *after* the model and *before* the write. A failed lint regenerates once with
  the violations listed; a second failure writes the deterministic template brief (facts
  listed plainly) and logs `brief.lint.failed`.
- The brief passes the P0-18 safety check like any child-adjacent text (a parent reads it; a
  model wrote it).
- Names: the brief is parent-facing and lives inside Aria's boundary, so the model input is
  still scrubbed (pseudonym) and the child's first name is substituted back *after*
  generation by `present/`, never sent.
- Skill statements use skill names, not codes, and never mastery percentages.
- Retrieval: `currentForTurn` returns the newest non-superseded `week` brief whose
  `period_start` is within 14 days; otherwise `null`, and the tutor proceeds on facts only
  (never an empty string that a prompt might quote).
- Year brief is the school-year (configurable start month, default August).

### Edge cases
- New child with no sessions: no brief is generated; `currentForTurn` is `null`.
- Period with zero sessions but existing facts: month/year briefs still generate from
  standing facts; week brief is skipped (nothing to say) and logged.
- Evidence contains a superseded fact between collection and write: the write re-checks
  `superseded_by IS NULL` for every id in the snapshot and drops stale ones.
- Fact corrected after the brief was written: P3-06 marks the brief `superseded_by = NULL`
  but sets a `stale` signal by calling `generate` again for the current week.
- Model unavailable: template brief, flagged `generator = 'template'`.
- Body longer than the readability bar: lint fails, regenerate with an explicit word cap.
- Two generators race for the same period: UNIQUE(version) retry in P3-01 handles it.

## Acceptance criteria

- [x] `generate` for the golden student produces a week, month and year brief; each is
      ≤ the word cap and passes the lint and the safety check.
- [x] A test proves the prompt input type cannot carry a previous brief body.
- [x] A fixture containing every banned label fails the lint; a clean fixture passes.
- [x] Every sentence about a skill in the generated briefs is traceable to an id in
      `evidence_snapshot` (checked by a test that removes one fact and regenerates: the
      corresponding sentence disappears).
- [x] The child's first name appears in the stored body and never in the model request,
      asserted by a fake provider that records requests.
- [x] `currentForTurn` returns `null` for a child with no recent week brief and the turn
      loop still runs.
- [x] Old versions remain readable via `history`; the newest is `current`.
- [ ] No mastery percentage, letter grade or label in any generated brief over the tutoring
      golden set.

## Verification

```bash
npm run test -w @aria/api -- services/brief
npm run brief:generate -w @aria/api -- --student <golden-student-id> --period week
npm run golden:tutoring -w @aria/api -- --scenario arrival-after-absence
```

## References

- `master-plan.md` §4.2 (Layer 4, "Time buckets", "Rules that keep this safe"), §7, §12.8
- `P0-23-privacy-scrubber.md`, `P3-01`, `P3-02`
