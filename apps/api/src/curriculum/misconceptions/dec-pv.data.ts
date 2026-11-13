import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Places after the point go wrong by order, by value, or by counting from the ones. */
export const DEC_PV_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-dec-pv-neighbour-digit',
    skillCode: 'DEC.PV',
    name: 'Reads the places in the wrong order',
    signature: 'Gives the hundredths digit for the tenths, or the tenths digit for the hundredths',
    remediation:
      'Tenths come first after the point. Then hundredths. Point at each one as you say it.',
    approach: 'visual-model',
    model: 'a place-value chart with ones, a point, tenths and hundredths',
    detects: { kind: 'derived', rule: 'decimal-neighbour-digit' },
  },
  {
    id: 'misconception-dec-pv-place-amount',
    skillCode: 'DEC.PV',
    name: 'Gives the value, not the digit',
    signature: 'Answers with how much the digit is worth, such as 0.4, instead of the digit',
    remediation: 'The 4 is worth four tenths. The question asks for the digit, so the answer is 4.',
    approach: 'worked-example',
    model: 'the digit circled, with its value written underneath',
    detects: { kind: 'derived', rule: 'decimal-place-amount' },
  },
  {
    id: 'misconception-dec-pv-ones-digit',
    skillCode: 'DEC.PV',
    name: 'Counts the ones as the first place',
    signature: 'Gives the ones digit when asked for the tenths',
    remediation: 'The point splits the whole ones from the parts. Tenths are just after the point.',
    approach: 'visual-model',
    model: 'a number line from 3 to 4 cut into tenths',
    detects: { kind: 'derived', rule: 'decimal-ones-digit' },
  },
];
