import type { Skill } from '@aria/shared';

/**
 * Addition and subtraction (P3-07). Standards: 1.OA.C.6 (facts within 10, toward fluency) and
 * 2.NBT.B.5 (two-digit addition with regrouping).
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
] as const satisfies readonly Skill[];
