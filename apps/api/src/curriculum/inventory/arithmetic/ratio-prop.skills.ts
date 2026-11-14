import type { Skill } from '@aria/shared';

/**
 * Ratio and proportion (P3-07). Standards: 6.RP.A.3.a (tables of equivalent ratios), 6.RP.A.2
 * and 6.RP.A.3.b (unit rates) and 7.RP.A.2 (proportional relationships).
 *
 * The idea under all three is multiplicative: a ratio scales, it does not add on. That is what
 * the misconceptions test for and what the double number line shows, so all are
 * `number_sense`. Equivalent ratios stand on equivalent fractions and the times tables.
 */
export const RATIO_PROPORTION_SKILLS = [
  {
    id: 'skill-rat-equiv',
    subject: 'arithmetic',
    strand: 'ratio',
    code: 'RAT.EQUIV',
    name: 'Complete an equivalent ratio',
    band: 'senior',
    prerequisites: ['FRAC.EQUIV', 'MUL.FACT.10'],
    lessonRef: 'lesson-rat-equiv',
    visualKinds: ['number-line'],
    mode: 'number_sense',
  },
  {
    id: 'skill-rat-unit',
    subject: 'arithmetic',
    strand: 'ratio',
    code: 'RAT.UNIT',
    name: 'Find a unit rate',
    band: 'senior',
    prerequisites: ['RAT.EQUIV', 'DIV.FACT.10'],
    lessonRef: 'lesson-rat-unit',
    visualKinds: ['number-line'],
    mode: 'number_sense',
  },
  {
    id: 'skill-rat-prop',
    subject: 'arithmetic',
    strand: 'ratio',
    code: 'RAT.PROP',
    name: 'Solve a proportion problem',
    band: 'senior',
    prerequisites: ['RAT.UNIT'],
    lessonRef: 'lesson-rat-prop',
    visualKinds: ['number-line'],
    mode: 'number_sense',
  },
] as const satisfies readonly Skill[];
