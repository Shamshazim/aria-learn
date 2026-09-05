import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION, sessionIdSchema, tutorInputEventSchema } from '@aria/shared';
import type { CommittedTurn } from '@aria/tutor';

import type { AnswerJudge } from '@/ai/grader/model-grader';
import { createIntentClassifier } from '@/ai/intent/model-intent.classifier';
import { fixedClock } from '@/lib/clock';
import { scrubLearnerContext } from '@/privacy';
import type { ApiModelContext } from '@/services/content/turn-content.service';
import { createTutorService } from '@/services/tutor/tutor.service';

const NOW = new Date('2026-08-28T10:00:00.000Z');
const SESSION_ID = sessionIdSchema.parse('00000000-0000-4000-8000-000000000701');

function answer(text: string) {
  return tutorInputEventSchema.parse({
    id: 'event-1',
    at: NOW.toISOString(),
    protocolVersion: PROTOCOL_VERSION,
    sessionId: SESSION_ID,
    kind: 'ANSWER',
    respondsTo: 'ask-1',
    text,
  });
}

async function runTurn(
  text: string,
  judge: AnswerJudge | undefined,
): Promise<{ turn: CommittedTurn; asked: Parameters<AnswerJudge>[0][] }> {
  const committed: CommittedTurn[] = [];
  const asked: Parameters<AnswerJudge>[0][] = [];
  const service = createTutorService({
    ports: {
      loadContext: () => Promise.resolve(context()),
      resolveContent: (turn) =>
        Promise.resolve({ moves: [], privateEvidence: { plan: turn.plan.kind } }),
      commit: (turn) => {
        committed.push(turn);
        return Promise.resolve();
      },
    },
    clock: fixedClock(NOW),
    sessionLimitMs: () => 20 * 60_000,
    requireOwnership: () => Promise.resolve(),
    latestMoveId: () => Promise.resolve(null),
    resyncAnswer: () => Promise.resolve(null),
    logger: { info: () => undefined },
    intent: createIntentClassifier({ ai: null }),
    planner: ({ fallback }) => Promise.resolve(fallback),
    ...(judge === undefined
      ? {}
      : {
          judge: (input: Parameters<AnswerJudge>[0]) => {
            asked.push(input);
            return judge(input);
          },
        }),
  });
  await service.handle('student-1', answer(text));
  const turn = committed.at(-1);
  if (turn === undefined) throw new Error('the turn never committed');
  return { turn, asked };
}

function context() {
  return {
    session: {
      id: SESSION_ID,
      studentId: 'student-1',
      subject: 'mathematics',
      grade: '4' as const,
      band: 'middle' as const,
      skillCode: 'MATH.G4.U01.L02.T03',
      startedAt: new Date('2026-08-28T09:55:00.000Z'),
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
    modelContext: {
      scrubbed: scrubLearnerContext(
        { identifiers: {}, gradeBand: 'middle' },
        { pseudonym: 'omit' },
      ),
      answerKey: '470 and 500',
      latestQuestion: 'Round 468 to the nearest ten and to the nearest one hundred.',
      estimatedTokens: 0,
      retrievedFactIds: [],
      recentContentItemIds: [],
      recentIntents: [],
      arithmeticProblem: null,
      lesson: null,
      completionOnly: false,
      latestAsk: null,
    } satisfies ApiModelContext,
    recentKinds: [],
  };
}

describe('grading a spoken answer that misses the key word for word', () => {
  it('is wrong on exact match alone', async () => {
    const { turn } = await runTurn('five hundred and four hundred seventy', undefined);
    expect(turn.decision.graded?.correct).toBe(false);
  });

  it('is right when the judge says the words mean the same', async () => {
    const { turn, asked } = await runTurn('five hundred and four hundred seventy', () =>
      Promise.resolve('correct'),
    );
    expect(turn.decision.graded?.correct).toBe(true);
    expect(asked).toEqual([
      expect.objectContaining({
        expectedAnswer: '470 and 500',
        learnerAnswer: 'five hundred and four hundred seventy',
        studentId: 'student-1',
      }),
    ]);
  });

  it('never asks the judge about an exact match', async () => {
    const { turn, asked } = await runTurn('470 and 500', () => Promise.resolve('incorrect'));
    expect(turn.decision.graded?.correct).toBe(true);
    expect(asked).toEqual([]);
  });

  it('stays with exact match when the judge has no opinion', async () => {
    const { turn } = await runTurn('four hundred', () => Promise.resolve(null));
    expect(turn.decision.graded?.correct).toBe(false);
  });
});
