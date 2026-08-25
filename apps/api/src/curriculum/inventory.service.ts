import type { Misconception, Skill } from '@aria/shared';

import { ARITHMETIC_SKILLS } from '@/curriculum/inventory/arithmetic.skills';
import { MISCONCEPTIONS } from '@/curriculum/inventory/misconceptions.data';
import { READING_SKILLS } from '@/curriculum/inventory/reading.skills';
import { WRITING_SKILLS } from '@/curriculum/inventory/writing.skills';
import { validateInventory } from '@/curriculum/validate';

export type InventoryService = Readonly<{
  listSkills(): readonly Skill[];
  getSkill(code: string): Skill | null;
  getMisconception(id: string): Misconception | null;
  listMisconceptions(skillCode: string): readonly Misconception[];
}>;

/** Creates the sole read path over the authored curriculum inventory. */
export function createInventoryService(): InventoryService {
  const skills = freezeSkills([...ARITHMETIC_SKILLS, ...READING_SKILLS, ...WRITING_SKILLS]);
  const misconceptions = freezeMisconceptions(MISCONCEPTIONS);
  validateInventory(skills, misconceptions);
  const skillsByCode = new Map(skills.map((skill) => [skill.code, skill]));
  const misconceptionsById = new Map(misconceptions.map((item) => [item.id, item]));

  return {
    listSkills: () => skills,
    getSkill: (code) => skillsByCode.get(code) ?? null,
    getMisconception: (id) => misconceptionsById.get(id) ?? null,
    listMisconceptions: (skillCode) =>
      misconceptions.filter((misconception) => misconception.skillCode === skillCode),
  };
}

function freezeSkills(skills: readonly Skill[]): readonly Skill[] {
  return Object.freeze(
    skills.map((skill) =>
      Object.freeze({ ...skill, prerequisites: Object.freeze([...skill.prerequisites]) }),
    ),
  );
}

function freezeMisconceptions(misconceptions: readonly Misconception[]): readonly Misconception[] {
  return Object.freeze(misconceptions.map((misconception) => Object.freeze({ ...misconception })));
}
