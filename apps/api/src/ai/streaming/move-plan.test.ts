import { describe, expect, it } from 'vitest';

import { validateMovePlan } from '@/ai/streaming';

describe('validateMovePlan', () => {
  it('rejects typed early-band input and an unverified question', () => {
    expect(
      validateMovePlan({
        moveKind: 'ASK',
        band: 'early',
        answerJudgement: 'not-applicable',
        teachingClaim: 'One and one make two.',
        responseType: 'text',
      }),
    ).toMatchObject({ valid: false });
  });

  it('rejects a wrong arithmetic claim before speech generation', () => {
    expect(
      validateMovePlan({
        moveKind: 'SAY',
        band: 'middle',
        answerJudgement: 'incorrect',
        teachingClaim: 'Seven and three make eleven.',
        responseType: 'none',
        arithmetic: {
          problem: { skillCode: 'ADD.FACT.10', kind: 'addition', left: '7', right: '3' },
          candidate: '11',
        },
      }),
    ).toMatchObject({ valid: false });
  });
});
