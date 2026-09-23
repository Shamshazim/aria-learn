# The curriculum catalogue

The first version of the app shipped five curriculum files — Mathematics and English Writing
for grades 1–8, Math Adventures for grades 1–3 — and seeded a two-topic Science subject in a
migration. They are carried across whole, and the rewrite fills the rest of TK–8 with
California-aligned curricula in the same shape: Mathematics and English Writing for TK and K,
and English Reading, Science and History-Social Science for every grade from TK to 8.

## Where they live

- `apps/api/src/curriculum/catalogue/data/*.json` — one file per subject and grade span,
  subject → grades → units → lessons → topics, each topic with its learning objectives.
  `math-1-3`, `math-4-8`, `english-1-3`, `english-4-8` and `math-adventures` are byte-for-byte
  copies of `legacy/backend/src/main/resources/curriculum/*.json`. The rest were written
  for the rewrite against the California standards:

  | File                       | Subject                | Standards                                   |
  | -------------------------- | ---------------------- | ------------------------------------------- |
  | `math-tk-k`                | Mathematics            | CA CCSS Mathematics K; CA Preschool/TK foundations |
  | `english-writing-tk-k`     | English Writing        | CA CCSS ELA Writing and Language, K         |
  | `english-reading-tk-2/3-5/6-8` | English Reading    | CA CCSS ELA Reading (Foundational, Literature, Informational) and Language |
  | `science-tk-2/3-5/6-8`     | Science                | CA NGSS, with the CA integrated model for grades 6–8 |
  | `history-tk-2/3-5/6-8`     | History-Social Science | CA History-Social Science content standards and framework |

  Grade 4 Science keeps the two legacy topics (Animal Groups, Habitats) as its first lesson,
  so their codes and any skill state recorded against them survive.

- `apps/api/src/curriculum/catalogue/` — the loader that reads them and flattens every topic
  into a skill. `level` in a file is the grade number, or `"TK"` / `"K"`.
- `apps/api/src/db/migrations/011_curriculum_catalogue.sql` — the columns a topic needs on
  `skill`: `grade`, `unit`, `lesson`, `objectives`, `ordering`.

## How a topic becomes a skill

| Skill field     | From                                                                |
| --------------- | ------------------------------------------------------------------- |
| `code`          | Position: `MATH.G4.U01.L02.T03` (subject, grade, unit, lesson, topic); `GTK` and `GK` for the two grades without a number |
| `subject`       | The subject name slugified the legacy way: `english-writing`          |
| `band`          | `bandForGrade(grade)`                                                 |
| `prerequisites` | The topic before it in the same lesson (the legacy app gated in order) |
| `strand`/`unit` | The unit name                                                         |
| `lesson`        | The lesson name                                                       |
| `objectives`    | The learning objectives, verbatim                                     |
| `lessonRef`     | `null` — no teaching note has been written yet                        |

Codes are positional so they survive a topic being renamed and stay under the column's 32
characters. Subject prefixes: `MATH`, `ENG` (writing), `READ`, `SCI`, `HSS`, `ADV`. The
rewrite's own `arithmetic`, `reading` and `writing` inventory is untouched.

## How a topic is taught

A catalogue topic has no lesson note and no misconceptions, so it goes down the *prompted*
path (`content.runtime.ts`): the practice-item prompt receives the topic name, grade, unit,
lesson and objectives (`describeSkill`). It never takes the checker-proven arithmetic path;
that stays reserved for the authored `arithmetic` skills. Its last-resort fallback is a
gated "tell me one thing you know about it" opener (`topic-fallback.ts`).

A session moves through a grade's topics in teaching order. Three right answers in a row on
a topic is enough for today: the policy makes a `SWITCH` with approach `next-topic`, the
commit writes the new skill onto the session plan, and the next question is from the topic
after it (`inventory.nextTopic`). The last topic of a grade has no next, and the session stays
on it.

The inventory validator holds catalogue topics to the graph rules (unique codes, acyclic,
band-ordered prerequisites) but not to the note-and-three-misconceptions minimum; those apply
to `listAuthoredSkills()`. Writing a note for a topic and pointing `lessonRef` at it moves it
into the authored set.

## What the child sees

`POST /student/arrival` returns `classes`: every catalogue subject with topics at the child's
grade, in a fixed order — Mathematics, English Reading, English Writing, Science,
History-Social Science, then Math Adventures where the legacy curriculum had it — plus any
authored subject whose ground no catalogue subject covers for that grade (none, now that the
catalogue fills TK–8; the authored subjects come back on the picker for any grade a catalogue
drops). The picker renders exactly that list, with a face chosen from the subject name as the
legacy picker did. A session in a catalogue subject practises the soonest-due topic at the
child's own grade, in teaching order.

**Development only.** With `NODE_ENV=development` the API honours a `grade` on
`POST /student/arrival` and on `POST /student/session`, and the picker shows a grade dropdown
beside "Your classes" (it renders only in a Vite development build). Picking a grade fetches
that grade's classes, and a class opened from it starts a session at that grade and band. In
production the request's grade is ignored and the child's own grade decides, as before.

## Not done

- No lesson notes, misconceptions or golden cases exist for the 791 topics; P3-07 and P7-01
  remain the tickets that author them, and `lessonReview()` still reports only the 16.
- The California-aligned files were written by hand against the standards documents; a
  teacher review pass per subject is still owed before launch.
- The legacy `prompt_templates` and per-subject enrolments are not carried: the rewrite has
  its own prompt registry, and a child's grade is one value on the student.
