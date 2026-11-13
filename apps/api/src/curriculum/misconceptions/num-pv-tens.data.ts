import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Place value in two-digit numbers goes wrong by reading the wrong place, or the wrong amount. */
export const NUM_PV_TENS_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-num-pv-tens-other-place',
    skillCode: 'NUM.PV.TENS',
    name: 'Reads the other place',
    signature:
      'Gives the ones digit when asked for the tens, or the tens digit when asked for the ones',
    remediation:
      'Build the number with tens rods and loose ones. The tens are the rods; the ones are the loose cubes.',
    approach: 'visual-model',
    model: 'place-value blocks: tens rods on the left, ones cubes on the right',
    detects: { kind: 'derived', rule: 'other-place-digit' },
  },
  {
    id: 'misconception-num-pv-tens-amount',
    skillCode: 'NUM.PV.TENS',
    name: 'Says how much the digit is worth, not the digit',
    signature: 'Answers 40 for the tens digit of 47',
    remediation:
      'The 4 is worth forty, and the digit you can see is 4. The question asks for the digit.',
    approach: 'worked-example',
    model: 'the number written large, with the tens digit circled and labelled "4 tens"',
    detects: { kind: 'derived', rule: 'place-amount' },
  },
  {
    id: 'misconception-num-pv-tens-whole',
    skillCode: 'NUM.PV.TENS',
    name: 'Answers with the whole number',
    signature: 'Repeats the number instead of naming one digit of it',
    remediation:
      'A digit is one of the numbers you write. Point at the tens place and say just that one.',
    approach: 'simpler-case',
    model: 'a two-box place-value chart with one digit in each box',
    detects: { kind: 'derived', rule: 'whole-number' },
  },
];
