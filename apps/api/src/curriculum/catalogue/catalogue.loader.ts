import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { GRADES, bandForGrade, type Grade, type Skill, type SkillSubject } from '@aria/shared';

import {
  catalogueSubject,
  gradeForLevel,
  topicCode,
  topicId,
} from '@/curriculum/catalogue/catalogue.codes';
import { catalogueFileSchema, type CatalogueFile } from '@/curriculum/catalogue/catalogue.schema';

const DATA_DIRECTORY = fileURLToPath(new URL('./data/', import.meta.url));

export class CatalogueError extends Error {
  override readonly name = 'CatalogueError';
}

/** One legacy subject as the picker shows it: its name and the grades it has topics for. */
export type CatalogueSubject = Readonly<{
  id: SkillSubject;
  name: string;
  grades: readonly Grade[];
}>;

export type Catalogue = Readonly<{
  subjects: readonly CatalogueSubject[];
  skills: readonly Skill[];
}>;

/**
 * Reads every legacy curriculum file off disk and flattens it into skills.
 *
 * Each topic becomes one skill: the band comes from the grade, the prerequisite is the topic
 * before it in the same lesson (the legacy app gated topics in order), and the objectives,
 * unit and lesson ride along so the tutor can be prompted from them. Read once when the
 * inventory is built, like the lesson notes; a test can point it at a fixture directory.
 */
export function loadCatalogue(directory: string = DATA_DIRECTORY): Catalogue {
  const subjects: CatalogueSubject[] = [];
  const skills: Skill[] = [];
  for (const fileName of readdirSync(directory).sort()) {
    if (!fileName.endsWith('.json')) continue;
    const file = parseFile(readFileSync(join(directory, fileName), 'utf8'), fileName);
    const subject = catalogueSubject(file.subject);
    if (subject === null) {
      throw new CatalogueError(`${fileName}: "${file.subject}" is not a catalogue subject`);
    }
    const flattened = flattenSubject(subject, file);
    skills.push(...flattened.skills);
    const existing = subjects.find((item) => item.id === subject);
    if (existing === undefined) {
      subjects.push({ id: subject, name: file.subject, grades: flattened.grades });
    } else {
      subjects.splice(subjects.indexOf(existing), 1, {
        ...existing,
        grades: [...existing.grades, ...flattened.grades],
      });
    }
  }
  return {
    subjects: subjects.map((item) => ({ ...item, grades: sortGrades(item.grades) })),
    skills,
  };
}

function parseFile(raw: string, fileName: string): CatalogueFile {
  const parsed = catalogueFileSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new CatalogueError(`${fileName}: ${parsed.error.issues[0]?.message ?? 'invalid'}`);
  }
  return parsed.data;
}

function flattenSubject(
  subject: SkillSubject,
  file: CatalogueFile,
): Readonly<{ grades: Grade[]; skills: Skill[] }> {
  const grades: Grade[] = [];
  const skills: Skill[] = [];
  for (const grade of file.grades) {
    const gradeCode = gradeForLevel(grade.level);
    if (gradeCode === null) {
      throw new CatalogueError(`${file.subject}: level ${String(grade.level)} is not a grade`);
    }
    grades.push(gradeCode);
    let ordering = 0;
    grade.units.forEach((unit, unitIndex) => {
      unit.lessons.forEach((lesson, lessonIndex) => {
        let previous: string | null = null;
        lesson.topics.forEach((topic, topicIndex) => {
          const code = topicCode({
            subject,
            grade: gradeCode,
            unit: unitIndex + 1,
            lesson: lessonIndex + 1,
            topic: topicIndex + 1,
          });
          ordering += 1;
          skills.push({
            id: topicId(code),
            subject,
            strand: unit.name,
            code,
            name: topic.name,
            band: bandForGrade(gradeCode),
            prerequisites: previous === null ? [] : [previous],
            lessonRef: null,
            visualKinds: [],
            grade: gradeCode,
            unit: unit.name,
            lesson: lesson.name,
            objectives: topic.objectives,
            ordering,
          });
          previous = code;
        });
      });
    });
  }
  return { grades, skills };
}

function sortGrades(grades: readonly Grade[]): readonly Grade[] {
  return [...new Set(grades)].sort((a, b) => GRADES.indexOf(a) - GRADES.indexOf(b));
}
