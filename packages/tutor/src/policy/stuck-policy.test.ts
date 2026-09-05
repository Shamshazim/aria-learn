import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION, tutorInputEventSchema, type TutorInputEvent } from '@aria/shared';

import { createTeachingPolicy } from './teaching-policy';

import type { LoadedTurnContext } from '../types';

/**
 * The ladder a stuck child climbs, and the exits from it: a skip, and a run of right answers
 * that finishes the topic. Kept apart from the rest of the policy tests because this is the
 * behaviour that was missing — a shrug used to earn a reteach forever.
 */
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
      consecutiveSilences: 0,
      consecutiveStuck: wrong,
      correctStreak: 0,
      repeatedMisconception: null,
      lastApproach,
      unmetPrerequisite: 'ADD.WITHIN_10',
      nextTopic: null,
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

describe('a child who is stuck or wants to move on', () => {
  const confused = createTeachingPolicy<null>({
    gradeAnswer: () => ({ correct: false, misconception: null }),
    classifyIntent: () => 'CONFUSED',
    sessionLimitMs: () => 20 * 60_000,
    now: () => new Date('2026-08-24T20:00:00.000Z'),
  });
  const stuck = (count: number, lastApproach: string | null = null) => {
    const base = context(0, lastApproach);
    return { ...base, session: { ...base.session, consecutiveStuck: count } };
  };

  it.each([
    [0, 'HINT', 'single-nudge'],
    [1, 'RETEACH', 'visual-model'],
    [2, 'REVEAL', 'move-on'],
    [5, 'REVEAL', 'move-on'],
  ] as const)('climbs the ladder on "I don\'t know" number %i', (count, kind, approach) => {
    const decision = confused(stuck(count), EVENT);
    expect(decision.defaultPlan).toMatchObject({ kind, approach });
    expect(decision.graded).toBeNull();
    expect(decision.decisive).toBe(kind === 'REVEAL');
  });

  it('treats the "I don\'t get it" button the same as saying it', () => {
    const button = tutorInputEventSchema.parse({
      ...EVENT,
      kind: 'CONFUSED',
      aboutMoveId: 'ask-1',
    });
    expect(policy(stuck(2), button).defaultPlan).toMatchObject({
      kind: 'REVEAL',
      approach: 'move-on',
    });
  });

  it('counts wrong answers and shrugs on one item together, and starts over on a fresh item', () => {
    const oneWrongOneShrug = {
      ...stuck(2),
      session: { ...stuck(2).session, consecutiveWrong: 1 },
    };
    expect(policy(oneWrongOneShrug, EVENT).defaultPlan).toMatchObject({ kind: 'REVEAL' });
    const freshItem = { ...stuck(0), session: { ...stuck(0).session, consecutiveWrong: 4 } };
    expect(policy(freshItem, EVENT).defaultPlan).toMatchObject({ kind: 'HINT' });
  });

  it('honours a skip at once, from the words or the button', () => {
    const asked = createTeachingPolicy<null>({
      gradeAnswer: () => ({ correct: false, misconception: null }),
      classifyIntent: () => 'SKIP_REQUEST',
      sessionLimitMs: () => 20 * 60_000,
      now: () => new Date('2026-08-24T20:00:00.000Z'),
    })(context(0, null), EVENT);
    expect(asked.defaultPlan).toMatchObject({
      kind: 'REVEAL',
      approach: 'move-on',
      evidence: { intent: 'SKIP_REQUEST' },
    });
    expect(asked).toMatchObject({ decisive: true, allowedMoves: ['REVEAL'] });
    const button = tutorInputEventSchema.parse({
      ...EVENT,
      kind: 'SKIP',
      respondsTo: 'ask-1',
      reason: 'not_engaging',
    });
    expect(policy(context(0, null), button)).toMatchObject({
      defaultPlan: { kind: 'REVEAL', approach: 'move-on' },
      reasons: ['skip_not_engaging'],
    });
  });

  it('goes to the next topic when the child says it is too easy and there is one', () => {
    const withNext = {
      ...stuck(0),
      session: { ...stuck(0).session, nextTopic: 'ADD.WITHIN_20' },
    };
    const tooEasy = tutorInputEventSchema.parse({ ...EVENT, kind: 'SKIP', reason: 'too_easy' });
    expect(policy(withNext, tooEasy).defaultPlan).toMatchObject({
      kind: 'SWITCH',
      approach: 'next-topic',
      skillCode: 'ADD.WITHIN_20',
    });
    expect(policy(stuck(0), tooEasy).defaultPlan.kind).toBe('REVEAL');
  });

  it('moves to the next topic after three right in a row, and praises before that', () => {
    const right = createTeachingPolicy<null>({
      gradeAnswer: () => ({ correct: true, misconception: null }),
      sessionLimitMs: () => 20 * 60_000,
      now: () => new Date('2026-08-24T20:00:00.000Z'),
    });
    const streak = (count: number, nextTopic: string | null) => {
      const base = context(0, null);
      return { ...base, session: { ...base.session, correctStreak: count, nextTopic } };
    };
    expect(right(streak(1, 'ADD.WITHIN_20'), EVENT).defaultPlan.kind).toBe('PRAISE');
    expect(right(streak(2, null), EVENT).defaultPlan.kind).toBe('PRAISE');
    const done = right(streak(2, 'ADD.WITHIN_20'), EVENT);
    expect(done.defaultPlan).toMatchObject({
      kind: 'SWITCH',
      approach: 'next-topic',
      skillCode: 'ADD.WITHIN_20',
    });
    expect(done.graded).toMatchObject({ correct: true });
    expect(done.decisive).toBe(true);
  });
});
