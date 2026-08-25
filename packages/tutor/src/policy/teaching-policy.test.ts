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
      consecutiveSilences: 0,
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
  it('never praises or reteaches from a low-confidence spoken transcript', () => {
    const voicePolicy = createTeachingPolicy<null>({
      gradeAnswer: () => ({ correct: true, misconception: null }),
      sessionLimitMs: () => 20 * 60_000,
      now: () => new Date('2026-08-24T20:00:00Z'),
    });
    const event = tutorInputEventSchema.parse({
      id: 'voice-event',
      at: '2026-08-24T20:00:00.000Z',
      protocolVersion: PROTOCOL_VERSION,
      kind: 'SPEECH_FINAL',
      text: 'seven',
      confidence: 0.4,
    });
    const decision = voicePolicy(context(0, null), event);
    expect(decision.defaultPlan).toMatchObject({ kind: 'SAY', approach: 'confirm-spoken-answer' });
    expect(decision.graded).toBeNull();
  });
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

  it('grades a spoken answer whose provider reports no confidence', () => {
    const event = tutorInputEventSchema.parse({
      id: 'voice-event-2',
      at: '2026-08-24T20:00:00.000Z',
      protocolVersion: PROTOCOL_VERSION,
      kind: 'SPEECH_FINAL',
      text: 'six',
    });
    expect(policy(context(0, null), event).graded).not.toBeNull();
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

  it('answers a question or chat without grading it, then returns to the item', () => {
    const intentPolicy = createTeachingPolicy<null>({
      gradeAnswer: () => ({ correct: false, misconception: null }),
      classifyIntent: (event) =>
        event.kind === 'ANSWER' && event.text === 'I have a cat' ? 'CHAT' : 'QUESTION',
      sessionLimitMs: () => 20 * 60_000,
      now: () => new Date('2026-08-24T20:00:00.000Z'),
    });
    const chat = intentPolicy(context(0, null), { ...EVENT, text: 'I have a cat' });
    expect(chat.defaultPlan).toMatchObject({ kind: 'SAY', approach: 'acknowledge-chat' });
    expect(chat.graded).toBeNull();
    const question = intentPolicy(context(0, null), { ...EVENT, text: 'why do we add?' });
    expect(question.defaultPlan).toMatchObject({ kind: 'SAY', approach: 'answer-question' });
  });

  it('ends the session when the child asks to stop', () => {
    const stopPolicy = createTeachingPolicy<null>({
      gradeAnswer: () => ({ correct: false, misconception: null }),
      classifyIntent: () => 'STOP_REQUEST',
      sessionLimitMs: () => 20 * 60_000,
      now: () => new Date('2026-08-24T20:00:00.000Z'),
    });
    const result = stopPolicy(context(0, null), EVENT);
    expect(result.defaultPlan.kind).toBe('BREAK');
    expect(result.terminal).toBe(true);
  });

  it('escalates silence through the ladder and never repeats LISTEN', () => {
    const silence = tutorInputEventSchema.parse({
      id: 'silence-1',
      at: '2026-08-24T20:00:00.000Z',
      protocolVersion: PROTOCOL_VERSION,
      kind: 'SILENCE',
      waitedMs: 18_000,
    });
    const kinds = [0, 1, 2, 3].map((count) => {
      const base = context(0, null);
      const quiet = { ...base, session: { ...base.session, consecutiveSilences: count } };
      return policy(quiet, silence);
    });
    expect(kinds.map((decision) => decision.defaultPlan.kind)).toEqual([
      'SAY',
      'HINT',
      'SAY',
      'BREAK',
    ]);
    expect(kinds.map((decision) => decision.terminal)).toEqual([false, false, false, true]);
    expect(kinds.every((decision) => !decision.allowedMoves.includes('LISTEN'))).toBe(true);
  });
});
