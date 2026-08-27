# P3-06 — The memory correction path

| | |
|---|---|
| **Phase** | 3 |
| **Track** | Backend |
| **Depends on** | P3-01 |
| **Blocks** | P3-08, P6-05, P5-02 |
| **Parallel-safe with** | P3-02, P3-03, P3-04, P3-05 |
| **Size** | M |

## Why

`master-plan.md` §4.2: "A parent or child can correct them — 'I don't like Minecraft
anymore' — and a correction supersedes the old claim without erasing its audit history."
§11 bar: "Parent corrections reflected in the next session: 100%." §12.6: the parent "can
correct the learner memory". No endpoint or child-side path exists.

## Scope

### Build
`POST /api/v1/parent/children/{id}/learner-memory/correct` (service, controller, schema,
router entry), the child self-correction path inside the turn loop, supersession semantics,
retrieval that honours corrections, and brief invalidation. Parent authorization uses
P2H-12's middleware; if P2H-12 is not merged, the route is registered but guarded by a
`parentAuth` port with a test double, and the ticket says so in the PR.

### Do not build
No parent UI (P6-05). No memory *viewing* route (P6-05). No erasure (P6-06).

## Design

```
apps/api/src/routes/parent.routes.ts             add the correct route (single line if file exists)
apps/api/src/controllers/parent/memory-correction.controller.ts
apps/api/src/schemas/parent/memory-correction.schema.ts
    { targetKind: 'fact'|'episode', targetId: uuid,
      action: 'retract' | 'replace', newValue?: FactValue, reason?: string(≤300) }
apps/api/src/services/memory/correct.service.ts   correct(input) -> CorrectionResult
apps/api/src/services/memory/correct/
    apply.ts            supersede target, insert replacement (if any), write learner_fact_correction
    from-child.ts       detect child self-corrections in a turn and map to a correction
    invalidate.ts       mark current week brief for regeneration (calls P3-03 generate)
apps/api/src/services/memory/relevance/rules.ts   EXTEND: rows with a correction replacement
                                                   rank first; retracted never appear
packages/tutor/src/policy/teaching-policy.ts      CHAT/QUESTION intents containing a
                                                   self-correction -> SAY acknowledgement move
```

**Semantics**
- `replace`: new `learner_fact` row with `confidence = 1.0`, evidence row
  `{source_kind: 'correction', source_id: correction.id}`, old row `superseded_by = new.id`.
  A correction-backed fact is never superseded by consolidation (P3-02 rule 1).
- `retract`: old row `superseded_by = NULL` but `expires_at = now()` and a correction row
  with `replacement_id = NULL`. Retrieval excludes expired rows; the fact is gone from
  Aria's view and present in the audit.
- Child self-correction (`from-child.ts`): deterministic patterns on child input already
  classified as CHAT/QUESTION by P2H-05 ("I don't like X anymore", "my dog is called Y now",
  "I'm in grade N now"), matched against current `preference`/`relationship` facts. Applies
  with `corrected_by = 'child'`, confidence 0.8 (a parent may override). Aria acknowledges
  in one sentence ("Got it, no more Minecraft.") and continues the lesson.
- Corrections apply **immediately** in the same session for retrieval (next turn reloads
  current facts), and invalidate the week brief so the next arrival reflects them.
- Every correction is a `session_event`-independent audit row; parent corrections also
  emit an `observability` counter `memory.correction.parent`.

### Edge cases
- Target belongs to a different child of the same parent, or to another family: 404, no
  information leak (same response as not-found).
- Target already superseded: 409 with the current row's id so the client can retarget.
- Replace with a value identical to current: no-op 200, no new rows.
- Replace with a value that fails the sensitive-category rule (P3-02 `sensitivity.ts`):
  422 — a parent may retract sensitive content, never add it as a durable fact.
- Replace with a value that fails the describe-never-judge lint ("he is lazy"): 422 with
  the violation; the parent can rephrase.
- Child self-correction that matches nothing: no correction, just the acknowledgement
  sentence; logged for review of the pattern list.
- Child "correction" that is a safety disclosure: safety classifier runs first (P1-13);
  the correction path is never reached.
- Concurrent corrections to the same fact: second gets 409.
- Correction during an active session of that child: the running session's context loader
  re-reads on the next turn; no cache to bust beyond memory retrieval.

## Acceptance criteria

- [ ] `replace` and `retract` produce the documented rows, and `listCurrent` reflects them
      immediately.
- [ ] A corrected fact survives a subsequent consolidation with contradicting evidence.
- [ ] The tutoring golden set scenario "changed preference" passes: the old preference never
      appears in any prompt or move after the correction, asserted by a fake provider.
- [ ] Child self-correction fixtures ("I don't like trucks anymore") supersede the
      preference and produce a one-sentence acknowledgement, not a lecture.
- [ ] Cross-family target returns 404 identical to a random uuid.
- [ ] Sensitive or judging replacement values are rejected with 422 and no rows written.
- [ ] Week brief is regenerated (or scheduled) after a parent correction; a test asserts the
      new brief no longer contains the corrected value.
- [ ] Router/controller/service/schema/repository are separate files; no SQL outside repositories.

## Verification

```bash
npm run test -w @aria/api -- services/memory/correct controllers/parent
npm run golden:tutoring -w @aria/api -- --scenario changed-preference
```

## References

- `master-plan.md` §4.2, §10 (parent routes), §11, §12.6
- `P3-01`, `P3-02` (conflict rule 1), `P3-03` (brief invalidation), `P2H-05` (intents), `P2H-12` (parent auth)
