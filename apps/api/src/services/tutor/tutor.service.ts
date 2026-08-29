import type { TutorInputEvent, TutorMove } from '@aria/shared';
import {
  createTeachingPolicy,
  createTutorHarness,
  type Intent,
  type LoadedTurnContext,
  type PolicyDecision,
  type TutorHarness,
  type TutorPorts,
} from '@aria/tutor';

import type { AnswerJudge, AnswerJudgement } from '@/ai/grader/model-grader';
import type { IntentClassifier } from '@/ai/intent/model-intent.classifier';
import { matchMisconception } from '@/curriculum/misconception.matcher';
import type { Clock } from '@/lib/clock';
import type { Logger } from '@/lib/logger';
import { checkArithmetic } from '@/quality/arithmetic';
import type { ApiModelContext } from '@/services/content/turn-content.service';
import type { AnswerResync } from '@/services/tutor/answer-target';
import { resolveSpokenAnswer, type ChoiceOption } from '@/services/tutor/spoken-answer';
import { isStaleSilence, type LatestMoveLookup } from '@/services/tutor/stale-silence';
import { strategiesFor } from '@/services/tutor/strategy-evidence';

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
  /** An answer to a question Aria has moved past gets the current moves back, not a 400. */
  resyncAnswer: AnswerResync;
  logger: Pick<Logger, 'info'>;
  intent: IntentClassifier;
  /** A second opinion on an answer that missed the key word for word; absent means exact only. */
  judge?: AnswerJudge;
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
      if (event.kind === 'ANSWER') {
        const resync = await deps.resyncAnswer({
          sessionId: event.sessionId,
          respondsTo: event.respondsTo,
        });
        if (resync !== null) return resync;
      }
      return harness.handle(event, signal);
    },
  };
}

type Judgement = Readonly<{ intent: Intent | null; judged: AnswerJudgement }>;

/** The harness applies the policy twice per turn (speculate, recheck); one model pass each. */
const REMEMBERED_JUDGEMENTS = 64;

function buildHarness(
  deps: Parameters<typeof createTutorService>[0],
): TutorHarness<ApiModelContext> {
  const remembered = new Map<string, Promise<Judgement>>();
  return createTutorHarness<ApiModelContext>({
    ...deps.ports,
    applyPolicy: async (context, event) => {
      // The intent decides which branch the turn takes, so it is resolved before the policy
      // runs rather than inside it: the model second pass is asynchronous, the policy is pure.
      const { intent, judged } = await rememberJudgement(remembered, event.id, () =>
        judgeTurn(deps, context, event),
      );
      return createTeachingPolicy<ApiModelContext>({
        gradeAnswer: (answer) =>
          grade(answer, context.modelContext, judged, {
            code: context.session.skillCode,
            repeatedMisconception: context.session.repeatedMisconception,
          }),
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

async function rememberJudgement(
  remembered: Map<string, Promise<Judgement>>,
  eventId: string,
  judge: () => Promise<Judgement>,
): Promise<Judgement> {
  const known = remembered.get(eventId);
  if (known !== undefined) return known;
  const pending = judge();
  remembered.set(eventId, pending);
  if (remembered.size > REMEMBERED_JUDGEMENTS) {
    const oldest = remembered.keys().next().value;
    if (oldest !== undefined) remembered.delete(oldest);
  }
  return pending;
}

async function judgeTurn(
  deps: Parameters<typeof createTutorService>[0],
  context: LoadedTurnContext<ApiModelContext>,
  event: TutorInputEvent,
): Promise<Judgement> {
  const intent = await resolveIntent(deps, context, event);
  const judged = intent === 'ANSWER' ? await judgeAnswer(deps, context, event) : null;
  return { intent, judged };
}

async function resolveIntent(
  deps: Parameters<typeof createTutorService>[0],
  context: LoadedTurnContext<ApiModelContext>,
  event: TutorInputEvent,
): Promise<Intent | null> {
  if (event.kind !== 'ANSWER' && event.kind !== 'SPEECH_FINAL') return null;
  const text = spokenAnswer(event, context.modelContext);
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

/**
 * Whether the judge is asked at all: only a free-text answer to a keyed, non-arithmetic item
 * that missed the key word for word. Choice questions resolve to an option id, arithmetic
 * has its own checker, and a match needs no second opinion.
 */
async function judgeAnswer(
  deps: Parameters<typeof createTutorService>[0],
  context: LoadedTurnContext<ApiModelContext>,
  event: TutorInputEvent,
): Promise<AnswerJudgement> {
  if (deps.judge === undefined) return null;
  if (event.kind !== 'ANSWER' && event.kind !== 'SPEECH_FINAL') return null;
  const model = context.modelContext;
  if (model.completionOnly || model.arithmeticProblem !== null) return null;
  if (model.answerKey === null || model.latestQuestion === null) return null;
  if (choicesOf(model).length > 0) return null;
  const answer = spokenAnswer(event, model);
  if (answer.trim() === '' || normalise(answer) === normalise(model.answerKey)) return null;
  return deps.judge({
    question: model.latestQuestion,
    expectedAnswer: model.answerKey,
    learnerAnswer: answer,
    context: model.scrubbed,
    studentId: context.session.studentId,
  });
}

function grade(
  event: Extract<TutorInputEvent, { kind: 'ANSWER' | 'SPEECH_FINAL' }>,
  context: ApiModelContext,
  judged: AnswerJudgement,
  skill: Readonly<{ code: string | null; repeatedMisconception: string | null }>,
): NonNullable<PolicyDecision['graded']> | null {
  const answer = spokenAnswer(event, context);
  if (context.completionOnly) return null;
  const correct =
    context.arithmeticProblem === null
      ? (context.answerKey !== null && normalise(answer) === normalise(context.answerKey)) ||
        judged === 'correct'
      : checkArithmetic(context.arithmeticProblem, answer).verdict === 'correct';
  // P2H-10: several signatures can fit one answer, so the wrong idea this child has already
  // shown outranks a first sighting rather than authored order deciding it silently.
  const misconception = correct
    ? null
    : matchMisconception(
        {
          skillCode: skill.code,
          question: context.latestQuestion,
          expectedAnswer: context.answerKey,
          learnerAnswer: answer,
          problem: context.arithmeticProblem,
        },
        skill.repeatedMisconception === null ? [] : [skill.repeatedMisconception],
      );
  return { correct, misconception, strategies: strategiesFor(skill.code, correct) };
}

/** The child's words, resolved to the choice they name where the question offered choices. */
function spokenAnswer(
  event: Extract<TutorInputEvent, { kind: 'ANSWER' | 'SPEECH_FINAL' }>,
  context: ApiModelContext,
): string {
  const said = event.kind === 'ANSWER' ? (event.text ?? event.choiceId ?? '') : event.text;
  return resolveSpokenAnswer(said, choicesOf(context));
}

function choicesOf(context: ApiModelContext): readonly ChoiceOption[] {
  const display = context.latestAsk?.display ?? [];
  return display.flatMap((item) => (item.type === 'choices' ? item.options : []));
}

function normalise(value: string): string {
  return value.trim().toLocaleLowerCase().replaceAll(/\s+/g, ' ');
}
