import type { Skill } from '@aria/shared';

/**
 * Number sense (P3-07): counting, place value, comparing and rounding whole numbers.
 *
 * Standards followed, so a reviewer can check the ladder: K.CC.A.1–2 (counting), 2.NBT.A.2
 * (skip-counting), 1.NBT.B.2 (tens and ones), 2.NBT.A.1 (hundreds, tens, ones), 1.NBT.B.3
 * (comparing two-digit numbers), 3.NBT.A.1 (rounding to the nearest ten).
 *
 * All `number_sense`: reasoned about with a model on the table, never drilled against a clock.
 */
export const NUM_SENSE_SKILLS = [
  {
    id: 'skill-num-cnt-20',
    subject: 'arithmetic',
    strand: 'number-sense',
    code: 'NUM.CNT.20',
    name: 'Count to 20',
    band: 'early',
    // The entry skill: everything in arithmetic builds on counting.
    prerequisites: [],
    lessonRef: 'lesson-num-cnt-20',
    visualKinds: ['number-line', 'ten-frame'],
    mode: 'number_sense',
  },
  {
    id: 'skill-num-cnt-skip5',
    subject: 'arithmetic',
    strand: 'number-sense',
    code: 'NUM.CNT.SKIP5',
    name: 'Skip count by 5',
    band: 'early',
    prerequisites: ['NUM.CNT.20'],
    lessonRef: 'lesson-num-cnt-skip5',
    visualKinds: ['number-line'],
    mode: 'number_sense',
  },
  {
    id: 'skill-num-pv-tens',
    subject: 'arithmetic',
    strand: 'place-value',
    code: 'NUM.PV.TENS',
    name: 'Tens and ones in a two-digit number',
    band: 'early',
    prerequisites: ['NUM.CNT.20'],
    lessonRef: 'lesson-num-pv-tens',
    visualKinds: ['place-value-blocks'],
    mode: 'number_sense',
  },
  {
    id: 'skill-num-pv-hundreds',
    subject: 'arithmetic',
    strand: 'place-value',
    code: 'NUM.PV.HUNDREDS',
    name: 'Hundreds, tens and ones in a three-digit number',
    band: 'early',
    prerequisites: ['NUM.PV.TENS'],
    lessonRef: 'lesson-num-pv-hundreds',
    visualKinds: ['place-value-blocks'],
    mode: 'number_sense',
  },
  {
    id: 'skill-num-cmp-100',
    subject: 'arithmetic',
    strand: 'place-value',
    code: 'NUM.CMP.100',
    name: 'Compare two-digit numbers',
    band: 'early',
    prerequisites: ['NUM.PV.TENS'],
    lessonRef: 'lesson-num-cmp-100',
    visualKinds: ['place-value-blocks', 'number-line'],
    mode: 'number_sense',
  },
  {
    id: 'skill-num-rnd-10',
    subject: 'arithmetic',
    strand: 'place-value',
    code: 'NUM.RND.10',
    name: 'Round to the nearest ten',
    band: 'middle',
    prerequisites: ['NUM.PV.HUNDREDS'],
    lessonRef: 'lesson-num-rnd-10',
    visualKinds: ['number-line'],
    mode: 'number_sense',
  },
] as const satisfies readonly Skill[];
