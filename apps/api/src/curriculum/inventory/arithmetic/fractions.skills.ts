import type { Skill } from '@aria/shared';

/**
 * Fractions (P3-07). Standards: 2.G.A.3 / 3.NF.A.1 (equal parts of a whole) and 3.NF.A.3.d
 * (comparing fractions with the same denominator). Equal parts are counted, so the strand
 * starts from counting.
 */
export const FRACTION_SKILLS = [
  {
    id: 'skill-frac-equal',
    subject: 'arithmetic',
    strand: 'fractions',
    code: 'FRAC.EQUAL',
    name: 'Recognise a fraction as equal pieces of a whole',
    band: 'early',
    prerequisites: ['NUM.CNT.20'],
    lessonRef: 'lesson-frac-equal',
    visualKinds: ['fraction-bar', 'array'],
    mode: 'number_sense',
  },
  {
    id: 'skill-frac-compare',
    subject: 'arithmetic',
    strand: 'fractions',
    code: 'FRAC.COMPARE',
    name: 'Compare fractions with the same denominator',
    band: 'middle',
    prerequisites: ['FRAC.EQUAL'],
    lessonRef: 'lesson-frac-compare',
    visualKinds: ['fraction-bar', 'number-line'],
    mode: 'number_sense',
  },
] as const satisfies readonly Skill[];
