import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION, tutorInputEventSchema, type TutorInputEvent } from '@aria/shared';

import { planMove } from './plan-move';

import type {
  LoadedTurnContext,
  MovePlan,
  PlannerObservation,
  PolicyDecision,
  TutorPorts,
} from '../types';

const EVENT = tutorInputEventSchema.parse({
  id: 'event-1',
  at: '2026-08-24T20:00:00.000Z',
  protocolVersion: PROTOCOL_VERSION,
  kind: 'ANSWER',
  respondsTo: 'ask-1',
  text: 'five',
}) satisfies TutorInputEvent;

const CONTEXT: LoadedTurnContext<null> = {
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
  },
  modelContext: null,
  recentKinds: [],
};

const DEFAULT_PLAN: MovePlan = {
  kind: 'HINT',
  approach: 'single-nudge',
  reason: 'This is the first incorrect attempt.',
  skillCode: 'ADD.WITHIN_10',
  attempt: 1,
  source: 'policy',
};

const OPEN: PolicyDecision = {
  allowedMoves: ['HINT', 'RETEACH'],
  defaultPlan: DEFAULT_PLAN,
  graded: { correct: false, misconception: null },
  terminal: false,
  decisive: false,
  reasons: ['first_wrong_attempt'],
};

type Recorder = { calls: string[]; observed: PlannerObservation[] };

function ports(
  planner: TutorPorts<null>['planMove'],
  recorder: Recorder,
  budgetMs?: number,
): TutorPorts<null> {
  let now = 0;
  return {
    loadContext: () => Promise.resolve(CONTEXT),
    applyPolicy: () => Promise.resolve(OPEN),
    planMove: (input) => {
      recorder.calls.push(input.event.kind);
      return planner(input);
    },
    ...(budgetMs === undefined ? {} : { plannerBudgetMs: () => budgetMs }),
    observePlan: (observation) => {
      recorder.observed.push(observation);
    },
    resolveContent: () => Promise.resolve({ moves: [], privateEvidence: {} }),
    commit: () => Promise.resolve(),
    emit: (moves) => Promise.resolve(moves),
    nowMs: () => (now += 5),
  };
}

function record(): Recorder {
  return { calls: [], observed: [] };
}

const proposal = (kind: MovePlan['kind'], approach: string, rationale?: string): MovePlan => ({
  ...DEFAULT_PLAN,
  kind,
  approach,
  ...(rationale === undefined ? {} : { rationale }),
});

const run = (decision: PolicyDecision, all: TutorPorts<null>): Promise<MovePlan> =>
  planMove({ ports: all, context: CONTEXT, event: EVENT, decision });

describe('planner inside the allowed set', () => {
  it('uses an allowed proposal and records why', async () => {
    const log = record();
    const plan = await run(
      OPEN,
      ports(
        () => Promise.resolve(proposal('RETEACH', 'visual-model', 'Two wrong the same way.')),
        log,
      ),
    );
    expect(plan).toMatchObject({ kind: 'RETEACH', approach: 'visual-model', source: 'planner' });
    expect(plan.rationale).toBe('Two wrong the same way.');
    expect(plan.evidence).toMatchObject({
      plannerAllowed: 'HINT,RETEACH',
      plannerProposed: 'RETEACH:visual-model',
      plannerAccepted: true,
      plannerSource: 'planner',
    });
    expect(log.observed[0]).toMatchObject({ accepted: true, source: 'planner' });
  });

  it.each([
    ['a move outside the set', proposal('PRAISE', 'default'), 'not_allowed'],
    [
      'an approach nobody wrote a prompt for',
      proposal('RETEACH', 'interpretive-dance'),
      'unknown_approach',
    ],
  ] as const)('overrules %s', async (_name, proposed, reason) => {
    const log = record();
    const plan = await run(
      OPEN,
      ports(() => Promise.resolve(proposed), log),
    );
    expect(plan).toMatchObject({
      kind: 'HINT',
      approach: 'single-nudge',
      source: 'planner-rejected',
    });
    expect(plan.evidence).toMatchObject({ plannerAccepted: false, plannerReason: reason });
  });

  it('stops waiting at the band budget', async () => {
    const log = record();
    const plan = await run(
      OPEN,
      ports(
        () =>
          new Promise<MovePlan>((resolve) => {
            setTimeout(() => {
              resolve(proposal('RETEACH', 'visual-model'));
            }, 200);
          }),
        log,
        5,
      ),
    );
    expect(plan).toMatchObject({ kind: 'HINT', source: 'policy' });
    expect(plan.evidence).toMatchObject({
      plannerReason: 'planner_timeout',
      plannerProposed: 'none',
    });
  });

  it('falls back the moment the provider fails, without waiting', async () => {
    const log = record();
    const plan = await run(
      OPEN,
      ports(() => Promise.reject(new Error('breaker open')), log),
    );
    expect(plan).toMatchObject({ kind: 'HINT', source: 'policy' });
    expect(plan.evidence).toMatchObject({ plannerReason: 'planner_error' });
  });

  it.each([
    [
      'the policy is decisive',
      { ...OPEN, decisive: true, reasons: ['stop_request'] },
      'policy_decisive',
    ],
    [
      'only one move is allowed',
      { ...OPEN, allowedMoves: ['HINT'] as const },
      'single_allowed_move',
    ],
  ] as const)('never asks when %s', async (_name, decision, reason) => {
    const log = record();
    const plan = await run(
      decision,
      ports(() => Promise.resolve(proposal('RETEACH', 'visual-model')), log),
    );
    expect(log.calls).toEqual([]);
    expect(plan).toMatchObject({ kind: 'HINT', source: 'policy' });
    expect(plan.evidence).toMatchObject({ plannerReason: reason, plannerAccepted: false });
  });

  it('keeps the policy evidence a proposal never sees', async () => {
    const log = record();
    const decision: PolicyDecision = {
      ...OPEN,
      defaultPlan: { ...DEFAULT_PLAN, evidence: { silenceRung: 1 } },
    };
    const plan = await run(
      decision,
      ports(() => Promise.resolve(proposal('RETEACH', 'visual-model')), log),
    );
    expect(plan.evidence).toMatchObject({ silenceRung: 1, plannerAccepted: true });
  });
});
