import type { Grade, Skill, SkillSubject } from '@aria/shared';

import type { InventoryService } from '@/curriculum';
import { subjectIdFor, subjectName } from '@/services/arrival/subject-names';
import type { Student } from '@/types/student';

/** One card on the picker: the subject id the session route takes, and the name on the card. */
export type ClassOption = Readonly<{ subjectId: string; name: string; grade: Grade }>;

/** An authored subject that a catalogue curriculum covers for the same child. */
const COVERED_BY: Readonly<Partial<Record<SkillSubject, SkillSubject>>> = {
  arithmetic: 'mathematics',
  writing: 'english-writing',
  reading: 'english-reading',
};

const AUTHORED_SUBJECTS: readonly SkillSubject[] = ['arithmetic', 'reading', 'writing'];

/**
 * The order the cards appear in. Maths and reading first because they are what most families
 * open; the loader's own order is the order of the files on disk, which means nothing to a
 * child. A subject not listed here goes last, so a new curriculum file still shows up.
 */
const DISPLAY_ORDER: readonly SkillSubject[] = [
  'mathematics',
  'english-reading',
  'english-writing',
  'science',
  'history-social-science',
  'math-adventures',
];

/**
 * The classes this child can open today.
 *
 * Every catalogue subject with topics at the child's grade is a class. An authored subject is
 * a class only when it has a skill in the child's band and no catalogue curriculum already
 * covers the same ground for this grade — so a grade-4 child gets Mathematics and English
 * Writing rather than both names for one thing. With the California catalogue filling TK–8
 * the authored Math, Reading and Writing are covered at every grade; they stay in the
 * inventory for the golden sets and come back on the picker for any grade a catalogue drops.
 */
export function classesFor(inventory: InventoryService, student: Student): readonly ClassOption[] {
  const catalogue = inventory
    .listSubjects()
    .filter((subject) => subject.grades.includes(student.grade))
    .sort((left, right) => displayRank(left.id) - displayRank(right.id))
    .map((subject) => ({ subjectId: subject.id, name: subject.name, grade: student.grade }));
  const present = new Set(catalogue.map((item) => item.subjectId));
  const skills = inventory.listSkills();
  const authored = AUTHORED_SUBJECTS.filter((subject) => {
    const covered = COVERED_BY[subject];
    if (covered !== undefined && present.has(covered)) return false;
    return skills.some((skill) => inBand(skill, subject, student));
  }).map((subject) => {
    const subjectId = subjectIdFor(subject);
    return { subjectId, name: subjectName(subjectId), grade: student.grade };
  });
  return [...catalogue, ...authored];
}

function displayRank(subject: SkillSubject): number {
  const index = DISPLAY_ORDER.indexOf(subject);
  return index === -1 ? DISPLAY_ORDER.length : index;
}

function inBand(skill: Skill, subject: SkillSubject, student: Student): boolean {
  return skill.subject === subject && skill.lessonRef !== null && skill.band === student.band;
}
