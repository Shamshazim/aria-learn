import type { Skill } from '@aria/shared';

/**
 * Addition and subtraction (P3-07). Standards: 1.OA.C.6 (add and subtract within 10, toward
 * fluency), 2.OA.B.2 (fluently add within 20), 2.NBT.B.5 (add and subtract within 100, with
 * regrouping) and 3.NBT.A.2 (add within 1000).
 *
 * Facts are `fact`: retrieved against the clock until automatic. The column methods are
 * `procedure`: worked one column at a time, so Aria never hands over the whole answer.
 */
export const ADD_SUB_SKILLS = [
  {
    id: 'skill-add-fact-10',
    subject: 'arithmetic',
    strand: 'addition',
    code: 'ADD.FACT.10',
    name: 'Recall addition facts within 10',
    band: 'early',
    prerequisites: ['NUM.CNT.20'],
    lessonRef: 'lesson-add-fact-10',
    visualKinds: ['ten-frame', 'number-line'],
    mode: 'fact',
  },
  {
    id: 'skill-add-fact-20',
    subject: 'arithmetic',
    strand: 'addition',
    code: 'ADD.FACT.20',
    name: 'Recall addition facts that cross ten',
    band: 'early',
    prerequisites: ['ADD.FACT.10'],
    lessonRef: 'lesson-add-fact-20',
    visualKinds: ['ten-frame', 'number-line'],
    mode: 'fact',
  },
  {
    id: 'skill-sub-fact-10',
    subject: 'arithmetic',
    strand: 'subtraction',
    code: 'SUB.FACT.10',
    name: 'Recall subtraction facts within 10',
    band: 'early',
    prerequisites: ['ADD.FACT.10'],
    lessonRef: 'lesson-sub-fact-10',
    visualKinds: ['ten-frame', 'number-line'],
    mode: 'fact',
  },
  {
    id: 'skill-add-regroup-2d',
    subject: 'arithmetic',
    strand: 'addition',
    code: 'ADD.REGROUP.2D',
    name: 'Add two-digit numbers with regrouping',
    band: 'middle',
    prerequisites: ['ADD.FACT.10'],
    lessonRef: 'lesson-add-regroup-2d',
    visualKinds: ['place-value-blocks', 'number-line'],
    mode: 'procedure',
  },
  {
    id: 'skill-sub-regroup-2d',
    subject: 'arithmetic',
    strand: 'subtraction',
    code: 'SUB.REGROUP.2D',
    name: 'Subtract two-digit numbers with regrouping',
    band: 'middle',
    prerequisites: ['SUB.FACT.10', 'NUM.PV.TENS'],
    lessonRef: 'lesson-sub-regroup-2d',
    visualKinds: ['place-value-blocks', 'number-line'],
    mode: 'procedure',
  },
  {
    id: 'skill-add-3d',
    subject: 'arithmetic',
    strand: 'addition',
    code: 'ADD.3D',
    name: 'Add three-digit numbers',
    band: 'middle',
    prerequisites: ['ADD.REGROUP.2D', 'NUM.PV.HUNDREDS'],
    lessonRef: 'lesson-add-3d',
    visualKinds: ['place-value-blocks'],
    mode: 'procedure',
  },
] as const satisfies readonly Skill[];
