import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Long division goes wrong at the end, with what is left, or in the middle, with a zero. */
export const DIV_LONG_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-div-long-remainder-dropped',
    skillCode: 'DIV.LONG',
    name: 'Forgets what is left over',
    signature: 'Gives the quotient and leaves out the remainder',
    remediation: 'After the last take away, look at what is left. Write it after an r.',
    approach: 'concrete-story',
    model: 'counters shared into equal groups with the leftovers set to one side',
    detects: { kind: 'derived', rule: 'remainder-dropped' },
  },
  {
    id: 'misconception-div-long-remainder-as-decimal',
    skillCode: 'DIV.LONG',
    name: 'Writes the remainder as a decimal',
    signature: 'Puts the remainder after a decimal point, as if one left over were one tenth',
    remediation: 'One left over is one whole thing, not a tenth. Write it as r 1.',
    approach: 'concrete-story',
    model: 'one whole counter left over beside the equal groups',
    detects: { kind: 'derived', rule: 'remainder-as-decimal' },
  },
  {
    id: 'misconception-div-long-missing-zero',
    skillCode: 'DIV.LONG',
    name: 'Leaves out a zero in the answer',
    signature: 'Skips a step where the divisor does not go, so no zero is written',
    remediation: 'Four into one goes zero times. Write the zero, then bring down the next digit.',
    approach: 'worked-example',
    model: 'a long division with a zero written above the digit it would not go into',
    detects: { kind: 'derived', rule: 'missing-zero-in-quotient' },
  },
];
