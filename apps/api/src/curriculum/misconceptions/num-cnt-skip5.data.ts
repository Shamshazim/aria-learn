import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Skip counting fails by falling back to counting by one, which is the whole difficulty. */
export const NUM_CNT_SKIP5_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-num-cnt-skip5-by-one',
    skillCode: 'NUM.CNT.SKIP5',
    name: 'Counts on by one instead of by five',
    signature: 'Adds one to the last number when the step is five',
    remediation: 'Each jump is a whole hand. Count the hand, not the finger.',
    detects: { kind: 'derived', rule: 'counted-by-one' },
  },
  {
    id: 'misconception-num-cnt-skip5-restart',
    skillCode: 'NUM.CNT.SKIP5',
    name: 'Restarts the chant at five',
    signature: 'Answers with the first number of the sequence instead of continuing it',
    remediation: 'We are already at fifteen. Start the next jump from there.',
    detects: { kind: 'derived', rule: 'restarted-count' },
  },
  {
    id: 'misconception-num-cnt-skip5-repeats-last',
    skillCode: 'NUM.CNT.SKIP5',
    name: 'Repeats the last number of the chant',
    signature: 'Answers with the last number in the sequence rather than the one after it',
    remediation: 'Say the last number. Now take one whole jump of five.',
    detects: { kind: 'derived', rule: 'repeats-last' },
  },
];
