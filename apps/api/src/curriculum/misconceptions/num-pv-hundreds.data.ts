import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Three-digit place value: the same wrong ideas as two digits, with one more place to confuse. */
export const NUM_PV_HUNDREDS_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-num-pv-hundreds-next-place',
    skillCode: 'NUM.PV.HUNDREDS',
    name: 'Reads the place next door',
    signature:
      'Gives the tens digit when asked for the hundreds, or the ones when asked for the tens',
    remediation:
      'Build it with flats, rods and cubes. Hundreds are the flats, tens the rods, ones the cubes.',
    approach: 'visual-model',
    model: 'place-value blocks: hundreds flats, tens rods and ones cubes in three columns',
    detects: { kind: 'derived', rule: 'other-place-digit' },
  },
  {
    id: 'misconception-num-pv-hundreds-amount',
    skillCode: 'NUM.PV.HUNDREDS',
    name: 'Says how much the digit is worth, not the digit',
    signature: 'Answers 300 for the hundreds digit of 352',
    remediation: 'The 3 is worth three hundred; the digit is 3. The question asks for the digit.',
    approach: 'worked-example',
    model: 'a three-column place-value chart, the hundreds digit circled and labelled "3 hundreds"',
    detects: { kind: 'derived', rule: 'place-amount' },
  },
  {
    id: 'misconception-num-pv-hundreds-whole',
    skillCode: 'NUM.PV.HUNDREDS',
    name: 'Answers with the whole number',
    signature: 'Repeats the number instead of naming one digit of it',
    remediation: 'Put each digit in its own box. Read only the box the question names.',
    approach: 'simpler-case',
    model: 'a three-box place-value chart with one digit in each box',
    detects: { kind: 'derived', rule: 'whole-number' },
  },
];
