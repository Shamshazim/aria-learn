# P4-07 — The writing coach loop

| | |
|---|---|
| **Phase** | 4 |
| **Track** | Backend + Frontend |
| **Depends on** | P1-06 |
| **Blocks** | P4-08, P4-09 |
| **Parallel-safe with** | P4-01, P4-02, P4-03, P4-04, P4-05, P4-06 |
| **Size** | L |

## Why

`master-plan.md` §6.2: "Not a grade. Not a list of every error. **One specific improvement,
and a reason.**" The loop is write → one note → rewrite → be noticed. The child's writing is
"the most convincing evidence of growth a parent will ever see" and is retained until the
parent deletes it. Nothing in the current tree stores or coaches writing.

## Scope

### Build
Migration `014` `child_writing`; `POST /api/v1/student/writing`; the note generator with
its gate; the revision-acknowledgement step; band-specific ladder rungs; the writing surface
in middle and senior layouts; `WRITING` skills (WR.LETTER, WR.WORD, WR.SENTENCE,
WR.SENTENCES, WR.PARAGRAPH, WR.PIECE) in the inventory.

### Do not build
No handwriting recognition. No early-band typing (letters/words for TK–2 come through tiles
in P4-08 and are graded by tile ids, not this endpoint). No parent view (P6-05 reads
`child_writing`). No plagiarism/AI detection.

## Design

```sql
-- 014_child_writing.sql
child_writing  id UUID PK, student_id UUID REFERENCES student ON DELETE CASCADE,
               session_id UUID REFERENCES session ON DELETE SET NULL,
               skill_code VARCHAR(32) REFERENCES skill(code),
               at TIMESTAMPTZ NOT NULL DEFAULT now(),
               prompt TEXT NOT NULL, draft TEXT NOT NULL,
               aria_note TEXT, note_focus VARCHAR(32),     -- 'sentence_starts' | 'ending' | ...
               revision TEXT, revised_at TIMESTAMPTZ,
               acknowledgement TEXT, noticed_change BOOLEAN,
               deleted_at TIMESTAMPTZ                        -- parent delete = hard delete (P6-06); this is soft for undo window
CREATE INDEX child_writing_student_at_idx ON child_writing (student_id, at DESC);
```

```
apps/api/src/routes/student.routes.ts        + POST /student/writing (one line)
apps/api/src/controllers/writing.controller.ts
apps/api/src/schemas/writing.schema.ts       { sessionId, writingId?, text, phase: 'draft'|'revision' }
apps/api/src/services/writing/
  writing.service.ts        draft -> note -> store; revision -> diff -> acknowledgement -> store
  prompt.service.ts         picks a writing prompt by rung and (Phase 5) interests
  one-note.service.ts       asks the TEACH model for exactly one improvement + reason from a
                            fixed focus taxonomy; deterministic pre-checks pick the focus when
                            obvious (every sentence starts with the same word; no ending
                            punctuation; one-sentence paragraph)
  notice-change.ts          deterministic diff: did the revision address the focus?
                            (e.g. distinct sentence starters increased) -> acknowledgement
                            names the change; if unchanged, acknowledge effort + re-offer once
  focus-taxonomy.ts         ~15 focuses with band applicability and detector functions
apps/api/src/repositories/child-writing.repository.ts
apps/api/src/ai/prompts/definitions/writing-note.ts, writing-acknowledge.ts
apps/web/src/features/writing/
  components/WritingBox.tsx           middle: big textarea, spoken prompt; senior: workpad
  components/AriaNote.tsx             one note, one reason, "try it" button
  hooks/useWriting.ts
  api/writing.api.ts
```

Rules:
- The note names **one** thing. The gate rejects a note with more than one imperative or a
  list; regenerate once, then use a reviewed generic note for the detected focus.
- The note never contains a grade, score, letter or "good/bad". Banned-token check in the gate.
- Acknowledgement must reference the actual change ("Two of your sentences start differently
  now") — produced from `notice-change` output, not the model's guess.
- Draft and revision are both kept; the draft is never overwritten.
- Writing is retained until the parent deletes (P6-06); consolidation (P1-09) may cite it as
  evidence but never copies sensitive content into facts (P1-13 rule).
- Ladder: TK–2 letters/words via tiles (P4-08); Grade 2–3 one sentence; 3–5 several sentences
  → paragraph; 6–8 a short piece. Rung chosen from WR.* skill state, never asked.

### Edge cases
- Empty or whitespace draft → 400; UI prevents submit.
- Draft over 2000 chars (senior) / 400 (middle) → 413 with a gentle UI message; no truncation.
- Draft contains crisis language → P1-13 input classifier runs **first**; crisis path, no note,
  writing row still stored with `safety_flag` link.
- Draft contains personal info (address, school) → stored, but that content is excluded from
  the prompt sent to the model (scrubber) and never becomes a fact.
- Model unavailable → deterministic focus detector + reviewed generic note; logged.
- Revision identical to draft → "You kept it the same — want to try the one thing?" once; a
  second identical revision → acknowledge effort, `SWITCH`.
- Revision made it worse on the focus → acknowledge the attempt, name what changed, no
  second note this session.
- Session ended between draft and revision → revision accepted next session if
  `writingId` matches and belongs to the student; otherwise a new draft.
- Two drafts in flight → only the latest `writingId` accepts a revision.
- Pasted text with Markdown/HTML → stored raw, rendered as plain text; structural gate strips
  from Aria's output only.

## Acceptance criteria

- [ ] Migration `014` applies; deleting a student removes its rows.
- [ ] `POST /student/writing` draft returns exactly one note with one reason; a two-note
      model response is rejected by the gate and retried — test with a fake provider.
- [ ] No note ever contains a grade token (fixture of 50 banned forms).
- [ ] Acknowledgement text is derived from the deterministic diff, proven by a test where the
      model is disabled.
- [ ] Crisis text in a draft produces the P1-13 path and no note.
- [ ] Draft is immutable after revision; both are readable by the repository.
- [ ] Middle and senior layouts render the writing surface; early band never does.
- [ ] Every child-facing note passes the P0-18 gate (count assertion).

## Verification

```bash
npm run migrate -w @aria/api
npm run test -w @aria/api -- writing
npm run test -w @aria/web -- writing
npm run golden:tutoring -w @aria/api -- --scenario writing-loop
```

## References

- `master-plan.md` §5 (middle/senior), §6.2, §9 (`child_writing`), §10, §12.4, §14 (no grades)
- P1-13 (safety first), P0-23 (scrubbing)
