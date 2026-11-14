import type { Skill } from '@aria/shared';

/**
 * Measurement and data (P3-07). Standards: 3.MD.A.1 (elapsed time), 4.MD.A.2 (money, making
 * change), 3.MD.C.7 and 3.MD.D.8 (area and perimeter of rectangles), 4.MD.A.1 (converting
 * units within a system) and 6.SP.B.5.c (mean and median).
 *
 * Each is arithmetic the child already has, applied to a quantity with its own rules — sixty
 * minutes in an hour, a hundred cents in a dollar, a fixed table of units — so all are
 * `number_sense`: the skill is knowing the rule of the quantity, not a new procedure.
 */
export const MEASUREMENT_DATA_SKILLS = [
  {
    id: 'skill-meas-time',
    subject: 'arithmetic',
    strand: 'measurement',
    code: 'MEAS.TIME',
    name: 'Work out a time after some minutes have passed',
    band: 'middle',
    prerequisites: ['ADD.REGROUP.2D', 'NUM.CNT.SKIP5'],
    lessonRef: 'lesson-meas-time',
    visualKinds: ['number-line'],
    mode: 'number_sense',
  },
  {
    id: 'skill-meas-money',
    subject: 'arithmetic',
    strand: 'measurement',
    code: 'MEAS.MONEY',
    name: 'Work out the change from a payment',
    band: 'middle',
    prerequisites: ['SUB.REGROUP.2D', 'DEC.PV'],
    lessonRef: 'lesson-meas-money',
    visualKinds: ['number-line'],
    mode: 'number_sense',
  },
  {
    id: 'skill-meas-area',
    subject: 'arithmetic',
    strand: 'measurement',
    code: 'MEAS.AREA',
    name: 'Area and perimeter of a rectangle',
    band: 'middle',
    prerequisites: ['MUL.FACT.10', 'ADD.REGROUP.2D'],
    lessonRef: 'lesson-meas-area',
    visualKinds: ['array'],
    mode: 'number_sense',
  },
  {
    id: 'skill-meas-conv',
    subject: 'arithmetic',
    strand: 'measurement',
    code: 'MEAS.CONV',
    name: 'Convert from a bigger unit to a smaller one',
    band: 'middle',
    prerequisites: ['MUL.FACT.10', 'NUM.PV.HUNDREDS'],
    lessonRef: 'lesson-meas-conv',
    visualKinds: ['number-line'],
    mode: 'number_sense',
  },
  {
    id: 'skill-data-mean',
    subject: 'arithmetic',
    strand: 'data',
    code: 'DATA.MEAN',
    name: 'Find the mean and the median',
    band: 'senior',
    prerequisites: ['DIV.LONG', 'ADD.3D'],
    lessonRef: 'lesson-data-mean',
    visualKinds: ['number-line'],
    mode: 'number_sense',
  },
] as const satisfies readonly Skill[];
