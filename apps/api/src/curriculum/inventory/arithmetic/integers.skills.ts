import type { Skill } from '@aria/shared';

/**
 * Integers (P3-07). Standards: 6.NS.C.7.b (ordering integers), 6.NS.C.7.c (absolute value as
 * distance from zero), 7.NS.A.1 (adding and taking away integers) and 7.NS.A.2 (multiplying and
 * dividing integers).
 *
 * Every skill here is taught on a number line that shows zero, so all are `number_sense`:
 * the sign rules are what the line shows, not a procedure to remember. Comparing comes first,
 * and stands on comparing whole numbers; the operations stand on the facts they extend.
 */
export const INTEGER_SKILLS = [
  {
    id: 'skill-int-cmp',
    subject: 'arithmetic',
    strand: 'integers',
    code: 'INT.CMP',
    name: 'Compare integers, negatives included',
    band: 'senior',
    prerequisites: ['NUM.CMP.100'],
    lessonRef: 'lesson-int-cmp',
    visualKinds: ['number-line'],
    mode: 'number_sense',
  },
  {
    id: 'skill-int-abs',
    subject: 'arithmetic',
    strand: 'integers',
    code: 'INT.ABS',
    name: 'Absolute value as distance from zero',
    band: 'senior',
    prerequisites: ['INT.CMP'],
    lessonRef: 'lesson-int-abs',
    visualKinds: ['number-line'],
    mode: 'number_sense',
  },
  {
    id: 'skill-int-add',
    subject: 'arithmetic',
    strand: 'integers',
    code: 'INT.ADD',
    name: 'Add and take away integers',
    band: 'senior',
    prerequisites: ['INT.CMP', 'ADD.FACT.20', 'SUB.FACT.10'],
    lessonRef: 'lesson-int-add',
    visualKinds: ['number-line'],
    mode: 'number_sense',
  },
  {
    id: 'skill-int-mul',
    subject: 'arithmetic',
    strand: 'integers',
    code: 'INT.MUL',
    name: 'Multiply and divide integers',
    band: 'senior',
    prerequisites: ['INT.ADD', 'MUL.FACT.10', 'DIV.FACT.10'],
    lessonRef: 'lesson-int-mul',
    visualKinds: ['number-line'],
    mode: 'number_sense',
  },
] as const satisfies readonly Skill[];
