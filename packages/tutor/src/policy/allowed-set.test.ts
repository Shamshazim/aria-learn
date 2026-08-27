import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION, tutorInputEventSchema, type TutorInputEvent } from '@aria/shared';

import { createTeachingPolicy, type IntentClassifier } from './teaching-policy';

import type { Intent } from '../intent/intent.types';
import type { LoadedTurnContext } from '../types';

const NOW = new Date('2026-08-24T20:00:00.000Z');

type Session = LoadedTurnContext<null>['session'];

function context(overrides: Partial<Session> = {}): LoadedTurnContext<null> {
  return {
    session: {
      id: 'session-1',
      studentId: 'student-1',
      subject: 'math',
      grade: '4',
      band: 'middle',
      skillCode: 'ADD.WITHIN_10',
      startedAt: new Date('2026-08-24T19:55:00.000Z'),
      attempts: 0,
      consecutiveWrong: 0,
      consecutiveSilences: 0,
      repeatedMisconception: null,
      lastApproach: null,
      unmetPrerequisite: null,
      ...overrides,
    },
    modelContext: null,
    recentKinds: [],
  };
}

function policyFor(input: { correct: boolean; intent?: Intent; misconception?: string }) {
  const classify: IntentClassifier | undefined =
    input.intent === undefined ? undefined : () => input.intent ?? null;
  return createTeachingPolicy<null>({
    gradeAnswer: () => ({
      correct: input.correct,
      misconception: input.misconception ?? null,
    }),
    ...(classify === undefined ? {} : { classifyIntent: classify }),
    sessionLimitMs: () => 20 * 60_000,
    now: () => NOW,
  });
}

const ANSWER = tutorInputEventSchema.parse({
  id: 'event-1',
  at: '2026-08-24T20:00:00.000Z',
  protocolVersion: PROTOCOL_VERSION,
  kind: 'ANSWER',
  respondsTo: 'ask-1',
  text: 'five',
}) satisfies TutorInputEvent;

const event = (kind: TutorInputEvent['kind']): TutorInputEvent =>
  tutorInputEventSchema.parse({
    id: `event-${kind}`,
    at: '2026-08-24T20:00:00.000Z',
    protocolVersion: PROTOCOL_VERSION,
    kind,
    ...(kind === 'LEAVE' ? { reason: 'done' } : {}),
    ...(kind === 'SILENCE' ? { waitedMs: 12_000 } : {}),
  });

describe('the set a planner may choose from', () => {
  it.each([
    ['a first wrong answer', {}, ['HINT', 'RETEACH']],
    [
      'a wrong answer with a prerequisite to fall back on',
      { unmetPrerequisite: 'ADD.TO_5' },
      ['HINT', 'RETEACH', 'SWITCH'],
    ],
    ['a third wrong answer', { consecutiveWrong: 2 }, ['HINT', 'RETEACH', 'REVEAL']],
  ] as const)('widens on %s', (_name, session, expected) => {
    const decision = policyFor({ correct: false })(context(session), ANSWER);
    expect(decision.allowedMoves).toEqual(expected);
    expect(decision.decisive).toBe(false);
    expect(decision.allowedMoves.length).toBeGreaterThan(1);
  });

  it.each([
    ['QUESTION', ['SAY', 'SHOW', 'ASK']],
    ['CHAT', ['SAY', 'ASK']],
    ['CONFUSED', ['RETEACH', 'SHOW']],
  ] as const)('answers intent %s from more than one move', (intent, expected) => {
    const decision = policyFor({ correct: false, intent })(context(), ANSWER);
    expect(decision.allowedMoves).toEqual(expected);
    expect(decision.decisive).toBe(false);
  });

  it.each([
    [0, ['SAY', 'HINT'], false],
    [1, ['SAY', 'HINT'], false],
    [2, ['SAY'], true],
    [3, ['BREAK'], true],
  ] as const)('follows the silence ladder after %i silences', (silences, expected, decisive) => {
    const decision = policyFor({ correct: false })(
      context({ consecutiveSilences: silences }),
      event('SILENCE'),
    );
    expect(decision.allowedMoves).toEqual(expected);
    expect(decision.decisive).toBe(decisive);
  });

  it('never offers PRAISE for a wrong answer, or REVEAL on the first attempt', () => {
    const decision = policyFor({ correct: false })(context(), ANSWER);
    expect(decision.allowedMoves).not.toContain('PRAISE');
    expect(decision.allowedMoves).not.toContain('REVEAL');
  });

  it('never offers a hint or a reteach once the answer was right', () => {
    const decision = policyFor({ correct: true })(context(), ANSWER);
    expect(decision.allowedMoves).toEqual(['PRAISE']);
  });

  it.each([
    [
      'a repeated misconception',
      () =>
        policyFor({ correct: false, misconception: 'counting-restarted' })(
          context({ repeatedMisconception: 'counting-restarted' }),
          ANSWER,
        ),
      'RETEACH',
    ],
    [
      'a stop request',
      () => policyFor({ correct: false, intent: 'STOP_REQUEST' })(context(), ANSWER),
      'BREAK',
    ],
    [
      'personal information',
      () => policyFor({ correct: false, intent: 'PERSONAL_INFO' })(context(), ANSWER),
      'SAY',
    ],
    ['a child who left', () => policyFor({ correct: false })(context(), event('LEAVE')), 'END'],
  ] as const)('decides %s without a planner', (_name, run, kind) => {
    const decision = run();
    expect(decision.decisive).toBe(true);
    expect(decision.allowedMoves).toEqual([kind]);
  });

  it('decides the session limit without a planner', () => {
    const limited = createTeachingPolicy<null>({
      gradeAnswer: () => ({ correct: false, misconception: null }),
      sessionLimitMs: () => 60_000,
      now: () => NOW,
    });
    const decision = limited(context(), ANSWER);
    expect(decision).toMatchObject({ decisive: true, terminal: true, reasons: ['session_limit'] });
    expect(decision.allowedMoves).toEqual(['END']);
  });
});
