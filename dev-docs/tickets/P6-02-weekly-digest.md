# P6-02 — Weekly digest

| | |
|---|---|
| **Phase** | 6 |
| **Track** | Backend |
| **Depends on** | P3-03, P6-01 |
| **Blocks** | P6-09 |
| **Parallel-safe with** | P6-03, P6-04, P6-05, P6-07 |
| **Size** | M |

## Why

`master-plan.md` §7: "Plain language, five sentences, no charts." The digest is the one
thing a parent reads every week and the reason they renew (Phase 6 exit). It must be true —
every sentence traceable to events — and it must arrive without the parent opening the app.

## Scope

### Build
Migration `018` `parent_digest`; the digest composer; the weekly job; an email delivery
port with one adapter; `GET /api/v1/parent/children/{id}/digest`; opt-out.

### Do not build
No charts, no attachments beyond one optional reading page (P4-03 passage), no push
notifications, no teacher digest (P6-08).

## Design

```sql
parent_digest  id UUID PK, parent_id UUID NOT NULL REFERENCES parent(id) ON DELETE CASCADE,
               student_id UUID NOT NULL REFERENCES student(id) ON DELETE CASCADE,
               period_start DATE NOT NULL, period_end DATE NOT NULL,
               body TEXT NOT NULL, evidence JSONB NOT NULL,   -- sentence index -> event/skill ids
               kind VARCHAR(16) NOT NULL,                     -- 'weekly' | 'empty_week'
               generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
               sent_at TIMESTAMPTZ, send_error TEXT,
               UNIQUE (student_id, period_start)
```

```
apps/api/src/services/digest/
  digest.service.ts        orchestrates: gather -> compose -> gate -> store -> send
  gather.ts                sessions, minutes, skill deltas, episodes, brief for the period
  compose.ts               FAST/TEACH model prompt producing exactly five sentences + evidence map
  gate.ts                  deterministic checks (see rules); no model
  schedule.ts              weekly job: Sunday 18:00 in the parent's timezone
  delivery/email.port.ts   send(to, subject, text, html?) ; delivery/resend.adapter.ts
apps/api/src/ai/prompts/definitions/parent-digest.ts
apps/api/src/repositories/parent-digest.repository.ts
apps/api/src/controllers/parent/digest.controller.ts
apps/api/src/scripts/run-digests.ts
```

Rules:
- Exactly five sentences (deterministic sentence count check). Each sentence maps to ≥1
  event, skill-state delta or episode id in `evidence`; a sentence with no evidence fails the
  gate and the digest is regenerated once, then falls back to the deterministic template
  (`compose.ts` has a template path that uses numbers only: sessions, minutes, one skill
  gained, one skill to watch, one suggestion).
- No numbers that read as marks: minutes and counts are allowed; percentages, scores,
  levels-as-numbers and comparisons to other children are banned by regex in `gate.ts`.
- Label lint from P3-03 applies: no diagnosis, no "gifted"/"slow"/"behind grade level" as a
  verdict. "Behind where I'd like" is fine (§7 example).
- Describe what happened, then what Aria will do next week, then one thing the parent can do.
- The prompt receives scrubbed context only (P0-23); the composed body is unscrubbed for the
  parent (child's first name inserted after generation, never sent to the vendor).
- Delivery is a port; the email adapter is configured by env, absent in test.

### Edge cases
- Zero sessions in the week → `empty_week` digest, two sentences, no blame ("Families have
  lives", §14), not sent more than two weeks in a row.
- Child created mid-week → first digest covers the partial week and says so.
- Two children → one email per child, or one email with two sections if the parent chose
  `digest_combined` in controls.
- Parent has no verified email → digest stored, `sent_at` null, shown in-app.
- Send failure → `send_error` set, retried by the next job run up to 3 times, then surfaced
  in-app only.
- Job re-run for the same period → idempotent via the unique index; regeneration only with an
  explicit `--force`.
- Timezone unknown → UTC, stated in the parent's controls page.
- Safety flag in the period → the digest never repeats crisis text; it says a flag exists and
  links to the transcript (P6-05) if the matrix row permits parent visibility (P6-07).
- Child archived → no digest.
- Opt-out → no email; in-app digest still generated.

## Acceptance criteria

- [ ] Migration `018` applies; one digest per child per period is enforced by the database.
- [ ] Every generated digest has exactly five sentences and every sentence has evidence ids,
      proven by a test over ten weeks of fixture events.
- [ ] Banned patterns (percentages, grades, labels, other-child comparison) never appear;
      a fixture designed to provoke each is rejected by `gate.ts`.
- [ ] The empty-week path, the mid-week-creation path and the model-outage path each produce
      a sent digest from the template.
- [ ] No identifying data is in the prompt (scrubber test); the first name is in the email.
- [ ] `GET /parent/children/{id}/digest` returns the latest and lists prior periods; ownership
      enforced.
- [ ] Weekly job is idempotent; a second run in the same period sends nothing.
- [ ] Human review: three parents read three digests each and rate them "true and useful";
      recorded in the PR.

## Verification

```bash
npm run test -w @aria/api -- digest
npm run digest:preview -w @aria/api -- --student <id> --week 2026-08-17
```

## References

- `master-plan.md` §7, §10, §12.8, §14; P3-03 (brief), P0-23 (scrubber), P6-07 (flag visibility)
