import type { TutorInputEvent, TutorMove } from '@aria/shared';

import type { CrisisTurnService } from '@/services/tutor/crisis-turn.service';
import type { TutorService } from '@/services/tutor/tutor.service';

/**
 * The order of every child input: safety, then everything else (P1-13, P2H-05).
 *
 * A crisis utterance must never reach the intent classifier, the grader or a model. It is not
 * an answer to be marked, a question to be answered, or chat to be acknowledged — it is a
 * child telling us something, and the response to it is fixed and reviewed.
 *
 * It is one expression, but it is the expression the safety guarantee rests on, so it has a
 * name and a test rather than sitting inline in a controller.
 */
export async function turnMoves(
  services: Readonly<{
    crisis: Pick<CrisisTurnService, 'handle'>;
    tutor: Pick<TutorService, 'handle'>;
  }>,
  studentId: string,
  event: TutorInputEvent,
  signal?: AbortSignal,
): Promise<readonly TutorMove[]> {
  const crisis = await services.crisis.handle(studentId, event);
  if (crisis !== null) return crisis;
  return services.tutor.handle(studentId, event, signal);
}
