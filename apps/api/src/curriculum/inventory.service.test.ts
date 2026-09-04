import { describe, expect, it } from 'vitest';

import { createInventoryService } from '@/curriculum';

const EXPECTED_CODES = [
  'ADD.FACT.10',
  'ADD.REGROUP.2D',
  'CMP.RETELL',
  'FL.WCPM.60',
  'FRAC.COMPARE',
  'FRAC.EQUAL',
  'NUM.CNT.20',
  'NUM.CNT.SKIP5',
  'PA.BLEND',
  'PA.RHYME',
  'PH.CVC',
  'PH.SILENT_E',
  'WR.PARAGRAPH',
  'WR.SENTENCE',
  'WR.SHORT_PIECE',
  'WR.WORD',
] as const;

describe('curriculum inventory', () => {
  it('exposes the bounded authored inventory through one read interface', () => {
    const inventory = createInventoryService();

    expect(
      inventory
        .listAuthoredSkills()
        .map((skill) => skill.code)
        .sort(),
    ).toEqual(EXPECTED_CODES);
    expect(inventory.getSkill('ADD.REGROUP.2D')?.prerequisites).toEqual(['ADD.FACT.10']);
    expect(inventory.getSkill('NOT.A.SKILL')).toBeNull();
  });

  it('carries the legacy catalogue alongside, as skills the same reads resolve', () => {
    const inventory = createInventoryService();

    expect(inventory.listSkills()).toHaveLength(EXPECTED_CODES.length + 394);
    expect(inventory.listSubjects().map((subject) => subject.id)).toEqual([
      'english-writing',
      'mathematics',
      'math-adventures',
      'science',
    ]);
    expect(inventory.listTopics('science', '4').map((skill) => skill.name)).toEqual([
      'Animal Groups',
      'Habitats',
    ]);
    expect(inventory.getSkill('MATH.G4.U01.L01.T01')).toMatchObject({
      name: 'Place Value to Millions',
      band: 'middle',
      lessonRef: null,
    });
    expect(inventory.getLesson('MATH.G4.U01.L01.T01')).toBeNull();
    expect(inventory.listMisconceptions('MATH.G4.U01.L01.T01')).toEqual([]);
  });

  it.each(['ADD.REGROUP.2D', 'FRAC.COMPARE', 'PH.SILENT_E'])(
    'provides a detectable misconception and remediation for %s',
    (skillCode) => {
      const misconceptions = createInventoryService().listMisconceptions(skillCode);

      expect(misconceptions.length).toBeGreaterThan(0);
      expect(misconceptions[0]?.signature).not.toBe('');
      expect(misconceptions[0]?.remediation).not.toBe('');
    },
  );
});
