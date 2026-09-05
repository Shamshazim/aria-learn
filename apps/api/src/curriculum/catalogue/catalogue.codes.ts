import { parseGrade, type Grade, type SkillSubject } from '@aria/shared';

import type { CatalogueLevel } from '@/curriculum/catalogue/catalogue.schema';

/**
 * How a catalogue topic gets a place in the skill graph.
 *
 * The code has to fit `skill.code VARCHAR(32)` and stay stable across re-seeds, so it is
 * built from position, not from the topic name: `MATH.G4.U01.L02.T03` is the third topic of
 * the second lesson of the first unit of grade-4 Mathematics, and stays that code however the
 * name is edited. Position is what the legacy seeder ordered by, so it is the ordering here.
 */
const SUBJECT_PREFIX: Readonly<Record<string, string>> = {
  mathematics: 'MATH',
  'english-writing': 'ENG',
  'english-reading': 'READ',
  'math-adventures': 'ADV',
  science: 'SCI',
  'history-social-science': 'HSS',
};

/** The subjects a curriculum file may declare; anything else is refused at boot. */
const CATALOGUE_SUBJECTS: readonly SkillSubject[] = [
  'mathematics',
  'english-writing',
  'english-reading',
  'math-adventures',
  'science',
  'history-social-science',
];

/** The legacy seeder's slug rule, so `English Writing` is `english-writing` on both sides. */
export function subjectSlug(subjectName: string): string {
  return subjectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function catalogueSubject(subjectName: string): SkillSubject | null {
  const slug = subjectSlug(subjectName);
  return CATALOGUE_SUBJECTS.find((subject) => subject === slug) ?? null;
}

export function subjectPrefix(subject: SkillSubject): string {
  return SUBJECT_PREFIX[subject] ?? subject.toUpperCase().slice(0, 4);
}

/** A file's `level` is the grade number, or `"TK"` / `"K"`; the product's grades are strings. */
export function gradeForLevel(level: CatalogueLevel): Grade | null {
  return parseGrade(String(level));
}

export type TopicPosition = Readonly<{
  subject: SkillSubject;
  grade: Grade;
  unit: number;
  lesson: number;
  topic: number;
}>;

export function topicCode(position: TopicPosition): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return [
    subjectPrefix(position.subject),
    `G${position.grade}`,
    `U${pad(position.unit)}`,
    `L${pad(position.lesson)}`,
    `T${pad(position.topic)}`,
  ].join('.');
}

export function topicId(code: string): string {
  return `skill-${code.toLowerCase().replaceAll('.', '-')}`;
}
