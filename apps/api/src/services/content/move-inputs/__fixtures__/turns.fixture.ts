import { PROTOCOL_VERSION, tutorInputEventSchema, type MoveKind } from '@aria/shared';
import type { PlannedTurn } from '@aria/tutor';

import { scrubLearnerContext } from '@/privacy';
import type { ApiModelContext } from '@/services/content/turn-content.types';
import type { SessionRecap } from '@/services/session/recap.types';

/**
 * The turns the five moves that make claims are built from (P2H-11).
 *
 * Whole objects rather than casts: the point of these tests is that a move only says what the
 * turn can prove, and a partial turn would let a builder read a field the real one never has.
 */
export const NOW = new Date('2026-08-25T10:00:00.000Z');

export function recap(): SessionRecap {
  return {
    skills: [{ code: 'ADD.REGROUP.2D', name: 'Add two-digit numbers with regrouping' }],
    attempted: 4,
    correct: 3,
    finalStreak: 2,
    moment: {
      kind: 'after-reteach',
      skillCode: 'ADD.REGROUP.2D',
      skillName: 'Add two-digit numbers with regrouping',
    },
  };
}

export function spokenTurn(confidence: number): PlannedTurn<ApiModelContext> {
  const base = praiseTurn([]);
  return {
    ...base,
    event: tutorInputEventSchema.parse({
      id: 'event-2',
      at: NOW.toISOString(),
      protocolVersion: PROTOCOL_VERSION,
      kind: 'SPEECH_FINAL',
      sessionId: '00000000-0000-4000-8000-000000000001',
      text: 'forty two',
      confidence,
    }),
  };
}

export function endTurn(): PlannedTurn<ApiModelContext> {
  const base = praiseTurn([]);
  return { ...base, plan: { ...base.plan, kind: 'END' } };
}

export function praiseTurn(
  strategies: readonly string[],
  elapsedMs = 4_000,
  said = '42',
): PlannedTurn<ApiModelContext> {
  const event = tutorInputEventSchema.parse({
    id: 'event-1',
    at: NOW.toISOString(),
    protocolVersion: PROTOCOL_VERSION,
    kind: 'ANSWER',
    sessionId: '00000000-0000-4000-8000-000000000001',
    respondsTo: 'move-1',
    text: said,
    elapsedMs,
  });
  const plan = {
    kind: 'PRAISE' as MoveKind,
    approach: 'default',
    reason: 'test',
    skillCode: 'ADD.REGROUP.2D',
    attempt: 1,
  };
  return {
    event,
    plan,
    decision: {
      allowedMoves: ['PRAISE'],
      graded: { correct: true, misconception: null, strategies },
      terminal: false,
      decisive: true,
      reasons: [],
      defaultPlan: plan,
    },
    context: { recentKinds: [], session: session(), modelContext: modelContext() },
  };
}

function session(): PlannedTurn<ApiModelContext>['context']['session'] {
  return {
    id: 'session-1',
    studentId: 'student-1',
    subject: 'math',
    grade: '4',
    band: 'middle',
    skillCode: 'ADD.REGROUP.2D',
    startedAt: NOW,
    attempts: 1,
    consecutiveWrong: 0,
    consecutiveSilences: 0,
    repeatedMisconception: null,
    lastApproach: null,
    unmetPrerequisite: null,
  };
}

function modelContext(): ApiModelContext {
  return {
    scrubbed: scrubLearnerContext({ identifiers: {}, gradeBand: 'middle' }, { pseudonym: 'omit' }),
    answerKey: '42',
    latestQuestion: 'What is 27 plus 15?',
    estimatedTokens: 0,
    retrievedFactIds: [],
    recentContentItemIds: [],
    recentIntents: [],
    arithmeticProblem: null,
    lesson: null,
    completionOnly: false,
    latestAsk: null,
  };
}
