import { describe, expect, it } from 'vitest';

import { sensitiveCategory } from '@/services/memory/decide/sensitivity';
import { rankRelevantFacts } from '@/services/memory/relevance/rules';
import type { LearnerFact } from '@/types/memory';

import { childCorrectionRequest, selfCorrectionFrom } from './from-child';
import { judgementIn } from './judgement';

const NOW = new Date('2026-11-10T20:00:00.000Z');

function fact(
  id: string,
  kind: string,
  text: string,
  overrides: Partial<LearnerFact> = {},
): LearnerFact {
  return {
    id,
    studentId: 'student-1',
    kind,
    value: { text },
    confidence: 0.9,
    firstObservedAt: NOW,
    lastConfirmedAt: NOW,
    expiresAt: null,
    sensitivity: 'normal',
    modelShareable: true,
    supersededBy: null,
    ...overrides,
  };
}

describe('what a correction may say (P3-06)', () => {
  it.each([
    ['Has ADHD and takes medication.', 'health'],
    ['Her parents are getting divorced.', 'family_conflict'],
    ['Goes to church on Sundays.', 'religion'],
    ['They are refugees.', 'immigration'],
    ['We cannot afford books.', 'money'],
  ] as const)('refuses %j as %s', (text, category) => {
    expect(sensitiveCategory(text)).toBe(category);
  });

  it.each(['Likes to add big numbers.', 'Loves mystery stories.', 'Uses a period at the end now.'])(
    'lets an ordinary learning fact through: %j',
    (text) => {
      expect(sensitiveCategory(text)).toBeNull();
    },
  );

  it.each(['He is lazy.', 'a naughty boy', 'not very smart', 'bad at maths', 'She is so clever'])(
    'calls %j a judgement',
    (text) => {
      expect(judgementIn(text)).toBe(true);
    },
  );

  it.each(['Prefers short questions.', 'Finished a hard puzzle without help.'])(
    'lets a description through: %j',
    (text) => {
      expect(judgementIn(text)).toBe(false);
    },
  );
});

describe("matching a child's self-correction to what Aria remembers", () => {
  const current = [
    fact('f-trucks', 'preference', 'Loves monster trucks.'),
    fact('f-dog', 'relationship', 'Their dog is called Biscuit.'),
  ];

  it('retracts the preference that names the thing', () => {
    expect(childCorrectionRequest({ kind: 'stopped_liking', thing: 'trucks' }, current)).toEqual({
      targetKind: 'fact',
      targetId: 'f-trucks',
      action: 'retract',
    });
  });

  it('replaces the relationship fact with the new name', () => {
    expect(
      childCorrectionRequest({ kind: 'renamed', relation: 'dog', name: 'rex' }, current),
    ).toMatchObject({
      targetId: 'f-dog',
      action: 'replace',
      newValue: { text: 'Their dog is called rex.' },
    });
  });

  it('changes nothing it cannot match, and never a grade', () => {
    expect(
      childCorrectionRequest({ kind: 'stopped_liking', thing: 'football' }, current),
    ).toBeNull();
    expect(childCorrectionRequest({ kind: 'grade', grade: '3' }, current)).toBeNull();
  });

  it('reads the correction back from turn evidence, and nothing from evidence without one', () => {
    expect(
      selfCorrectionFrom({ selfCorrection: 'stopped_liking', selfCorrectionThing: 'trucks' }),
    ).toEqual({ kind: 'stopped_liking', thing: 'trucks' });
    expect(selfCorrectionFrom({ approach: 'direct' })).toBeNull();
  });
});

describe('retrieval honours corrections', () => {
  it('ranks a corrected fact ahead of anything inferred', () => {
    const ranked = rankRelevantFacts(
      [
        fact('f-goal', 'goal', 'Wants to read chapter books.', { confidence: 1 }),
        fact('f-pref', 'preference', 'Loves mystery stories.', {
          confidence: 0.8,
          corrected: true,
        }),
      ],
      { skillCode: null, now: NOW },
    );
    expect(ranked.map((item) => item.fact.id)).toEqual(['f-pref', 'f-goal']);
  });
});
