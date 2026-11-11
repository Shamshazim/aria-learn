import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION, tutorInputEventSchema } from '@aria/shared';

import { createTeachingPolicy } from './teaching-policy';

import type { Intent } from '../intent/intent.types';
import type { LoadedTurnContext } from '../types';

const AT = '2026-11-10T20:00:00.000Z';

const context: LoadedTurnContext<null> = {
  session: {
    id: 'session-1',
    studentId: 'student-1',
    subject: 'reading',
    grade: '2',
    band: 'early',
    skillCode: 'RD.CVC',
    startedAt: new Date('2026-11-10T19:58:00.000Z'),
    attempts: 0,
    consecutiveWrong: 0,
    consecutiveSilences: 0,
    consecutiveStuck: 0,
    correctStreak: 0,
    repeatedMisconception: null,
    lastApproach: null,
    unmetPrerequisite: null,
    nextTopic: null,
  },
  modelContext: null,
  recentKinds: [],
};

function policy(intent: Intent) {
  return createTeachingPolicy<null>({
    gradeAnswer: () => ({ correct: false, misconception: null }),
    classifyIntent: () => intent,
    sessionLimitMs: () => 20 * 60_000,
    now: () => new Date(AT),
  });
}

const said = (text: string) =>
  tutorInputEventSchema.parse({
    id: 'event-1',
    at: AT,
    protocolVersion: PROTOCOL_VERSION,
    kind: 'SPEECH_FINAL',
    text,
    confidence: 0.95,
  });

describe('self-correction in the turn (P3-06)', () => {
  it.each(['ANSWER', 'CHAT', 'QUESTION'] as const)(
    'acknowledges "I don\'t like trucks anymore" (%s), ungraded and without a planner',
    (intent) => {
      const decision = policy(intent)(context, said("I don't like trucks anymore"));
      expect(decision.graded).toBeNull();
      expect(decision.decisive).toBe(true);
      expect(decision.defaultPlan).toMatchObject({
        kind: 'SAY',
        approach: 'acknowledge-correction',
        evidence: { selfCorrection: 'stopped_liking', selfCorrectionThing: 'trucks' },
      });
    },
  );

  it('lets a stop be a stop, even with a correction in it', () => {
    const decision = policy('STOP_REQUEST')(context, said("I don't like maths anymore, stop"));
    expect(decision.reasons).toContain('stop_request');
  });
});
