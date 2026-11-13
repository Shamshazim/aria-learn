import type { Skill } from '@aria/shared';

/**
 * Decimals and percent (P3-07). Standards: 4.NF.C.6 / 5.NBT.A.3 (tenths and hundredths as
 * decimals), 4.NF.C.7 (comparing decimals to hundredths), 5.NBT.B.7 (adding and taking away
 * decimals to hundredths) and 6.RP.A.3.c (a percent of a quantity).
 *
 * A decimal is place value carried past the point and a fraction with ten or a hundred
 * underneath, so the strand stands on both. Adding decimals is the `procedure`: line up the
 * points, then column work. Percent of stands on multiplying a fraction by a whole number.
 */
export const DECIMALS_PERCENT_SKILLS = [
  {
    id: 'skill-dec-pv',
    subject: 'arithmetic',
    strand: 'decimals',
    code: 'DEC.PV',
    name: 'Tenths and hundredths in a decimal',
    band: 'middle',
    prerequisites: ['NUM.PV.HUNDREDS', 'FRAC.EQUIV'],
    lessonRef: 'lesson-dec-pv',
    visualKinds: ['number-line'],
    mode: 'number_sense',
  },
  {
    id: 'skill-dec-cmp',
    subject: 'arithmetic',
    strand: 'decimals',
    code: 'DEC.CMP',
    name: 'Compare decimals to hundredths',
    band: 'middle',
    prerequisites: ['DEC.PV'],
    lessonRef: 'lesson-dec-cmp',
    visualKinds: ['number-line'],
    mode: 'number_sense',
  },
  {
    id: 'skill-dec-add',
    subject: 'arithmetic',
    strand: 'decimals',
    code: 'DEC.ADD',
    name: 'Add and take away decimals to hundredths',
    band: 'middle',
    prerequisites: ['DEC.PV', 'ADD.3D', 'SUB.REGROUP.2D'],
    lessonRef: 'lesson-dec-add',
    visualKinds: ['number-line'],
    mode: 'procedure',
  },
  {
    id: 'skill-pct-of',
    subject: 'arithmetic',
    strand: 'percent',
    code: 'PCT.OF',
    name: 'Find a percent of a number',
    band: 'senior',
    prerequisites: ['FRAC.MUL.WHOLE', 'DEC.PV'],
    lessonRef: 'lesson-pct-of',
    visualKinds: ['array'],
    mode: 'number_sense',
  },
] as const satisfies readonly Skill[];
