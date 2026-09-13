import { describe, expect, it } from 'vitest';

import {
  PROTOCOL_VERSION,
  sessionIdSchema,
  tutorInputEventSchema,
  tutorMoveSchema,
  type TutorMove,
} from '@aria/shared';

import { createTutorHarness } from './turn.service';

import type { MovePlan, PolicyDecision, TutorPorts } from './types';

type ModelContext = Readonly<{ safe: true }>;

const SESSION_ID = sessionIdSchema.parse('00000000-0000-4000-8000-000000000001');
const EVENT = tutorInputEventSchema.parse({
  id: 'event-1',
  at: '2026-08-24T20:00:00.000Z',
  protocolVersion: PROTOCOL_VERSION,
  sessionId: SESSION_ID,
  kind: 'ANSWER',
  respondsTo: 'ask-1',
  text: '6',
});

const FALLBACK: MovePlan = {
  kind: 'HINT',
  approach: 'single-nudge',
  reason: 'first wrong answer',
  skillCode: 'ADD.WITHIN_10',
  attempt: 1,
};

// A first wrong answer is exactly the situation the planner exists for: more than one move
// is defensible, and none of them is forced (P2H-06).
const DECISION: PolicyDecision = {
  allowedMoves: ['HINT', 'RETEACH'],
  defaultPlan: FALLBACK,
  graded: { correct: false, misconception: null },
  terminal: false,
  decisive: false,
  reasons: ['first_wrong_attempt'],
};

function hint(): TutorMove {
  return tutorMoveSchema.parse({
    id: 'move-1',
    at: '2026-08-24T20:00:01.000Z',
    protocolVersion: PROTOCOL_VERSION,
    sessionId: SESSION_ID,
    kind: 'HINT',
    speech: { text: 'Start at four and count on three.' },
    display: [],
    expects: 'none',
    attempt: 1,
  });
}

function ports(log: string[], proposed: MovePlan = FALLBACK): TutorPorts<ModelContext> {
  let now = 0;
  return {
    loadContext: () => {
      log.push('load');
      return Promise.resolve({
        session: {
          id: SESSION_ID,
          studentId: 'student-1',
          subject: 'math',
          grade: '4' as const,
          band: 'middle' as const,
          skillCode: 'ADD.WITHIN_10',
          startedAt: new Date('2026-08-24T19:55:00.000Z'),
          attempts: 0,
          consecutiveWrong: 0,
          consecutiveSilences: 0,
          consecutiveStuck: 0,
          correctStreak: 0,
          nextTopic: null,
          repeatedMisconception: null,
          lastApproach: null,
          unmetPrerequisite: null,
        },
        modelContext: { safe: true as const },
        recentKinds: [],
      });
    },
    applyPolicy: () => {
      log.push('policy');
      return Promise.resolve(DECISION);
    },
    planMove: () => {
      log.push('plan');
      return Promise.resolve(proposed);
    },
    resolveContent: (turn) => {
      log.push(`resolve:${turn.plan.kind}`);
      return Promise.resolve({ moves: [hint()], privateEvidence: { answerKey: '7' } });
    },
    commit: () => {
      log.push('commit');
      return Promise.resolve();
    },
    emit: (moves) => {
      log.push('emit');
      return Promise.resolve(moves);
    },
    nowMs: () => ++now,
  };
}

describe('controlled tutor loop', () => {
  it('runs read-only planning before resolve, commit and emit', async () => {
    const log: string[] = [];
    await createTutorHarness(ports(log)).handle(EVENT);
    expect(log).toEqual([
      'load',
      'policy',
      'plan',
      'load',
      'policy',
      'resolve:HINT',
      'commit',
      'emit',
    ]);
  });

  it('rejects a planner move outside the deterministic allow-list', async () => {
    const log: string[] = [];
    const proposed = { ...FALLBACK, kind: 'PRAISE' } satisfies MovePlan;
    await createTutorHarness(ports(log, proposed)).handle(EVENT);
    expect(log).toContain('resolve:HINT');
  });

  it('keeps speculation side-effect-free and replans changed final input', async () => {
    const log: string[] = [];
    const harness = createTutorHarness(ports(log));
    const draft = await harness.speculate(EVENT);
    expect(log).toEqual(['load', 'policy', 'plan']);
    const finalEvent = tutorInputEventSchema.parse({ ...EVENT, text: '7' });
    await harness.finalize(finalEvent, draft);
    expect(log.filter((entry) => entry === 'commit')).toHaveLength(1);
    expect(log.filter((entry) => entry === 'plan')).toHaveLength(2);
  });
});
