# P6-06 — Delete means delete, and export

| | |
|---|---|
| **Phase** | 6 |
| **Track** | Backend |
| **Depends on** | P2H-12, P6-01 |
| **Blocks** | P6-09 |
| **Parallel-safe with** | P6-02, P6-03, P6-04, P6-05, P6-07, P6-08 |
| **Size** | M |

## Why

`master-plan.md` §12.9: "A parent can erase a child's entire history, and it is gone."
Cascades exist in the schema, but a cascade does not reach the content cache, the speech
assets, the STT/TTS processors, the identity provider or a queued digest. This ticket makes
deletion a verified sequence, and gives the parent their data before they go.

## Scope

### Build
`DELETE /api/v1/parent/children/{id}`, `DELETE /api/v1/parent/me`,
`POST /api/v1/parent/children/{id}/export`; the deletion orchestrator across every store and
processor; a verification job that proves zero rows remain; the export bundle.

### Do not build
No soft delete for children. No "restore". No retention exceptions except a legally required
tombstone (id + deleted_at + reason only).

## Design

```
apps/api/src/services/deletion/
  child-deletion.service.ts    the ordered sequence below; idempotent; resumable
  parent-deletion.service.ts   children first, then adult sequence from rewrite.md §6
  steps/
    close-sessions.ts          end live sessions, close voice rooms (LiveKit), revoke tokens
    delete-audio.ts            createAudioDeletionService.deleteForStudent (existing)
    delete-processor-copies.ts every processor in voice-processor-map.md via ProcessorDeletionPort
    delete-personalised-content.ts content_item rows scoped to the child; speech_asset rows
                               whose content_hash is only referenced by this child's moves
    delete-rows.ts             explicit deletes in dependency order, then cascade as backstop
    purge-queues.ts            pending digests, consolidation jobs, pre-generation jobs
    tombstone.ts               deletion_tombstone(subject_kind, subject_id, at, reason)
    verify.ts                  counts every table with a student_id/parent_id FK => must be 0
  export/
    export.service.ts          builds a zip: transcripts.json, learner-memory.json,
                               briefs.md, writing/, oral-reading.json, controls.json
    export.port.ts             signed-URL storage, 24h expiry
apps/api/src/db/migrations/021_deletion_tombstone.sql
apps/api/src/repositories/deletion.repository.ts   (the only place a cross-table count lives)
```

Sequence for a child: close sessions → export offered (parent may skip) → delete audio and
processor copies → delete personalised content and orphaned speech assets → purge queues →
delete rows → verify → tombstone → audit event to observability. Failure at any step leaves a
`deletion_job` row in `failed` with the step name; retry is idempotent; the child stays
blocked from sessions from step 1 onward.

Rules:
- Every table with a `student_id` or `parent_id` column is enumerated by a test that reads
  `information_schema` and fails if a table is missing from `verify.ts`'s list — a new table
  cannot be forgotten.
- Shared verified content (§4.5) is **not** deleted: it contains no child data. Personalised
  content (`content_item.student_id IS NOT NULL`) is.
- `ai_generation_log` and `ai_cost` rows keep cost numbers but lose `student_id` (set null) —
  cost accounting survives, identity does not.
- Identity provider: adult deletion revokes sessions, deletes Aria rows, then hard
  `deleteUser` (P0-26 decision). Children have no IdP row.
- Processor deletion follows `voice-processor-map.md`; where a processor has no deletion API
  the map says so and counsel sign-off (P2-14) covers it; the step records `not_applicable`
  rather than success.
- Export is generated before deletion and offered once; the link expires in 24h; the bundle
  contains only this child's data.
- Backups: the deletion is recorded in `deletion_tombstone`; the restore runbook (X-01) must
  replay tombstones after any restore.

### Edge cases
- Deletion requested during a live voice session → session closed within one turn, the child
  sees the P0-25 goodbye screen.
- Parent with two children deletes one → the other is untouched (test counts).
- Deletion job crashes mid-way → resumed from the failed step by the next job run; verify
  runs at the end regardless.
- Processor deletion returns 404 (already gone) → treated as success.
- Processor deletion times out → step failed, retried with backoff for 72h, then paged.
- Export requested after deletion → 410.
- Re-deleting a deleted child → 404 (tombstone exists, no data).
- Teacher class roster references the child (P6-08) → membership row deleted; the teacher
  sees "a student left the class", no name.
- Safety flags → deleted with the child; a legally required record, if any, is the tombstone
  reason only, per counsel.

## Acceptance criteria

- [ ] After child deletion, `verify.ts` reports zero rows in every FK-bearing table; an
      `information_schema` test proves the list is complete.
- [ ] Personalised content and orphaned speech assets are gone; shared content is intact.
- [ ] Every processor in the map is called or recorded `not_applicable`; a fake port records
      the calls.
- [ ] A crash injected at each step leaves a resumable job; the resumed job completes and
      verifies.
- [ ] Parent deletion removes children, Aria rows, then calls the IdP hard delete; a JWT
      issued before deletion is rejected afterwards.
- [ ] Export bundle contains transcripts, memory, briefs, writing and oral reading for exactly
      one child; link expires.
- [ ] Sibling isolation proven by counts.
- [ ] Migration `021` applies; tombstone holds no personal data.

## Verification

```bash
npm run test -w @aria/api -- deletion
npm run deletion:verify -w @aria/api -- --student <id>
```

## References

- `master-plan.md` §12.2, §12.9; `rewrite.md` §6; `voice-processor-map.md`; P0-26, P2-14,
  `services/voice/audio-deletion.service.ts`
