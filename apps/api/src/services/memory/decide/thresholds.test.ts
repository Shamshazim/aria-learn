import { describe, expect, it } from 'vitest';

import type { MemoryProposal } from '@/services/memory/propose/from-events';

import { decideProposal } from './thresholds';

const NOW = new Date('2026-11-10T20:00:00.000Z');

function proposal(kind: string, overrides: Partial<MemoryProposal> = {}): MemoryProposal {
  return {
    kind,
    text: 'Shorter prompts helped.',
    confidence: 0.9,
    temporary: false,
    sensitive: false,
    sourceEventId: 'event-1',
    skillCode: null,
    ...overrides,
  };
}

describe('P3-05: what consolidation may keep about engagement', () => {
  it.each(['engagement', 'tired', 'frustrated', 'disengaged', 'uncertain', 'ready'])(
    'never promotes the %s kind, however often it repeats',
    (kind) => {
      const decision = decideProposal({
        proposal: proposal(kind),
        repeatedCount: 10,
        repetitionsForDurableFact: 1,
        now: NOW,
      });
      expect(decision).toEqual({ kind: 'reject', reason: 'engagement is never remembered' });
    },
  );

  it('keeps a teaching response only after three sessions, even when one would do', () => {
    const decide = (repeatedCount: number) =>
      decideProposal({
        proposal: proposal('teaching_response'),
        repeatedCount,
        repetitionsForDurableFact: 1,
        now: NOW,
      }).kind;
    expect([decide(1), decide(2), decide(3)]).toEqual(['observation', 'observation', 'fact']);
  });
});
