import { describe, expect, it } from 'vitest';

import type { Skill } from '@aria/shared';

import { ARITHMETIC_ENTRY_SKILLS, ARITHMETIC_SKILLS } from '@/curriculum/inventory/arithmetic';
import { loadLessonNotes } from '@/curriculum/lessons';
import { AUTHORED_MISCONCEPTIONS, toMisconception } from '@/curriculum/misconceptions';
import { validateInventory } from '@/curriculum/validate';
import { CHECKED_SKILL_CODES } from '@/quality/arithmetic';

const lessons = loadLessonNotes();
const codes = new Set<string>(ARITHMETIC_SKILLS.map((skill) => skill.code));
const misconceptions = AUTHORED_MISCONCEPTIONS.filter((item) => codes.has(item.skillCode)).map(
  toMisconception,
);

function validate(
  skills: readonly Skill[],
  checked: ReadonlySet<string> = CHECKED_SKILL_CODES,
): void {
  validateInventory(skills, misconceptions, lessons, { checked, entries: ARITHMETIC_ENTRY_SKILLS });
}

describe('the arithmetic inventory rules (P3-07)', () => {
  it('accepts the shipped inventory', () => {
    expect(() => {
      validate(ARITHMETIC_SKILLS);
    }).not.toThrow();
  });

  it('stops the boot, naming the skill, when a checker is missing', () => {
    const checked = new Set([...CHECKED_SKILL_CODES].filter((code) => code !== 'NUM.RND.10'));
    expect(() => {
      validate(ARITHMETIC_SKILLS, checked);
    }).toThrow('Arithmetic skill NUM.RND.10 has no checker');
  });

  it('refuses a skill with no teaching mode, or no prerequisites that is not an entry skill', () => {
    const withoutMode: Skill[] = ARITHMETIC_SKILLS.map((skill): Skill => {
      if (skill.code !== 'NUM.CMP.100') return skill;
      const { mode: _mode, ...rest } = skill;
      return rest;
    });
    expect(() => {
      validate(withoutMode);
    }).toThrow('Arithmetic skill NUM.CMP.100 has no teaching mode');
    const orphan: Skill[] = ARITHMETIC_SKILLS.map((skill): Skill =>
      skill.code === 'NUM.PV.TENS' ? { ...skill, prerequisites: [] } : skill,
    );
    expect(() => {
      validate(orphan);
    }).toThrow('Arithmetic skill NUM.PV.TENS has no prerequisites and is not a listed entry skill');
  });

  it('lists its entry skills, and every other arithmetic skill needs something', () => {
    for (const skill of ARITHMETIC_SKILLS) {
      if (!ARITHMETIC_ENTRY_SKILLS.includes(skill.code)) {
        expect(skill.prerequisites.length, skill.code).toBeGreaterThan(0);
      }
    }
  });
});
