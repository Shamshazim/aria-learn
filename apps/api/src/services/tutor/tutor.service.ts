import type { TutorInputEvent, TutorMove } from '@aria/shared';
import {
  createTeachingPolicy,
  createTutorHarness,
  type Intent,
  type LoadedTurnContext,
  type TutorHarness,
  type TutorPorts,
} from '@aria/tutor';

import type { IntentClassifier } from '@/ai/intent/model-intent.classifier';
import { matchMisconception } from '@/curriculum/misconception.matcher';
import type { Clock } from '@/lib/clock';
import type { Logger } from '@/lib/logger';
import { checkArithmetic } from '@/quality/arithmetic';
import type { ApiModelContext } from '@/services/content/turn-content.service';
import { isStaleSilence, type LatestMoveLookup } from '@/services/tutor/stale-silence';

export type TutorService = Readonly<{
  handle(
    studentId: string,
    event: TutorInputEvent,
    signal?: AbortSignal,
  ): Promise<readonly TutorMove[]>;
}>;

export function createTutorService(deps: {
  ports: Omit<TutorPorts<ApiModelContext>, 'applyPolicy' | 'planMove' | 'emit' | 'nowMs'>;
  clock: Clock;
  sessionLimitMs(band: 'early' | 'middle' | 'senior'): number;
  requireOwnership(studentId: string, sessionId: string): Promise<void>;
  latestMoveId: LatestMoveLookup;
  logger: Pick<Logger, 'info'>;
  intent: IntentClassifier;
  /** The planner (P2H-06). It proposes; `@aria/tutor` decides whether the proposal survives. */
  planner: TutorPorts<ApiModelContext>['planMove'];
  plannerBudgetMs?: TutorPorts<ApiModelContext>['plannerBudgetMs'];
  observePlan?: TutorPorts<ApiModelContext>['observePlan'];
}): TutorService {
  const harness = buildHarness(deps);
  return {
    handle: async (studentId, event, signal) => {
      if (event.sessionId === undefined) throw new Error('Session turn requires sessionId');
      await deps.requireOwnership(studentId, event.sessionId);
      if (await isStaleSilence(event, deps.latestMoveId, deps.logger)) return [];
      return harness.handle(event, signal);
    },
  };
}

function buildHarness(
  deps: Parameters<typeof createTutorService>[0],
): TutorHarness<ApiModelContext> {
  return createTutorHarness<ApiModelContext>({
    ...deps.ports,
    applyPolicy: async (context, event) => {
      // The intent decides which branch the turn takes, so it is resolved before the policy
      // runs rather than inside it: the model second pass is asynchronous, the policy is pure.
      const intent = await resolveIntent(deps, context, event);
      return createTeachingPolicy<ApiModelContext>({
        gradeAnswer: (answer) => grade(answer, context.modelContext, context.session.skillCode),
        classifyIntent: () => intent,
        sessionLimitMs: (band) => deps.sessionLimitMs(band),
        now: () => deps.clock.now(),
      })(context, event);
    },
    planMove: deps.planner,
    ...(deps.plannerBudgetMs === undefined ? {} : { plannerBudgetMs: deps.plannerBudgetMs }),
    ...(deps.observePlan === undefined ? {} : { observePlan: deps.observePlan }),
    emit: (moves) => Promise.resolve(moves),
    nowMs: () => deps.clock.now().getTime(),
  });
}

async function resolveIntent(
  deps: Parameters<typeof createTutorService>[0],
  context: LoadedTurnContext<ApiModelContext>,
  event: TutorInputEvent,
): Promise<Intent | null> {
  if (event.kind !== 'ANSWER' && event.kind !== 'SPEECH_FINAL') return null;
  const text = event.kind === 'ANSWER' ? (event.text ?? '') : event.text;
  const classified = await deps.intent.classify({
    text,
    hints: {
      answerKey: context.modelContext.answerKey,
      ...(event.kind === 'SPEECH_FINAL' ? { speechConfidence: event.confidence } : {}),
    },
    context: context.modelContext.scrubbed,
    question: context.modelContext.latestQuestion ?? 'no open item yet',
    studentId: context.session.studentId,
  });
  return classified.intent;
}

function grade(
  event: Extract<TutorInputEvent, { kind: 'ANSWER' | 'SPEECH_FINAL' }>,
  context: ApiModelContext,
  skillCode: string | null,
): Readonly<{ correct: boolean; misconception: string | null }> | null {
  const answer = event.kind === 'ANSWER' ? (event.text ?? event.choiceId ?? '') : event.text;
  if (context.completionOnly) return null;
  const correct =
    context.arithmeticProblem === null
      ? context.answerKey !== null && normalise(answer) === normalise(context.answerKey)
      : checkArithmetic(context.arithmeticProblem, answer).verdict === 'correct';
  const misconception = correct
    ? null
    : matchMisconception({
        skillCode,
        question: context.latestQuestion,
        expectedAnswer: context.answerKey,
        learnerAnswer: answer,
      });
  return { correct, misconception };
}

function normalise(value: string): string {
  return value.trim().toLocaleLowerCase().replaceAll(/\s+/g, ' ');
}
