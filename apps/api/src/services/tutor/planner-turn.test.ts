import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION, sessionIdSchema, tutorInputEventSchema } from '@aria/shared';
import type { CommittedTurn, MovePlan, TutorPorts } from '@aria/tutor';

import { createIntentClassifier } from '@/ai/intent/model-intent.classifier';
import { fixedClock } from '@/lib/clock';
import { scrubLearnerContext } from '@/privacy';
import type { ApiModelContext } from '@/services/content/turn-content.service';
import { createTutorService } from '@/services/tutor/tutor.service';

const NOW = new Date('2026-08-25T10:00:00.000Z');
const SESSION_ID = sessionIdSchema.parse('00000000-0000-4000-8000-000000000601');

const WRONG_ANSWER = tutorInputEventSchema.parse({
  id: 'event-1',
  at: NOW.toISOString(),
  protocolVersion: PROTOCOL_VERSION,
  sessionId: SESSION_ID,
  kind: 'ANSWER',
  respondsTo: 'ask-1',
  text: 'five',
});

type Planner = TutorPorts<ApiModelContext>['planMove'];

function proposing(kind: MovePlan['kind'], approach: string): Planner {
  return ({ fallback }) =>
    Promise.resolve({ ...fallback, kind, approach, rationale: 'Because of what they said.' });
}

async function runTurn(planner: Planner, budgetMs?: number): Promise<CommittedTurn> {
  const committed: CommittedTurn[] = [];
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
    logger: { info: () => undefined },
    intent: createIntentClassifier({ ai: null }),
    planner,
    ...(budgetMs === undefined ? {} : { plannerBudgetMs: () => budgetMs }),
  });
  await service.handle('student-1', WRONG_ANSWER);
  const turn = committed.at(-1);
  if (turn === undefined) throw new Error('the turn never committed');
  return turn;
}

function context() {
  return {
    session: {
      id: SESSION_ID,
      studentId: 'student-1',
      subject: 'math',
      grade: '4' as const,
      band: 'middle' as const,
      skillCode: 'ADD.WITHIN_10',
      startedAt: new Date('2026-08-25T09:55:00.000Z'),
      attempts: 0,
      consecutiveWrong: 0,
      consecutiveSilences: 0,
      repeatedMisconception: null,
      lastApproach: null,
      unmetPrerequisite: null,
    },
    modelContext: {
      scrubbed: scrubLearnerContext(
        { identifiers: {}, gradeBand: 'middle' },
        { pseudonym: 'omit' },
      ),
      answerKey: 'seven',
      latestQuestion: 'What is four plus three?',
      estimatedTokens: 0,
      retrievedFactIds: [],
      recentContentItemIds: [],
      arithmeticProblem: null,
      completionOnly: false,
      latestAsk: null,
    } satisfies ApiModelContext,
    recentKinds: [],
  };
}

describe('a turn with a planner in it', () => {
  it('uses the injected planner instead of always taking the policy default', async () => {
    const turn = await runTurn(proposing('RETEACH', 'concrete-story'));
    expect(turn.plan).toMatchObject({
      kind: 'RETEACH',
      approach: 'concrete-story',
      source: 'planner',
    });
    expect(turn.decision.allowedMoves).toEqual(['HINT', 'RETEACH']);
  });

  it('records the set, the proposal and the verdict on every turn', async () => {
    const turn = await runTurn(proposing('RETEACH', 'concrete-story'));
    expect(turn.plan.evidence).toMatchObject({
      plannerAllowed: 'HINT,RETEACH',
      plannerProposed: 'RETEACH:concrete-story',
      plannerAccepted: true,
      plannerSource: 'planner',
      policyReasons: 'first_wrong_attempt',
    });
  });

  it('overrules praise for a wrong answer', async () => {
    const turn = await runTurn(proposing('PRAISE', 'default'));
    expect(turn.plan).toMatchObject({ kind: 'HINT', source: 'planner-rejected' });
    expect(turn.plan.evidence).toMatchObject({ plannerReason: 'not_allowed' });
  });

  it('does not wait past the band budget', async () => {
    const turn = await runTurn(() => new Promise<MovePlan>(() => undefined), 5);
    expect(turn.plan).toMatchObject({ kind: 'HINT', source: 'policy' });
    expect(turn.plan.evidence).toMatchObject({ plannerReason: 'planner_timeout' });
  });
});
