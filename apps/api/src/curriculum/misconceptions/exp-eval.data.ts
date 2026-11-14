import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Reading "3n" goes wrong three ways: as digits, as adding, or as just the letter. */
export const EXP_EVAL_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-exp-eval-concatenated',
    skillCode: 'EXP.EVAL',
    name: 'Puts the number next to the value',
    signature: 'Reads 3n with n as 5 as thirty-five',
    remediation: '3n means 3 times n. With n as 5, that is 3 × 5, not 35.',
    approach: 'worked-example',
    model: 'a times sign written between the 3 and the n',
    detects: { kind: 'derived', rule: 'concatenated-coefficient' },
  },
  {
    id: 'misconception-exp-eval-added',
    skillCode: 'EXP.EVAL',
    name: 'Adds the number to the value',
    signature: 'Reads 3n as 3 add n',
    remediation: '3n is three lots of n. Three lots of 5 is 15.',
    approach: 'concrete-story',
    model: 'three bags with n sweets in each',
    detects: { kind: 'derived', rule: 'added-coefficient' },
  },
  {
    id: 'misconception-exp-eval-ignored',
    skillCode: 'EXP.EVAL',
    name: 'Drops the number in front of the letter',
    signature: 'Puts the value in for 3n as if the 3 were not there',
    remediation: 'The 3 counts. It says how many n there are.',
    approach: 'concrete-story',
    model: 'three bags with n sweets in each',
    detects: { kind: 'derived', rule: 'ignored-coefficient' },
  },
];
