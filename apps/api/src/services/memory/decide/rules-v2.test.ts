import { describe, expect, it } from 'vitest';

import { sequentialUuids } from '@/lib/ids';
import { consolidateSession } from '@/services/memory/consolidate/core';
import type { EpisodeProposal } from '@/services/memory/propose/episodes';
import type { MemoryProposal } from '@/services/memory/propose/from-events';
import { driftReport } from '@/services/memory/rebuild/drift.report';
import { createRebuildStore } from '@/services/memory/rebuild/memory-store';
import type { LearnerFact } from '@/types/memory';

import { resolveConflict, strongestByKind } from './conflict';
import { episodeExpiresAt, factExpiresAt } from './expiry';
import { isPromotable } from './sensitivity';

const NOW = new Date('2026-11-12T18:00:00.000Z');
const DAY = 86_400_000;

function proposal(overrides: Partial<MemoryProposal> = {}): MemoryProposal {
  return {
    kind: 'preference',
    text: 'Loves mystery stories.',
    confidence: 0.9,
    temporary: false,
    sensitive: false,
    sourceEventId: 'event-1',
    skillCode: null,
    ...overrides,
  };
}

function fact(overrides: Partial<LearnerFact> = {}): LearnerFact {
  return {
    id: 'fact-1',
    studentId: 'student-1',
    kind: 'preference',
    value: { text: 'Loves space stories.', skillCode: null },
    confidence: 0.9,
    firstObservedAt: NOW,
    lastConfirmedAt: NOW,
    expiresAt: null,
    sensitivity: 'normal',
    modelShareable: true,
    supersededBy: null,
    evidenceCount: 1,
    ...overrides,
  };
}

describe('expiry by kind (P3-02)', () => {
  it.each([
    ['mood', 1],
    ['engagement', 1],
    ['preference', 180],
    ['teaching_response', 365],
  ] as const)('%s lasts %s days', (kind, days) => {
    expect(factExpiresAt(kind, NOW)?.getTime()).toBe(NOW.getTime() + days * DAY);
  });

  it('keeps a goal until its own end date, and breakthroughs for good', () => {
    const end = new Date('2026-12-20T00:00:00.000Z');
    expect(factExpiresAt('goal', NOW, { goalEndsAt: end })).toEqual(end);
    expect(factExpiresAt('practice_persistence', NOW)).toBeNull();
    expect(episodeExpiresAt('breakthrough', NOW)).toBeNull();
    expect(episodeExpiresAt('struggle', NOW)?.getTime()).toBe(NOW.getTime() + 90 * DAY);
  });
});

describe('conflict rules, in order (P3-02)', () => {
  it('1: a corrected fact is never replaced by consolidation', () => {
    expect(resolveConflict([fact({ corrected: true })], proposal())).toEqual({
      action: 'keep',
      reason: 'corrected',
    });
  });

  it('2: newer evidence replaces older within 0.1 confidence, and not beyond', () => {
    expect(resolveConflict([fact()], proposal({ confidence: 0.8 }))).toMatchObject({
      action: 'supersede',
    });
    expect(resolveConflict([fact()], proposal({ confidence: 0.79 }))).toEqual({
      action: 'keep',
      reason: 'less_sure',
    });
  });

  it('3: one contradiction against three evidence rows only weakens the fact', () => {
    expect(resolveConflict([fact({ evidenceCount: 3 })], proposal())).toMatchObject({
      action: 'weaken',
    });
  });

  it('4: two proposals of one kind — the surer wins', () => {
    const chosen = strongestByKind([
      proposal({ confidence: 0.6, text: 'a' }),
      proposal({ confidence: 0.95, text: 'b' }),
    ]);
    expect(chosen.map((item) => item.text)).toEqual(['b']);
  });

  it('confirms what is said again instead of duplicating it', () => {
    expect(
      resolveConflict([fact({ value: { text: 'Loves mystery stories.' } })], proposal()),
    ).toMatchObject({ action: 'confirm' });
  });
});

describe('what may become memory at all', () => {
  it('refuses a flagged source, a model-flagged proposal and a sensitive category', () => {
    expect(isPromotable(proposal(), new Set())).toBe(true);
    expect(isPromotable(proposal(), new Set(['event-1']))).toBe(false);
    expect(isPromotable(proposal({ sensitive: true }), new Set())).toBe(false);
    expect(isPromotable(proposal({ text: 'Goes to church on Sundays.' }), new Set())).toBe(false);
  });
});

describe('the consolidation core against the rebuild store', () => {
  const episode: EpisodeProposal = {
    kind: 'return_after_absence',
    at: NOW,
    summary: 'Came back after 20 days away.',
    importance: 0.4,
    skillCode: null,
    evidence: [{ sourceKind: 'session_event', sourceId: 'event-9' }],
  };
  const run = (
    store: ReturnType<typeof createRebuildStore>,
    proposals: MemoryProposal[],
    flagged: string[] = [],
  ) =>
    consolidateSession(store, {
      sessionId: 'session-1',
      proposals,
      episodes: [episode],
      flaggedEventIds: new Set(flagged),
      repetitionsForDurableFact: 1,
      now: NOW,
    });

  it('writes once, and a second run of the same session writes nothing', async () => {
    const store = createRebuildStore('student-1', sequentialUuids());
    await run(store, [proposal()]);
    await run(store, [proposal()]);
    expect(store.facts()).toHaveLength(1);
    expect(store.episodes()).toHaveLength(1);
    expect(store.facts()[0]?.expiresAt?.getTime()).toBe(NOW.getTime() + 180 * DAY);
  });

  it('remembers nothing from a flagged event', async () => {
    const store = createRebuildStore('student-1', sequentialUuids());
    await run(store, [proposal()], ['event-1', 'event-9']);
    expect([store.facts().length, store.episodes().length]).toEqual([0, 0]);
  });

  it('records a changed preference as a moment', async () => {
    const store = createRebuildStore('student-1', sequentialUuids());
    await run(store, [proposal({ text: 'Loves space stories.', sourceEventId: 'event-0' })]);
    await run(store, [proposal()]);
    expect(store.episodes().map((item) => item.kind)).toContain('preference_change');
  });
});

describe('drift', () => {
  it('is 0 when both sides say the same things, and names what differs', () => {
    const same = [{ kind: 'preference', text: 'Loves mystery stories.' }];
    expect(
      driftReport(same, [{ kind: 'preference', text: 'loves  mystery stories' }]).driftScore,
    ).toBe(0);
    const report = driftReport(same, [{ kind: 'preference', text: 'Loves boats.' }]);
    expect(report).toMatchObject({
      driftScore: 1,
      onlyInShadow: ['preference|loves mystery stories'],
      onlyInLive: ['preference|loves boats'],
    });
    expect(driftReport([], []).driftScore).toBe(0);
  });
});
