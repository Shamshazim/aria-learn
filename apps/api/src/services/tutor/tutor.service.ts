import type { TutorInputEvent, TutorMove } from '@aria/shared';
import {
  classifyIntent,
  createTeachingPolicy,
  createTutorHarness,
  type TutorHarness,
  type TutorPorts,
} from '@aria/tutor';

import { matchMisconception } from '@/curriculum/misconception.matcher';
import type { Clock } from '@/lib/clock';
import { checkArithmetic } from '@/quality/arithmetic';
import type { ApiModelContext } from '@/services/content/turn-content.service';

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
}): TutorService {
  const harness = buildHarness(deps);
  return {
    handle: async (studentId, event, signal) => {
      if (event.sessionId === undefined) throw new Error('Session turn requires sessionId');
      await deps.requireOwnership(studentId, event.sessionId);
      return harness.handle(event, signal);
    },
  };
}

function buildHarness(
  deps: Parameters<typeof createTutorService>[0],
): TutorHarness<ApiModelContext> {
  return createTutorHarness<ApiModelContext>({
    ...deps.ports,
    applyPolicy: (context, event) =>
      Promise.resolve(
        createTeachingPolicy<ApiModelContext>({
          gradeAnswer: (answer) => grade(answer, context.modelContext, context.session.skillCode),
          classifyIntent: (utterance) =>
            classifyIntent(utterance.kind === 'ANSWER' ? (utterance.text ?? '') : utterance.text, {
              answerKey: context.modelContext.answerKey,
            }).intent,
          sessionLimitMs: (band) => deps.sessionLimitMs(band),
          now: () => deps.clock.now(),
        })(context, event),
      ),
    planMove: ({ fallback }) => Promise.resolve(fallback),
    emit: (moves) => Promise.resolve(moves),
    nowMs: () => deps.clock.now().getTime(),
  });
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
