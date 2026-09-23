import type { Grade, Misconception, Skill } from '@aria/shared';

import { loadCatalogue, type Catalogue, type CatalogueSubject } from '@/curriculum/catalogue';
import { ARITHMETIC_SKILLS } from '@/curriculum/inventory/arithmetic.skills';
import { READING_SKILLS } from '@/curriculum/inventory/reading.skills';
import { WRITING_SKILLS } from '@/curriculum/inventory/writing.skills';
import { loadLessonNotes, type LessonNote } from '@/curriculum/lessons';
import { AUTHORED_MISCONCEPTIONS, toMisconception } from '@/curriculum/misconceptions';
import { authored, validateInventory } from '@/curriculum/validate';

export type LessonReviewReport = Readonly<{
  total: number;
  approved: number;
  /** Skill codes still waiting on a teacher; release-blocking, and reported rather than hidden. */
  pending: readonly string[];
}>;

export type InventoryService = Readonly<{
  /** Every skill, authored and catalogue alike; what the database is seeded from. */
  listSkills(): readonly Skill[];
  /** The skills with a lesson note and misconceptions: the P2H-10 bounded inventory. */
  listAuthoredSkills(): readonly Skill[];
  /** The legacy subjects, with the grades each has topics for. */
  listSubjects(): readonly CatalogueSubject[];
  /** The catalogue topics filed under a subject and grade, in teaching order. */
  listTopics(subject: Skill['subject'], grade: Grade): readonly Skill[];
  /**
   * The catalogue topic after this one at the same subject and grade, or `null` at the end
   * of the grade or for an authored skill. What a finished topic hands the session to.
   */
  nextTopic(code: string): string | null;
  getSkill(code: string): Skill | null;
  getMisconception(id: string): Misconception | null;
  listMisconceptions(skillCode: string): readonly Misconception[];
  /** P2H-10: the teaching note a `SAY` or `RETEACH` about this skill is grounded in. */
  getLesson(skillCode: string): LessonNote | null;
  lessonReview(): LessonReviewReport;
}>;

/**
 * Creates the sole read path over the authored curriculum inventory.
 *
 * `lessons` defaults to the notes on disk, which is what production wants and what a test
 * pointing at a fixture directory overrides.
 */
export function createInventoryService(
  dependencies: Readonly<{ lessons?: ReadonlyMap<string, LessonNote>; catalogue?: Catalogue }> = {},
): InventoryService {
  const lessons = dependencies.lessons ?? loadLessonNotes();
  const catalogue = dependencies.catalogue ?? loadCatalogue();
  const skills = freezeSkills([
    ...ARITHMETIC_SKILLS,
    ...READING_SKILLS,
    ...WRITING_SKILLS,
    ...catalogue.skills,
  ]);
  const misconceptions = freezeMisconceptions(AUTHORED_MISCONCEPTIONS.map(toMisconception));
  validateInventory(skills, misconceptions, lessons);
  const skillsByCode = new Map(skills.map((skill) => [skill.code, skill]));
  const misconceptionsById = new Map(misconceptions.map((item) => [item.id, item]));

  return {
    listSkills: () => skills,
    listAuthoredSkills: () => authored(skills),
    listSubjects: () => catalogue.subjects,
    listTopics: (subject, grade) =>
      skills.filter((skill) => skill.subject === subject && skill.grade === grade),
    nextTopic: (code) => nextTopic(skills, skillsByCode.get(code) ?? null),
    getSkill: (code) => skillsByCode.get(code) ?? null,
    getMisconception: (id) => misconceptionsById.get(id) ?? null,
    listMisconceptions: (skillCode) =>
      misconceptions.filter((misconception) => misconception.skillCode === skillCode),
    getLesson: (skillCode) => lessons.get(skillCode) ?? null,
    lessonReview: () => reviewReport(skills, lessons),
  };
}

function nextTopic(skills: readonly Skill[], current: Skill | null): string | null {
  if (current?.ordering === undefined || current.grade === undefined) return null;
  const { subject, grade, ordering } = current;
  const following = skills
    .filter(
      (skill) =>
        skill.subject === subject &&
        skill.grade === grade &&
        skill.ordering !== undefined &&
        skill.ordering > ordering,
    )
    .sort((left, right) => (left.ordering ?? 0) - (right.ordering ?? 0));
  return following[0]?.code ?? null;
}

function reviewReport(
  skills: readonly Skill[],
  lessons: ReadonlyMap<string, LessonNote>,
): LessonReviewReport {
  const noted = authored(skills);
  const pending = noted
    .filter((skill) => lessons.get(skill.code)?.review.status !== 'approved')
    .map((skill) => skill.code);
  return { total: noted.length, approved: noted.length - pending.length, pending };
}

function freezeSkills(skills: readonly Skill[]): readonly Skill[] {
  return Object.freeze(
    skills.map((skill) =>
      Object.freeze({
        ...skill,
        prerequisites: Object.freeze([...skill.prerequisites]),
        visualKinds: Object.freeze([...skill.visualKinds]),
        ...(skill.objectives === undefined
          ? {}
          : { objectives: Object.freeze([...skill.objectives]) }),
      }),
    ),
  );
}

function freezeMisconceptions(misconceptions: readonly Misconception[]): readonly Misconception[] {
  return Object.freeze(misconceptions.map((misconception) => Object.freeze({ ...misconception })));
}
