import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** The counting slips that look like a wrong number and are really a lost place. */
export const NUM_CNT_20_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-num-cnt-20-restart',
    skillCode: 'NUM.CNT.20',
    name: 'Restarts the count at the beginning',
    signature: 'Answers with the first number of the sequence instead of continuing it',
    remediation: 'Point at where we already are. Say that number, then take one more step.',
    detects: { kind: 'derived', rule: 'restarted-count' },
  },
  {
    id: 'misconception-num-cnt-20-repeats-last',
    skillCode: 'NUM.CNT.20',
    name: 'Repeats the number just heard',
    signature: 'Answers with the last number in the sequence rather than the one after it',
    remediation: 'Say the last number, then ask what comes after it, one more.',
    detects: { kind: 'derived', rule: 'repeats-last' },
  },
  {
    id: 'misconception-num-cnt-20-skips-a-teen',
    skillCode: 'NUM.CNT.20',
    name: 'Skips a number in the teens',
    signature: 'Lands one past the answer, most often by leaving out fifteen',
    remediation: 'Walk the number line. Say every number out loud.',
    detects: { kind: 'off-by', delta: 1 },
  },
];
