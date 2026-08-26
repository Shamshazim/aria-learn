import type { Misconception, Skill } from '@aria/shared';

import { ARITHMETIC_SKILLS } from '@/curriculum/inventory/arithmetic.skills';
import { READING_SKILLS } from '@/curriculum/inventory/reading.skills';
import { WRITING_SKILLS } from '@/curriculum/inventory/writing.skills';
import { loadLessonNotes, type LessonNote } from '@/curriculum/lessons';
import { AUTHORED_MISCONCEPTIONS, toMisconception } from '@/curriculum/misconceptions';
import { validateInventory } from '@/curriculum/validate';

export type LessonReviewReport = Readonly<{
  total: number;
  approved: number;
  /** Skill codes still waiting on a teacher; release-blocking, and reported rather than hidden. */
  pending: readonly string[];
}>;

export type InventoryService = Readonly<{
  listSkills(): readonly Skill[];
  getSkill(code: string): Skill | null;
  getMisconception(id: string): Misconception | null;
  listMisconceptions(skillCode: string): readonly Misconception[];
  /** P2H-10: the teaching note a `SAY` or `RETEACH` about this skill is grounded in. */
  getLesson(skillCode: string): LessonNote | null;
  lessonReview(): LessonReviewReport;
}>;

/** Creates the sole read path over the authored curriculum inventory. */
export function createInventoryService(
  lessons: ReadonlyMap<string, LessonNote> = loadLessonNotes(),
): InventoryService {
  const skills = freezeSkills([...ARITHMETIC_SKILLS, ...READING_SKILLS, ...WRITING_SKILLS]);
  const misconceptions = freezeMisconceptions(AUTHORED_MISCONCEPTIONS.map(toMisconception));
  validateInventory(skills, misconceptions, lessons);
  const skillsByCode = new Map(skills.map((skill) => [skill.code, skill]));
  const misconceptionsById = new Map(misconceptions.map((item) => [item.id, item]));

  return {
    listSkills: () => skills,
    getSkill: (code) => skillsByCode.get(code) ?? null,
    getMisconception: (id) => misconceptionsById.get(id) ?? null,
    listMisconceptions: (skillCode) =>
      misconceptions.filter((misconception) => misconception.skillCode === skillCode),
    getLesson: (skillCode) => lessons.get(skillCode) ?? null,
    lessonReview: () => reviewReport(skills, lessons),
  };
}

function reviewReport(
  skills: readonly Skill[],
  lessons: ReadonlyMap<string, LessonNote>,
): LessonReviewReport {
  const pending = skills
    .filter((skill) => lessons.get(skill.code)?.review.status !== 'approved')
    .map((skill) => skill.code);
  return { total: skills.length, approved: skills.length - pending.length, pending };
}

function freezeSkills(skills: readonly Skill[]): readonly Skill[] {
  return Object.freeze(
    skills.map((skill) =>
      Object.freeze({
        ...skill,
        prerequisites: Object.freeze([...skill.prerequisites]),
        visualKinds: Object.freeze([...skill.visualKinds]),
      }),
    ),
  );
}

function freezeMisconceptions(misconceptions: readonly Misconception[]): readonly Misconception[] {
  return Object.freeze(misconceptions.map((misconception) => Object.freeze({ ...misconception })));
}
