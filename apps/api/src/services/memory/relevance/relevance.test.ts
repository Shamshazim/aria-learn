import { describe, expect, it } from 'vitest';

import { applyTokenBudget } from '@/services/memory/relevance/budget';
import { rankRelevantFacts } from '@/services/memory/relevance/rules';
import type { LearnerFact } from '@/types/memory';

const NOW = new Date('2026-08-24T20:00:00.000Z');

describe('memory relevance', () => {
  it('excludes facts that are expired, superseded or parent-excluded', () => {
    const ranked = rankRelevantFacts(
      [
        fact('current', { modelShareable: true, supersededBy: null, expiresAt: null }),
        fact('private', { modelShareable: false, supersededBy: null, expiresAt: null }),
        fact('old', { modelShareable: true, supersededBy: 'replacement', expiresAt: null }),
        fact('expired', {
          modelShareable: true,
          supersededBy: null,
          expiresAt: new Date('2026-08-23T20:00:00.000Z'),
        }),
      ],
      { skillCode: 'ADD.WITHIN_10', now: NOW },
    );
    expect(ranked.map((item) => item.fact.id)).toEqual(['current']);
  });

  it('truncates deterministically without exceeding the hard token budget', () => {
    const ranked = rankRelevantFacts(
      [fact('a', {}), fact('b', { confirmedAt: new Date('2026-08-23T20:00:00.000Z') })],
      { skillCode: 'ADD.WITHIN_10', now: NOW },
    );
    const first = applyTokenBudget(ranked, 6);
    const second = applyTokenBudget(ranked, 6);
    expect(first).toEqual(second);
    expect(first.estimatedTokens).toBeLessThanOrEqual(6);
    expect(first.facts.map((item) => item.fact.id)).toEqual(['a']);
  });
});

function fact(
  id: string,
  overrides: Readonly<{
    modelShareable?: boolean;
    supersededBy?: string | null;
    expiresAt?: Date | null;
    confirmedAt?: Date;
  }>,
): LearnerFact {
  return {
    id,
    studentId: 'student-1',
    kind: 'teaching_response',
    value: { text: 'Blocks help me learn.', skillCode: 'ADD.WITHIN_10' },
    confidence: 0.9,
    firstObservedAt: NOW,
    lastConfirmedAt: overrides.confirmedAt ?? NOW,
    expiresAt: overrides.expiresAt ?? null,
    sensitivity: 'normal',
    modelShareable: overrides.modelShareable ?? true,
    supersededBy: overrides.supersededBy ?? null,
  };
}
