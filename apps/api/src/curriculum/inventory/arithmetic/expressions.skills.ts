import type { Skill } from '@aria/shared';

/**
 * Expressions and equations (P3-07). Standards: 5.OA.A.1 and 6.EE.A.2.c (order of operations,
 * evaluating expressions), 6.EE.B.7 (one-step equations) and 7.EE.B.4.a (two-step equations).
 *
 * An equation is checked by putting the answer back in, never by trusting a solver; the
 * two-step equation is the strand's `procedure`, undone one step at a time in reverse.
 */
export const EXPRESSION_SKILLS = [
  {
    id: 'skill-exp-order',
    subject: 'arithmetic',
    strand: 'expressions',
    code: 'EXP.ORDER',
    name: 'Use the order of operations',
    band: 'middle',
    prerequisites: ['MUL.FACT.10', 'ADD.FACT.20'],
    lessonRef: 'lesson-exp-order',
    visualKinds: ['number-line'],
    mode: 'number_sense',
  },
  {
    id: 'skill-exp-eval',
    subject: 'arithmetic',
    strand: 'expressions',
    code: 'EXP.EVAL',
    name: 'Work out an expression with a letter in it',
    band: 'senior',
    prerequisites: ['EXP.ORDER'],
    lessonRef: 'lesson-exp-eval',
    visualKinds: ['number-line'],
    mode: 'number_sense',
  },
  {
    id: 'skill-eqn-one',
    subject: 'arithmetic',
    strand: 'equations',
    code: 'EQN.ONE',
    name: 'Solve a one-step equation',
    band: 'senior',
    prerequisites: ['EXP.EVAL', 'DIV.FACT.10'],
    lessonRef: 'lesson-eqn-one',
    visualKinds: ['number-line'],
    mode: 'number_sense',
  },
  {
    id: 'skill-eqn-two',
    subject: 'arithmetic',
    strand: 'equations',
    code: 'EQN.TWO',
    name: 'Solve a two-step equation',
    band: 'senior',
    prerequisites: ['EQN.ONE'],
    lessonRef: 'lesson-eqn-two',
    visualKinds: ['number-line'],
    mode: 'procedure',
  },
] as const satisfies readonly Skill[];
