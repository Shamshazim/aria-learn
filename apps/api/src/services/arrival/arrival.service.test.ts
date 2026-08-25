import { describe, expect, it, vi } from 'vitest';

import { fixedClock } from '@/lib/clock';
import { sequentialIds } from '@/lib/ids';
import { createQualityGate } from '@/quality';
import type { ArrivalEventRepository } from '@/repositories/arrival-event.repository';
import { createArrivalService } from '@/services/arrival/arrival.service';
import type { ArrivalContext } from '@/services/arrival/context.loader';
import { createMoveFactory } from '@/services/moves/move-factory';

const NOW = new Date('2026-08-24T20:00:00.000Z');

describe('arrival service', () => {
  it('returns welcome and check-in and writes exactly one arrival event', async () => {
    const insert = vi.fn<ArrivalEventRepository['insert']>((input) =>
      Promise.resolve({
        id: 'arrival-1',
        at: NOW,
        ...input,
      }),
    );
    const service = createArrivalService({
      load: () => Promise.resolve(context()),
      arrivals: {
        insert,
        findById: vi.fn(() => Promise.resolve(null)),
        setAccepted: vi.fn(() => Promise.resolve(true)),
      },
      moves: createMoveFactory({ ids: sequentialIds('move'), clock: fixedClock(NOW) }),
      gate: passingGate(),
      nowMs: () => NOW.getTime(),
    });

    const result = await service.arrive('student-1');

    expect(result.moves.map((move) => move.kind)).toEqual(['WELCOME', 'CHECK_IN']);
    expect(result.student).toEqual({ grade: '4', band: 'middle' });
    expect(insert).toHaveBeenCalledOnce();
  });

  it('cites the supported fact in a recent return welcome', async () => {
    const recent = context({ recent: true });
    const service = createArrivalService({
      load: () => Promise.resolve(recent),
      arrivals: {
        insert: vi.fn((input) => Promise.resolve({ id: 'arrival-1', at: NOW, ...input })),
        findById: vi.fn(() => Promise.resolve(null)),
        setAccepted: vi.fn(() => Promise.resolve(true)),
      },
      moves: createMoveFactory({ ids: sequentialIds('move'), clock: fixedClock(NOW) }),
      gate: passingGate(),
      nowMs: () => NOW.getTime(),
    });

    const result = await service.arrive('student-1');
    expect(result.moves[0]).toMatchObject({ kind: 'WELCOME', basedOn: ['fact-1'] });
  });

  it('uses the neutral long-absence welcome without old evidence', async () => {
    const old = context({ recent: true, endedAt: new Date(NOW.getTime() - 15 * 86_400_000) });
    const service = createArrivalService({
      load: () => Promise.resolve(old),
      arrivals: arrivalRepository(),
      moves: createMoveFactory({ ids: sequentialIds('move'), clock: fixedClock(NOW) }),
      gate: passingGate(),
      nowMs: () => NOW.getTime(),
    });
    const result = await service.arrive('student-1');
    expect(result.moves[0]).toMatchObject({ kind: 'WELCOME', basedOn: [] });
  });

  it('omits a recommendation when no skill is due', async () => {
    const service = createArrivalService({
      load: () => Promise.resolve(context()),
      arrivals: arrivalRepository(),
      moves: createMoveFactory({ ids: sequentialIds('move'), clock: fixedClock(NOW) }),
      gate: passingGate(),
      nowMs: () => NOW.getTime(),
    });
    expect((await service.arrive('student-1')).recommendedSubject).toBeNull();
  });
});

function passingGate() {
  return createQualityGate(() => ({ safe: true, categories: [] }));
}

function arrivalRepository(): ArrivalEventRepository {
  return {
    insert: vi.fn((input) => Promise.resolve({ id: 'arrival-1', at: NOW, ...input })),
    findById: vi.fn(() => Promise.resolve(null)),
    setAccepted: vi.fn(() => Promise.resolve(true)),
  };
}

function context(overrides: Readonly<{ recent?: boolean; endedAt?: Date }> = {}): ArrivalContext {
  const recent = overrides.recent ?? false;
  return {
    student: {
      id: 'student-1',
      parentId: 'parent-1',
      displayName: 'Sam',
      grade: '4',
      band: 'middle',
      createdAt: NOW,
    },
    lastSession: recent
      ? {
          id: 'session-1',
          studentId: 'student-1',
          subject: 'math',
          grade: '4',
          band: 'middle',
          startedAt: new Date(NOW.getTime() - 3_600_000),
          endedAt: overrides.endedAt ?? new Date(NOW.getTime() - 1_800_000),
          endReason: 'complete',
          plan: {},
          summary: null,
        }
      : null,
    evidence: recent
      ? {
          id: 'event-1',
          sessionId: 'session-1',
          seq: 1,
          at: new Date(NOW.getTime() - 1_800_000),
          actor: 'aria',
          kind: 'PRAISE',
          text: 'Yes.',
          skillCode: 'ADD.FACT.10',
          correct: null,
          latencyMs: null,
          evidence: {},
          payload: {},
        }
      : null,
    facts: recent
      ? [
          {
            id: 'fact-1',
            studentId: 'student-1',
            kind: 'practice_persistence',
            value: { text: 'Finished a practice step.' },
            confidence: 0.9,
            firstObservedAt: NOW,
            lastConfirmedAt: NOW,
            expiresAt: null,
            sensitivity: 'normal',
            modelShareable: true,
            supersededBy: null,
          },
        ]
      : [],
    dueSkills: [],
    now: NOW,
  };
}
