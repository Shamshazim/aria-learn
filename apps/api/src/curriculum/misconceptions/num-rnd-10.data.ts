import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Rounding to ten goes wrong by always going one way, or by rounding to the wrong place. */
export const NUM_RND_10_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-num-rnd-10-always-down',
    skillCode: 'NUM.RND.10',
    name: 'Always rounds down',
    signature: 'Drops the ones digit, so 47 becomes 40',
    remediation:
      'Find the two tens it sits between and see which one it is closer to. 47 is three away from 50.',
    approach: 'visual-model',
    model: 'a number line from 40 to 50 with the number marked and the two distances counted',
    detects: { kind: 'derived', rule: 'rounded-down' },
  },
  {
    id: 'misconception-num-rnd-10-always-up',
    skillCode: 'NUM.RND.10',
    name: 'Always rounds up',
    signature: 'Goes to the next ten whatever the ones digit, so 42 becomes 50',
    remediation: '42 is two away from 40 and eight away from 50. It goes to the closer ten.',
    approach: 'visual-model',
    model: 'a number line from 40 to 50 with the number marked and the two distances counted',
    detects: { kind: 'derived', rule: 'rounded-up' },
  },
  {
    id: 'misconception-num-rnd-10-hundred',
    skillCode: 'NUM.RND.10',
    name: 'Rounds to the nearest hundred instead',
    signature: 'Gives 300 for 347 rounded to the nearest ten',
    remediation:
      'Nearest ten means the answer ends in a zero and changes the tens: 347 is between 340 and 350.',
    approach: 'worked-example',
    model: 'a number line from 340 to 350, then the same number on a line from 300 to 400',
    detects: { kind: 'derived', rule: 'rounded-to-hundred' },
  },
];
