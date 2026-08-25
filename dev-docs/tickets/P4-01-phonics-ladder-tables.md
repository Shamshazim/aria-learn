# P4-01 — The phonics ladder: patterns, taught-pattern list and oral-reading tables

| | |
|---|---|
| **Phase** | 4 |
| **Track** | Backend |
| **Depends on** | P1-03 |
| **Blocks** | P4-02, P4-04, P4-05 |
| **Parallel-safe with** | P4-07, P5-01 |
| **Size** | M |

## Why

`master-plan.md` §6.1: "A child cannot skip a rung." Decodable text is only decodable
against *this* child's taught patterns, and oral reading only becomes skill evidence when a
missed word can be traced to a pattern. Neither is possible until phonics patterns and the
per-child taught list are rows, not prose. This ticket is the data foundation for all of
Phase 4 reading.

## Scope

### Build
Migration `013`: `phonics_pattern`, `student_phonics`, `oral_reading`; the reading skill
ladder (PA.*, PH.*, FL.*, CMP.*) seeded into `skill` with prerequisites; repositories and
types; a `taughtPatternsFor(studentId)` service.

### Do not build
No filter (P4-02), no passage generation (P4-03), no assessment (P4-04). No UI.

## Design

```sql
-- 013_phonics.sql
phonics_pattern  id UUID PK, code VARCHAR(32) UNIQUE NOT NULL,        -- 'CVC', 'CVCE', 'DIGRAPH_SH'
                 name TEXT NOT NULL, rung SMALLINT NOT NULL,         -- 1..6 = ladder rung
                 graphemes TEXT[] NOT NULL,                          -- ['a','e','i','o','u'] etc
                 examples TEXT[] NOT NULL, band VARCHAR(16) NOT NULL,
                 skill_code VARCHAR(32) REFERENCES skill(code),       -- the skill that teaches it
                 sort_order INTEGER NOT NULL
student_phonics  student_id UUID REFERENCES student ON DELETE CASCADE,
                 pattern_id UUID REFERENCES phonics_pattern ON DELETE CASCADE,
                 taught_at TIMESTAMPTZ NOT NULL, mastered_at TIMESTAMPTZ,
                 source_event_id UUID REFERENCES session_event(id),
                 PRIMARY KEY (student_id, pattern_id)
oral_reading     id UUID PK, student_id UUID REFERENCES student ON DELETE CASCADE,
                 session_id UUID REFERENCES session ON DELETE CASCADE,
                 event_id UUID REFERENCES session_event(id),
                 passage_id UUID REFERENCES content_item(id),
                 at TIMESTAMPTZ NOT NULL DEFAULT now(),
                 wcpm INTEGER, wcpm_lower INTEGER, wcpm_upper INTEGER,
                 accuracy NUMERIC(4,3), confidence VARCHAR(16) NOT NULL,   -- 'low' | 'adequate'
                 speaker VARCHAR(16) NOT NULL,                             -- 'expected' | 'uncertain'
                 missed_words JSONB NOT NULL DEFAULT '[]',                -- AlignedWord[] subset
                 durable BOOLEAN NOT NULL DEFAULT false
CREATE INDEX oral_reading_student_at_idx ON oral_reading (student_id, at DESC);
```

```
apps/api/src/db/migrations/013_phonics.sql
apps/api/src/curriculum/reading/
  phonics-patterns.data.ts    ~40 patterns across rungs 1–6, ordered (CVC short vowels,
                              consonant digraphs, blends, CVCe, vowel teams, r-controlled,
                              inflectional endings, multisyllable)
  reading-skills.data.ts      PA.RHYME, PA.SYLLABLE, PA.FIRST_SOUND, PA.BLEND, PH.LETTER_SOUND,
                              PH.CVC, PH.DIGRAPH, PH.BLEND, PH.SILENT_E, PH.VOWEL_TEAM,
                              FL.WCPM.30, FL.WCPM.60, FL.WCPM.90, CMP.RETELL, CMP.PREDICT,
                              CMP.INFER — with prerequisites forming a chain; no cycles
  sight-words.data.ts         per rung: the irregular words allowed before their pattern
                              is taught ("the", "a", "is", "to", "said")
apps/api/src/repositories/phonics-pattern.repository.ts
apps/api/src/repositories/student-phonics.repository.ts
apps/api/src/repositories/oral-reading.repository.ts
apps/api/src/services/reading/taught-patterns.service.ts   taughtPatternsFor(studentId)
                              -> { patterns: PhonicsPattern[], sightWords: string[], rung }
apps/api/src/types/reading.ts
apps/api/src/scripts/seed-reading.ts                       idempotent seed
```

Rules:
- A pattern is **taught** when its skill's first teaching SAY/SHOW is recorded for the child
  (`source_event_id`), never by grade or age. A brand-new Grade 3 child has an empty list
  until placement (P4-04) or teaching fills it.
- `mastered_at` is set only by P4-04 evidence above the confidence threshold; never by this ticket.
- `taughtPatternsFor` is the *only* reader of `student_phonics`; P4-02 and P4-03 call it.
- `oral_reading.durable=false` rows are kept for the parent's view but are ignored by skill
  state (P4-04).

### Edge cases
- Student with no `student_phonics` rows → `{ patterns: [], sightWords: rung-0 list, rung: 0 }`;
  the empty set is a valid input to the filter (only sight words are decodable).
- Pattern seed re-run → upsert by `code`; never duplicates, never changes `id`.
- Prerequisite cycle in `reading-skills.data.ts` → seed fails loudly with the cycle path.
- Deleting a student cascades through all three tables (P6-06 relies on this).
- A pattern referenced by a `content_item` passage cannot be deleted (FK, no cascade).
- Skill codes already present from P0-17 (`PH.CVC` etc.) are updated in place, not duplicated.

## Acceptance criteria

- [ ] Migration `013` applies forward and cleanly on an empty database after 001–009.
- [ ] Seed inserts ≥ 40 patterns and 16 reading skills, is idempotent, and rejects a cycle.
- [ ] `taughtPatternsFor` returns the empty-set shape for a new child and the ordered set for
      a child with taught rows, proven by tests.
- [ ] Every reading skill has ≥ 1 prerequisite except the rung-1 skills.
- [ ] Deleting a student leaves zero rows in the three tables.
- [ ] No source file over 300 lines; repositories contain SQL only, no rules.

## Verification

```bash
npm run migrate -w @aria/api && npm run seed:reading -w @aria/api
npm run test -w @aria/api -- reading
```

## References

- `master-plan.md` §4.4 (reading skills), §6.1 (the ladder), §9 (tables)
- `CODE-STANDARDS.md` §3 (repositories), §6 (migrations)
