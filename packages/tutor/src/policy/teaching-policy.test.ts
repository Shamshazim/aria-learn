import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION, tutorInputEventSchema, type TutorInputEvent } from '@aria/shared';

import { createTeachingPolicy } from './teaching-policy';

import type { LoadedTurnContext } from '../types';

const EVENT = {
  id: 'event-1',
  at: '2026-08-24T20:00:00.000Z',
  protocolVersion: PROTOCOL_VERSION,
  kind: 'ANSWER',
  respondsTo: 'ask-1',
  text: 'wrong',
} satisfies TutorInputEvent;

function context(wrong: number, lastApproach: string | null): LoadedTurnContext<null> {
  return {
    session: {
      id: 'session-1',
      studentId: 'student-1',
      subject: 'math',
      grade: '4',
      band: 'middle',
      skillCode: 'ADD.WITHIN_10',
      startedAt: new Date('2026-08-24T19:55:00.000Z'),
      attempts: wrong,
      consecutiveWrong: wrong,
      repeatedMisconception: wrong > 1 ? 'counting-restarted' : null,
      lastApproach,
      unmetPrerequisite: 'ADD.WITHIN_10',
    },
    modelContext: null,
    recentKinds: [],
  };
}

const policy = createTeachingPolicy<null>({
  gradeAnswer: () => ({ correct: false, misconception: null }),
  sessionLimitMs: () => 20 * 60_000,
  now: () => new Date('2026-08-24T20:00:00.000Z'),
});

describe('teaching policy', () => {
  it.each([
    [0, null, 'HINT', 'single-nudge'],
    [1, 'single-nudge', 'RETEACH', 'visual-model'],
    [1, 'visual-model', 'RETEACH', 'worked-example'],
    [2, 'visual-model', 'REVEAL', 'worked-example'],
    [3, 'worked-example', 'SWITCH', 'prerequisite-step'],
  ] as const)('changes the approach across wrong attempts', (wrong, previous, kind, approach) => {
    const result = policy(context(wrong, previous), EVENT);
    expect(result.defaultPlan).toMatchObject({ kind, approach });
  });

  it.each([
    [{ ...EVENT, kind: 'PAUSE' }, 'BREAK'],
    [{ ...EVENT, kind: 'LEAVE', reason: 'done' }, 'END'],
  ] as const)('handles explicit stopping conditions', (event, kind) => {
    expect(policy(context(0, null), tutorInputEventSchema.parse(event)).defaultPlan.kind).toBe(
      kind,
    );
  });

  it('ends at the configured band limit', () => {
    const limited = createTeachingPolicy<null>({
      gradeAnswer: () => ({ correct: false, misconception: null }),
      sessionLimitMs: () => 1,
      now: () => new Date('2026-08-24T20:00:00.000Z'),
    });
    expect(limited(context(0, null), EVENT).defaultPlan.kind).toBe('END');
  });

  it('acknowledges an open response without pretending it was graded', () => {
    const openResponse = createTeachingPolicy<null>({
      gradeAnswer: () => null,
      sessionLimitMs: () => 20 * 60_000,
      now: () => new Date('2026-08-24T20:00:00.000Z'),
    })(context(0, null), EVENT);
    expect(openResponse).toMatchObject({
      graded: null,
      defaultPlan: { kind: 'PRAISE', approach: 'completion-evidence' },
    });
  });

  it('uses the recorded fix when the same misconception returns in a later session', () => {
    const repeated = {
      ...context(0, null),
      session: { ...context(0, null).session, repeatedMisconception: 'counting-restarted' },
    };
    const repeatedPolicy = createTeachingPolicy<null>({
      gradeAnswer: () => ({ correct: false, misconception: 'counting-restarted' }),
      sessionLimitMs: () => 20 * 60_000,
      now: () => new Date('2026-08-24T20:00:00.000Z'),
    });
    expect(repeatedPolicy(repeated, EVENT).defaultPlan).toMatchObject({
      kind: 'RETEACH',
      approach: 'misconception-fix',
    });
  });

  it('reveals after the third same-misconception miss instead of repeating reteach', () => {
    const repeated = {
      ...context(2, 'visual-model'),
      session: {
        ...context(2, 'visual-model').session,
        repeatedMisconception: 'counting-restarted',
        unmetPrerequisite: null,
      },
    };
    const repeatedPolicy = createTeachingPolicy<null>({
      gradeAnswer: () => ({ correct: false, misconception: 'counting-restarted' }),
      sessionLimitMs: () => 20 * 60_000,
      now: () => new Date('2026-08-24T20:00:00.000Z'),
    });
    expect(repeatedPolicy(repeated, EVENT).defaultPlan.kind).toBe('REVEAL');
  });
});
