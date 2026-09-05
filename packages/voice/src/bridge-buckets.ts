import type { TutorMove } from '@aria/shared';
import type { Intent } from '@aria/tutor';

/**
 * The five kinds of thing Aria says to cover a gap (P2H-09).
 *
 * A bucket is the only thing the bridge path ever chooses. It never composes a sentence, so the
 * worst a wrong bucket can do is sound slightly off — which is what makes a bridge safe to pick
 * from a rule that has not seen the answer yet.
 */
export const BRIDGE_BUCKETS = [
  'acknowledge',
  'thinking',
  'encourage',
  'transition',
  'confirm-heard',
] as const;

export type BridgeBucket = (typeof BRIDGE_BUCKETS)[number];

/**
 * Intent to bucket, exactly as P2H-09 rule 5 lists it.
 *
 * `null` is not "no matching bucket": it is "this turn's answer is fixed and instant, so there
 * is no gap to cover". Stopping and personal information are both answered from text the API
 * already holds, and a child who asks to stop should hear the answer, not an "okay, let's see".
 */
const BY_INTENT: Readonly<Record<Intent, BridgeBucket | null>> = {
  ANSWER: 'acknowledge',
  QUESTION: 'thinking',
  CONFUSED: 'encourage',
  CHAT: 'acknowledge',
  UNCLEAR: 'confirm-heard',
  STOP_REQUEST: null,
  PERSONAL_INFO: null,
  // The child asked to move on, so the next thing out of the harness is a fresh question.
  SKIP_REQUEST: 'transition',
};

/**
 * Aria was already moving somewhere else when the child spoke, so whatever they said, the next
 * thing out of the harness is a transition. The move kind is the only signal available at
 * bridge time — the next move does not exist yet, and waiting for it is the wait we are covering.
 */
const TRANSITION_MOVES: readonly TutorMove['kind'][] = ['SWITCH', 'BREAK'];

export function bucketFor(
  input: Readonly<{ intent: Intent; afterMoveKind: TutorMove['kind'] | null }>,
): BridgeBucket | null {
  const byIntent = BY_INTENT[input.intent];
  if (byIntent === null) return null;
  if (input.afterMoveKind !== null && TRANSITION_MOVES.includes(input.afterMoveKind)) {
    return 'transition';
  }
  return byIntent;
}
