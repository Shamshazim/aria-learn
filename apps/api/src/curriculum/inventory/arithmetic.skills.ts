import type { Skill } from '@aria/shared';

/** The intentionally small arithmetic slice that P0-16 must solve deterministically. */
export const ARITHMETIC_SKILLS = [
  {
    id: 'skill-num-cnt-20',
    subject: 'arithmetic',
    strand: 'number-sense',
    code: 'NUM.CNT.20',
    name: 'Count to 20',
    band: 'early',
    prerequisites: [],
  },
  {
    id: 'skill-num-cnt-skip5',
    subject: 'arithmetic',
    strand: 'number-sense',
    code: 'NUM.CNT.SKIP5',
    name: 'Skip count by 5',
    band: 'early',
    prerequisites: ['NUM.CNT.20'],
  },
  {
    id: 'skill-add-fact-10',
    subject: 'arithmetic',
    strand: 'addition',
    code: 'ADD.FACT.10',
    name: 'Recall addition facts within 10',
    band: 'early',
    prerequisites: ['NUM.CNT.20'],
  },
  {
    id: 'skill-add-regroup-2d',
    subject: 'arithmetic',
    strand: 'addition',
    code: 'ADD.REGROUP.2D',
    name: 'Add two-digit numbers with regrouping',
    band: 'middle',
    prerequisites: ['ADD.FACT.10'],
  },
  {
    id: 'skill-frac-equal',
    subject: 'arithmetic',
    strand: 'fractions',
    code: 'FRAC.EQUAL',
    name: 'Recognise a fraction as equal pieces of a whole',
    band: 'early',
    prerequisites: [],
  },
  {
    id: 'skill-frac-compare',
    subject: 'arithmetic',
    strand: 'fractions',
    code: 'FRAC.COMPARE',
    name: 'Compare fractions with the same denominator',
    band: 'middle',
    prerequisites: ['FRAC.EQUAL'],
  },
] as const satisfies readonly Skill[];
