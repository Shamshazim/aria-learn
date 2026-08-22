# P0-17 — The bounded initial skill inventory

| | |
|---|---|
| **Phase** | 0 — Foundation |
| **Track** | Backend / Content |
| **Depends on** | P0-04 |
| **Blocks** | P0-16, P0-18, P0-21, P1-03 |
| **Parallel-safe with** | P0-10 … P0-15 |
| **Size** | M |

## Why

Both golden sets, the arithmetic checker and the Phase 1 scheduler all need to agree on what
a skill is and which skills exist. `master-plan.md` §4.4 replaces topics with skills for a
real reason: prerequisites turn "bad at fractions" into "never understood that the pieces
have to be equal", and that is the difference between drilling and teaching.

## Scope

### Build
The skill type, the prerequisite graph, the misconception type, and a **deliberately small**
authored inventory covering the representative skill families in the initial release scope,
with validation.

### Do not build
- No scheduler. Phase 3.
- No full K–8 curriculum. This is a bounded inventory chosen so the golden sets and Phase 1
  are meaningful — not a curriculum project.

## Design

```
packages/shared/src/curriculum/
  skill.ts            Skill = { id, subject, strand, code, name, band, prerequisites[] }
  misconception.ts    Misconception = { id, skillCode, name, signature, remediation }
  index.ts
apps/api/src/curriculum/
  inventory/
    arithmetic.skills.ts
    reading.skills.ts
    writing.skills.ts
    misconceptions.data.ts
  validate.ts         graph validation: no cycles, no dangling prerequisite, unique codes,
                      band monotonicity along prerequisite edges
  inventory.service.ts  read access for the rest of the app
```

Start from the plan's own examples and stay close to that size:

```
NUM.CNT.20     count to 20
NUM.CNT.SKIP5  skip count by 5
ADD.FACT.10    addition facts within 10, from memory
ADD.REGROUP.2D two-digit addition with regrouping     <- needs ADD.FACT.10
FRAC.EQUAL     a fraction is equal pieces of a whole
FRAC.COMPARE   compare same-denominator fractions     <- needs FRAC.EQUAL

PA.RHYME       hear rhyme
PA.BLEND       blend three sounds into a word
PH.CVC         decode CVC words                        <- needs PA.BLEND
PH.SILENT_E    decode words with silent e              <- needs PH.CVC
FL.WCPM.60     read a decodable passage at 60 wpm
CMP.RETELL     retell a short story
```

**Misconceptions are first-class.** Each carries a detection signature and a specific fix:

```
skill FRAC.COMPARE
  misconception "bigger denominator means bigger fraction"
    signature: chose 1/8 over 1/3
    fix: cut the same pizza into 3 and into 8; count what one piece looks like
```

When Aria sees a signature twice she does not hint — she reteaches with the fix. This ticket
supplies the data that rule needs; the rule itself is P1-08.

The inventory is **authored TypeScript data, checked in and reviewable**. Legacy curriculum
JSON may be read as reference during authoring and is never assumed correct or moved
automatically (`rewrite.md` §3). Whether the authored curriculum eventually lives in files,
the database, or both is an open question — `rewrite.md` §6 — so keep `inventory.service.ts`
as the only read path, so the storage can change behind it.

## Acceptance criteria

- [ ] Every skill has a unique code, a band, and prerequisites that all exist.
- [ ] The graph is acyclic and validated at boot; a bad edge fails startup with the codes
      named.
- [ ] Every arithmetic skill in the inventory has a P0-16 solver.
- [ ] At least one misconception with a signature and a fix exists for each of
      `ADD.REGROUP.2D`, `FRAC.COMPARE` and `PH.SILENT_E`.
- [ ] `inventory.service.ts` is the only read path; nothing imports the data files directly.
- [ ] Validation is unit tested against deliberately broken fixtures.
- [ ] Each data file is under 300 lines; split by strand as it grows.

## Verification

```bash
npm run test -w @aria/api -- curriculum
```

## References

- `master-plan.md` §4.4, §13 Phase 0
- `rewrite.md` §3, §6
