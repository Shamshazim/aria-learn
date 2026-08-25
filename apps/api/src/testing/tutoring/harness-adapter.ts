import { bandForGrade, sessionIdSchema } from '@aria/shared';
import {
  createTutorHarness,
  type CommittedTurn,
  type MovePlan,
  type TutorPorts,
} from '@aria/tutor';

import { fixedClock } from '@/lib/clock';
import { scrubLearnerContext } from '@/privacy';
import type { ApiModelContext } from '@/services/content/turn-content.service';
import { createTutorService } from '@/services/tutor/tutor.service';
import type { TutorImplementation } from '@/testing/tutoring/replay';
import type { TutoringScenario } from '@/testing/tutoring/scenario';

export function createHarnessTutor(scenario: TutoringScenario): TutorImplementation {
  if (scenario.context.answerOutcomes.length > 0) return createProductionPolicyTutor(scenario);
  const steps = new Map(scenario.steps.map((step) => [step.event.id, step]));
  let committed: CommittedTurn | null = null;
  let tick = 0;
  const harness = createTutorHarness(
    ports(
      scenario,
      steps,
      (turn) => {
        committed = turn;
      },
      () => ++tick,
    ),
  );
  return {
    handle: async (event, control) => {
      const step = requireStep(steps, event.id);
      for (const moveId of step.scripted.stopMoveIds) control.stopMove(moveId);
      const moves = await harness.handle(event);
      return {
        moves,
        evidence: {
          ...step.scripted.evidence,
          ...(committed?.plan.approach === undefined
            ? {}
            : { approachId: committed.plan.approach }),
        },
      };
    },
  };
}

/** The stale-`SILENCE` check compares against the last move Aria delivered (P2H-01). */
function latestMoveId(committed: CommittedTurn | null): string | null {
  return committed?.moves.at(-1)?.id ?? null;
}

function createProductionPolicyTutor(scenario: TutoringScenario): TutorImplementation {
  const steps = new Map(scenario.steps.map((step) => [step.event.id, step]));
  const outcomes = new Map(
    scenario.context.answerOutcomes.map((item) => [item.eventId, item.outcome]),
  );
  let committed: CommittedTurn | null = null;
  let wrong = 0;
  let lastApproach: string | null = null;
  const sessionId = sessionIdSchema.parse('00000000-0000-4000-8000-000000000901');
  const service = createTutorService({
    ports: {
      loadContext: (event) =>
        Promise.resolve(
          productionContext({ scenario, event, sessionId, wrong, lastApproach, outcomes }),
        ),
      resolveContent: ({ event }) => {
        const scripted = requireStep(steps, event.id).scripted;
        return Promise.resolve({ moves: scripted.moves, privateEvidence: scripted.evidence });
      },
      commit: (turn) => {
        committed = turn;
        if (turn.decision.graded?.correct === false) wrong += 1;
        if (turn.decision.graded?.correct === true) wrong = 0;
        lastApproach = turn.plan.approach;
        return Promise.resolve();
      },
    },
    clock: fixedClock(new Date('2026-08-24T20:00:00.000Z')),
    sessionLimitMs: () => 20 * 60_000,
    requireOwnership: () => Promise.resolve(),
    latestMoveId: () => Promise.resolve(latestMoveId(committed)),
    logger: { info: () => undefined },
  });
  return {
    handle: async (event, control) => {
      const step = requireStep(steps, event.id);
      for (const moveId of step.scripted.stopMoveIds) control.stopMove(moveId);
      const moves = await service.handle('golden-student', { ...event, sessionId });
      return {
        moves,
        evidence: {
          ...step.scripted.evidence,
          ...(committed === null ? {} : { approachId: committed.plan.approach }),
        },
      };
    },
  };
}

function productionContext(
  input: Readonly<{
    scenario: TutoringScenario;
    event: TutoringScenario['steps'][number]['event'];
    sessionId: string;
    wrong: number;
    lastApproach: string | null;
    outcomes: ReadonlyMap<string, 'correct' | 'wrong'>;
  }>,
) {
  const { scenario, event, sessionId, wrong, lastApproach, outcomes } = input;
  const answer = event.kind === 'ANSWER' ? (event.text ?? event.choiceId ?? '') : '';
  const answerKey = outcomes.get(event.id) === 'correct' ? answer : '__recorded-correct-answer__';
  return {
    session: {
      id: sessionId,
      studentId: 'golden-student',
      subject: 'golden',
      grade: scenario.grade,
      band: bandForGrade(scenario.grade),
      skillCode: 'ADD.FACT.10',
      startedAt: new Date('2026-08-24T19:55:00.000Z'),
      attempts: wrong,
      consecutiveWrong: wrong,
      consecutiveSilences: 0,
      repeatedMisconception: null,
      lastApproach,
      unmetPrerequisite: null,
    },
    modelContext: {
      scrubbed: scrubLearnerContext({ identifiers: {} }, { pseudonym: 'omit' }),
      answerKey,
      latestQuestion: 'Recorded golden question.',
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

function ports(
  scenario: TutoringScenario,
  steps: ReadonlyMap<string, TutoringScenario['steps'][number]>,
  onCommit: (turn: CommittedTurn) => void,
  nowMs: () => number,
): TutorPorts<null> {
  return {
    loadContext: (event) =>
      Promise.resolve({
        session: {
          id: event.sessionId ?? `golden-${scenario.id}`,
          studentId: 'golden-student',
          subject: 'golden',
          grade: scenario.grade,
          band: bandForGrade(scenario.grade),
          skillCode: null,
          startedAt: new Date('2026-08-24T20:00:00.000Z'),
          attempts: 0,
          consecutiveWrong: 0,
          consecutiveSilences: 0,
          repeatedMisconception: null,
          lastApproach: null,
          unmetPrerequisite: null,
        },
        modelContext: null,
        recentKinds: [],
      }),
    applyPolicy: (_context, event) => {
      const step = requireStep(steps, event.id);
      const fallback = plan(step, event.id);
      const outcome = scenario.context.answerOutcomes.find((item) => item.eventId === event.id);
      return Promise.resolve({
        allowedMoves: [fallback.kind],
        defaultPlan: fallback,
        graded:
          outcome === undefined
            ? null
            : { correct: outcome.outcome === 'correct', misconception: null },
        terminal: event.kind === 'LEAVE' || event.kind === 'PAUSE',
      });
    },
    planMove: ({ fallback }) => Promise.resolve(fallback),
    resolveContent: ({ event }) => {
      const scripted = requireStep(steps, event.id).scripted;
      return Promise.resolve({ moves: scripted.moves, privateEvidence: scripted.evidence });
    },
    commit: (turn) => {
      onCommit(turn);
      return Promise.resolve();
    },
    emit: (moves) => Promise.resolve(moves),
    nowMs,
  };
}

function plan(step: TutoringScenario['steps'][number], eventId: string): MovePlan {
  const first = step.scripted.moves[0];
  return {
    kind: first?.kind ?? 'SAY',
    approach: step.scripted.evidence.approachId ?? `policy-${eventId}`,
    reason: 'Golden recorded-response plan.',
    skillCode: null,
    attempt: 1,
  };
}

function requireStep(
  steps: ReadonlyMap<string, TutoringScenario['steps'][number]>,
  eventId: string,
): TutoringScenario['steps'][number] {
  const step = steps.get(eventId);
  if (step === undefined) throw new Error(`No golden step for ${eventId}`);
  return step;
}
