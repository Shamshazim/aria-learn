import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Adding integers goes wrong in the sign, or in what taking away a negative means. */
export const INT_ADD_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-int-add-wrong-sign',
    skillCode: 'INT.ADD',
    name: 'Gets the size right and the sign wrong',
    signature: 'Gives the right number of steps but on the wrong side of zero',
    remediation: 'Start at -5 on the line and jump 3 to the right. Where do you land?',
    approach: 'visual-model',
    model: 'a number line with the jumps drawn from the first number',
    detects: { kind: 'derived', rule: 'wrong-sign' },
  },
  {
    id: 'misconception-int-add-minus-negative',
    skillCode: 'INT.ADD',
    name: 'Treats taking away a negative as taking away',
    signature: 'Works 5 take away -3 as 5 take away 3',
    remediation: 'Taking away a debt leaves you richer. 5 take away -3 is 5 add 3.',
    approach: 'concrete-story',
    model: 'a debt of three being cancelled',
    detects: { kind: 'derived', rule: 'minus-negative-as-minus' },
  },
  {
    id: 'misconception-int-add-magnitudes-added',
    skillCode: 'INT.ADD',
    name: 'Adds the sizes when the signs differ',
    signature: 'Adds the two sizes and keeps the first sign, as if both had the same sign',
    remediation: 'A plus and a minus pull opposite ways. Find the difference, then the sign.',
    approach: 'visual-model',
    model: 'red and yellow counters pairing off to make zero',
    detects: { kind: 'derived', rule: 'magnitudes-added' },
  },
];
