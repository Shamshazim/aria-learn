import { type Band, type Misconception, type Skill } from '@aria/shared';

import type { LessonNote } from '@/curriculum/lessons';

const BAND_RANK: Readonly<Record<Band, number>> = {
  early: 0,
  middle: 1,
  senior: 2,
};

export class CurriculumValidationError extends Error {
  override readonly name = 'CurriculumValidationError';
}

/** Validates the authored prerequisite graph before it can serve curriculum reads. */
export function validateSkillGraph(skills: readonly Skill[]): void {
  assertUniqueCodes(skills);
  const skillsByCode = new Map(skills.map((skill) => [skill.code, skill]));
  assertValidEdges(skills, skillsByCode);
  assertAcyclic(skillsByCode);
}

/** P2H-10: a skill with fewer than this cannot tell a wrong tap from a wrong idea. */
const MIN_MISCONCEPTIONS_PER_SKILL = 3;

/** Validates the graph, the misconceptions and the lesson notes as one inventory. */
export function validateInventory(
  skills: readonly Skill[],
  misconceptions: readonly Misconception[],
  lessons: ReadonlyMap<string, LessonNote>,
): void {
  validateSkillGraph(skills);
  assertMisconceptionCoverage(skills, misconceptions);
  assertLessonCoverage(skills, lessons);
}

function assertMisconceptionCoverage(
  skills: readonly Skill[],
  misconceptions: readonly Misconception[],
): void {
  const skillCodes = new Set(skills.map((skill) => skill.code));
  for (const misconception of misconceptions) {
    if (!skillCodes.has(misconception.skillCode)) {
      throw new CurriculumValidationError(
        `Misconception ${misconception.id} references missing skill ${misconception.skillCode}`,
      );
    }
  }
  for (const skill of skills) {
    const count = misconceptions.filter((item) => item.skillCode === skill.code).length;
    if (count < MIN_MISCONCEPTIONS_PER_SKILL) {
      throw new CurriculumValidationError(
        `Skill ${skill.code} has ${String(count)} misconceptions; ${String(MIN_MISCONCEPTIONS_PER_SKILL)} is the minimum`,
      );
    }
  }
}

/**
 * Every skill has a note, and the note it has is the one the skill points at.
 *
 * Both halves matter. A missing note means an explanation grounded in nothing; a note filed
 * under the wrong skill means an explanation grounded in the wrong lesson, which is worse
 * because nothing about it looks broken.
 */
function assertLessonCoverage(
  skills: readonly Skill[],
  lessons: ReadonlyMap<string, LessonNote>,
): void {
  for (const skill of skills) {
    const note = lessons.get(skill.code);
    if (note === undefined) {
      throw new CurriculumValidationError(`Skill ${skill.code} has no lesson note`);
    }
    if (note.id !== skill.lessonRef) {
      throw new CurriculumValidationError(
        `Skill ${skill.code} points at ${skill.lessonRef} but its note declares ${note.id}`,
      );
    }
  }
}

function assertUniqueCodes(skills: readonly Skill[]): void {
  const seen = new Set<string>();
  for (const skill of skills) {
    if (seen.has(skill.code)) {
      throw new CurriculumValidationError(`Duplicate skill code ${skill.code}`);
    }
    seen.add(skill.code);
  }
}

function assertValidEdges(
  skills: readonly Skill[],
  skillsByCode: ReadonlyMap<string, Skill>,
): void {
  for (const skill of skills) {
    for (const prerequisiteCode of skill.prerequisites) {
      const prerequisite = skillsByCode.get(prerequisiteCode);
      if (prerequisite === undefined) {
        throw new CurriculumValidationError(
          `Skill ${skill.code} references missing prerequisite ${prerequisiteCode}`,
        );
      }
      if (BAND_RANK[prerequisite.band] > BAND_RANK[skill.band]) {
        throw new CurriculumValidationError(
          `Skill ${skill.code} in ${skill.band} cannot require ${prerequisite.code} in ${prerequisite.band}`,
        );
      }
    }
  }
}

function assertAcyclic(skillsByCode: ReadonlyMap<string, Skill>): void {
  const complete = new Set<string>();
  for (const skill of skillsByCode.values()) {
    const cycle = visitSkill(skill, skillsByCode, [], complete);
    if (cycle !== null) {
      throw new CurriculumValidationError(`Skill prerequisite cycle: ${cycle.join(' -> ')}`);
    }
  }
}

function visitSkill(
  skill: Skill,
  skillsByCode: ReadonlyMap<string, Skill>,
  path: string[],
  complete: Set<string>,
): readonly string[] | null {
  const cycleStart = path.indexOf(skill.code);
  if (cycleStart >= 0) return [...path.slice(cycleStart), skill.code];
  if (complete.has(skill.code)) return null;

  path.push(skill.code);
  for (const prerequisiteCode of skill.prerequisites) {
    const prerequisite = skillsByCode.get(prerequisiteCode);
    if (prerequisite === undefined) continue;
    const cycle = visitSkill(prerequisite, skillsByCode, path, complete);
    if (cycle !== null) return cycle;
  }
  path.pop();
  complete.add(skill.code);
  return null;
}
