import type { TutorInputEvent } from '@aria/shared';

import type { Logger } from '@/lib/logger';

/**
 * A `SILENCE` event that names a move Aria has already moved past (P2H-01).
 *
 * Timers race the network. A tablet arms a twelve-second countdown after an `ASK`, the child
 * answers at eleven seconds, and the timer still fires — the event arrives naming a question
 * that is already answered. Acting on it would count a silence the child never had and push
 * them up the escalation ladder toward "let's stop for today". So it is dropped, and logged,
 * because a *pattern* of stale silences means the client's timer is wrong.
 */
export type LatestMoveLookup = (sessionId: string) => Promise<string | null>;

export async function isStaleSilence(
  event: TutorInputEvent,
  latestMoveId: LatestMoveLookup,
  logger: Pick<Logger, 'info'>,
): Promise<boolean> {
  if (event.kind !== 'SILENCE') return false;
  const afterMoveId = event.afterMoveId;
  const sessionId = event.sessionId;
  // An unanchored SILENCE cannot be stale: there is nothing to compare it against.
  if (afterMoveId === undefined || sessionId === undefined) return false;
  const current = await latestMoveId(sessionId);
  if (current === null || current === afterMoveId) return false;
  logger.info(
    { event: 'stale_silence', sessionId, afterMoveId, currentMoveId: current },
    'Ignored a silence timer that fired after Aria had already moved on',
  );
  return true;
}
