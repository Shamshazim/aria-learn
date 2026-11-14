import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Multiplying integers is the times tables plus a sign; each of these gets the sign wrong. */
export const INT_MUL_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-int-mul-wrong-sign',
    skillCode: 'INT.MUL',
    name: 'Gets the sign of the answer wrong',
    signature: 'Gives the right size with the opposite sign',
    remediation: 'Two signs the same give a plus. Two signs not the same give a minus.',
    approach: 'worked-example',
    model: 'a sign table with the two signs and the answer sign',
    detects: { kind: 'derived', rule: 'wrong-sign' },
  },
  {
    id: 'misconception-int-mul-sign-of-first',
    skillCode: 'INT.MUL',
    name: 'Gives the answer the first number’s sign',
    signature: 'Copies the sign of the first number onto the answer',
    remediation: 'Both numbers decide the sign. Two negatives make a positive.',
    approach: 'worked-example',
    model: 'the pattern -6 × 2, -6 × 1, -6 × 0, -6 × -1 going up by six',
    detects: { kind: 'derived', rule: 'sign-of-first-factor' },
  },
  {
    id: 'misconception-int-mul-added',
    skillCode: 'INT.MUL',
    name: 'Adds instead of multiplying',
    signature: 'Answers with the sum of the two numbers',
    remediation: 'Times means groups. -6 times 4 is four groups of -6.',
    approach: 'visual-model',
    model: 'four jumps of -6 on a number line',
    detects: { kind: 'derived', rule: 'added-instead' },
  },
];
