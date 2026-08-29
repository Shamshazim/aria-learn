# The legacy curricula in the rewrite

The first version of the app shipped five curriculum files — Mathematics and English Writing
for grades 1–8, Math Adventures for grades 1–3 — and seeded a two-topic Science subject in a
migration. They are carried across whole.

## Where they live

- `apps/api/src/curriculum/catalogue/data/*.json` — byte-for-byte copies of
  `legacy/backend/src/main/resources/curriculum/*.json`, plus `science.json` transcribed from
  the legacy `V14__enrollments_and_science.sql`. Subject → grades → units → lessons → topics,
  each topic with its learning objectives. Edit these to change what a class contains.
- `apps/api/src/curriculum/catalogue/` — the loader that reads them and flattens every topic
  into a skill.
- `apps/api/src/db/migrations/010_curriculum_catalogue.sql` — the columns a topic needs on
  `skill`: `grade`, `unit`, `lesson`, `objectives`, `ordering`.

## How a topic becomes a skill

| Skill field     | From                                                                |
| --------------- | ------------------------------------------------------------------- |
| `code`          | Position: `MATH.G4.U01.L02.T03` (subject, grade, unit, lesson, topic) |
| `subject`       | The subject name slugified the legacy way: `english-writing`          |
| `band`          | `bandForGrade(grade)`                                                 |
| `prerequisites` | The topic before it in the same lesson (the legacy app gated in order) |
| `strand`/`unit` | The unit name                                                         |
| `lesson`        | The lesson name                                                       |
| `objectives`    | The legacy learning objectives, verbatim                              |
| `lessonRef`     | `null` — no teaching note has been written yet                        |

Codes are positional so they survive a topic being renamed and stay under the column's 32
characters. Subjects are `mathematics`, `english-writing`, `math-adventures` and `science`;
the rewrite's own `arithmetic`, `reading` and `writing` inventory is untouched.

## How a topic is taught

A catalogue topic has no lesson note and no misconceptions, so it goes down the *prompted*
path (`content.runtime.ts`): the practice-item prompt receives the topic name, grade, unit,
lesson and objectives (`describeSkill`). It never takes the checker-proven arithmetic path;
that stays reserved for the authored `arithmetic` skills. Its last-resort fallback is a
gated "tell me one thing you know about it" opener (`topic-fallback.ts`).

The inventory validator holds catalogue topics to the graph rules (unique codes, acyclic,
band-ordered prerequisites) but not to the note-and-three-misconceptions minimum; those apply
to `listAuthoredSkills()`. Writing a note for a topic and pointing `lessonRef` at it moves it
into the authored set.

## What the child sees

`POST /student/arrival` returns `classes`: every legacy subject with topics at the child's
grade, plus the authored subjects whose ground no legacy subject covers for that grade
(Reading always; Math and Writing for TK and K). The picker renders exactly that list, with a
face chosen from the subject name as the legacy picker did. A session in a catalogue subject
practises the soonest-due topic at the child's own grade, in teaching order.

## Not done

- No lesson notes, misconceptions or golden cases exist for the 394 topics; P3-07 and P7-01
  remain the tickets that author them, and `lessonReview()` still reports only the 16.
- The legacy `prompt_templates` and per-subject enrolments are not carried: the rewrite has
  its own prompt registry, and a child's grade is one value on the student.
