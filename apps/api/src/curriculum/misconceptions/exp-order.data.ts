import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Order of operations goes wrong by reading like a sentence, or by skipping the brackets. */
export const EXP_ORDER_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-exp-order-left-to-right',
    skillCode: 'EXP.ORDER',
    name: 'Works straight through from left to right',
    signature: 'Does each operation in the order it is written, ignoring times before add',
    remediation: 'Times and divide come before add and take away. Do 4 × 2 first, then add 3.',
    approach: 'worked-example',
    model: 'the multiplication circled and worked first, then the addition',
    detects: { kind: 'derived', rule: 'left-to-right' },
  },
  {
    id: 'misconception-exp-order-ignored-brackets',
    skillCode: 'EXP.ORDER',
    name: 'Ignores the brackets',
    signature: 'Works the expression as if the brackets were not there',
    remediation: 'Brackets go first, always. Work what is inside them, then the rest.',
    approach: 'worked-example',
    model: 'the bracket shaded and worked before anything else',
    detects: { kind: 'derived', rule: 'ignored-brackets' },
  },
  {
    id: 'misconception-exp-order-addition-first',
    skillCode: 'EXP.ORDER',
    name: 'Adds before multiplying',
    signature: 'Does the addition and taking away before the times and divide',
    remediation: '2 × 3 + 4 is two threes, then four more. Times first, then add.',
    approach: 'concrete-story',
    model: 'two bags of three apples and four loose apples',
    detects: { kind: 'derived', rule: 'addition-first' },
  },
];
