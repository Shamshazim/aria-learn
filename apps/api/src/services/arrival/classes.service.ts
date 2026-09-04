import type { Grade, Skill, SkillSubject } from '@aria/shared';

import type { InventoryService } from '@/curriculum';
import { subjectIdFor, subjectName } from '@/services/arrival/subject-names';
import type { Student } from '@/types/student';

/** One card on the picker: the subject id the session route takes, and the name on the card. */
export type ClassOption = Readonly<{ subjectId: string; name: string; grade: Grade }>;

/** An authored subject that a legacy curriculum covers for the same child. */
const COVERED_BY: Readonly<Partial<Record<SkillSubject, SkillSubject>>> = {
  arithmetic: 'mathematics',
  writing: 'english-writing',
};

const AUTHORED_SUBJECTS: readonly SkillSubject[] = ['arithmetic', 'reading', 'writing'];

/**
 * The classes this child can open today.
 *
 * Every legacy subject with topics at the child's grade is a class. An authored subject is a
 * class when it has a skill in the child's band and no legacy curriculum already covers the
 * same ground for this grade — so a TK child still gets Math and Writing, and a grade-4 child
 * gets Mathematics and English Writing rather than both names for one thing.
 */
export function classesFor(inventory: InventoryService, student: Student): readonly ClassOption[] {
  const catalogue = inventory
    .listSubjects()
    .filter((subject) => subject.grades.includes(student.grade))
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

function inBand(skill: Skill, subject: SkillSubject, student: Student): boolean {
  return skill.subject === subject && skill.lessonRef !== null && skill.band === student.band;
}
