import type { Skill } from '@aria/shared';

/**
 * Multiplication and division (P3-07). Standards: 3.OA.C.7 (multiply and divide within 100,
 * knowing the products of one-digit numbers from memory), 4.NBT.B.5 (multiply a two-digit
 * number by a one-digit number) and 4.NBT.B.6 (divide up to four digits by one digit, with
 * remainders).
 *
 * Multiplication stands on skip-counting and on adding within twenty; division stands on the
 * facts it undoes. The written methods are `procedure`: worked one step at a time, and the
 * answer is never revealed before the child has had a go at every step.
 */
export const MUL_DIV_SKILLS = [
  {
    id: 'skill-mul-fact-10',
    subject: 'arithmetic',
    strand: 'multiplication',
    code: 'MUL.FACT.10',
    name: 'Recall multiplication facts to ten times ten',
    band: 'middle',
    prerequisites: ['NUM.CNT.SKIP5', 'ADD.FACT.20'],
    lessonRef: 'lesson-mul-fact-10',
    visualKinds: ['array', 'number-line'],
    mode: 'fact',
  },
  {
    id: 'skill-div-fact-10',
    subject: 'arithmetic',
    strand: 'division',
    code: 'DIV.FACT.10',
    name: 'Recall the division facts that undo the times tables',
    band: 'middle',
    prerequisites: ['MUL.FACT.10'],
    lessonRef: 'lesson-div-fact-10',
    visualKinds: ['array'],
    mode: 'fact',
  },
  {
    id: 'skill-mul-2d1d',
    subject: 'arithmetic',
    strand: 'multiplication',
    code: 'MUL.2D1D',
    name: 'Multiply a two-digit number by a one-digit number',
    band: 'middle',
    prerequisites: ['MUL.FACT.10', 'ADD.REGROUP.2D'],
    lessonRef: 'lesson-mul-2d1d',
    visualKinds: ['place-value-blocks', 'array'],
    mode: 'procedure',
  },
  {
    id: 'skill-div-long',
    subject: 'arithmetic',
    strand: 'division',
    code: 'DIV.LONG',
    name: 'Long division by a one-digit number, with remainders',
    band: 'middle',
    prerequisites: ['DIV.FACT.10', 'SUB.REGROUP.2D'],
    lessonRef: 'lesson-div-long',
    visualKinds: ['place-value-blocks'],
    mode: 'procedure',
  },
] as const satisfies readonly Skill[];
