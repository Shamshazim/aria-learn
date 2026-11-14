import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** A one-step equation goes wrong by undoing with the same operation, or by not solving at all. */
export const EQN_ONE_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-eqn-one-wrong-inverse',
    skillCode: 'EQN.ONE',
    name: 'Undoes with the same operation',
    signature: 'Adds to undo an addition, or multiplies to undo a times',
    remediation: 'Undo means do the opposite. To undo add 7, take 7 away from both sides.',
    approach: 'visual-model',
    model: 'a balance with the same taken off both pans',
    detects: { kind: 'derived', rule: 'wrong-inverse' },
  },
  {
    id: 'misconception-eqn-one-kept-right',
    skillCode: 'EQN.ONE',
    name: 'Gives the number on the right',
    signature: 'Answers with the right side of the equation',
    remediation: 'Put your answer back in. Does 15 + 7 make 15?',
    approach: 'worked-example',
    model: 'the answer written in place of x and checked',
    detects: { kind: 'derived', rule: 'kept-right-side' },
  },
  {
    id: 'misconception-eqn-one-operand',
    skillCode: 'EQN.ONE',
    name: 'Gives the number beside the letter',
    signature: 'Answers with the number that is added to, taken from or multiplying x',
    remediation: 'What number goes where x is? Try it: does it make both sides match?',
    approach: 'worked-example',
    model: 'a box drawn where x is, with guesses tried in it',
    detects: { kind: 'derived', rule: 'answered-the-operand' },
  },
];
