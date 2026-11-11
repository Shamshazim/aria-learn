import { describe, expect, it } from 'vitest';

import { fixedText, GENERIC_ACKNOWLEDGEMENT } from '@/services/content/fixed-text';
import { praiseTurn } from '@/services/content/move-inputs/__fixtures__/turns.fixture';

function acknowledgement(evidence: Readonly<Record<string, string>>): string | null {
  const turn = praiseTurn([]);
  return fixedText({
    ...turn,
    plan: { ...turn.plan, kind: 'SAY', approach: 'acknowledge-correction', evidence },
  });
}

describe('the one-sentence acknowledgement of a self-correction (P3-06)', () => {
  it('names the plain word the child used', () => {
    expect(
      acknowledgement({ selfCorrection: 'stopped_liking', selfCorrectionThing: 'trucks' }),
    ).toBe('Got it, no more trucks.');
    expect(
      acknowledgement({
        selfCorrection: 'renamed',
        selfCorrectionRelation: 'dog',
        selfCorrectionName: 'rex',
      }),
    ).toBe('Got it, Rex it is.');
  });

  it('never reads back anything that is not a short plain word, and never touches a grade', () => {
    expect(
      acknowledgement({
        selfCorrection: 'stopped_liking',
        selfCorrectionThing: 'visit 12 main street',
      }),
    ).toBe(GENERIC_ACKNOWLEDGEMENT);
    expect(acknowledgement({ selfCorrection: 'grade', selfCorrectionGrade: '3' })).toBe(
      GENERIC_ACKNOWLEDGEMENT,
    );
  });
});
