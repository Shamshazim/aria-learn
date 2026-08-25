import type { Band, MoveKind, TutorMove } from '@aria/shared';

/**
 * When the silence countdown may run (P2H-01).
 *
 * Both channels ask the same question — "should I be waiting for this child right now?" — so
 * both ask it here. A `LISTEN` move is Aria explicitly handing the floor over; nagging a child
 * who is being invited to read aloud is the exact behaviour this ticket exists to remove.
 */
export type SilenceArmInput = Readonly<{
  move: Pick<TutorMove, 'kind' | 'expects'> | null;
  /** Aria is mid-utterance. A child cannot be "silent" while being spoken to. */
  speaking: boolean;
  /** The tab is backgrounded, or the room has no audio path. */
  attended: boolean;
}>;

const NEVER_ARMS: ReadonlySet<MoveKind> = new Set<MoveKind>(['LISTEN']);

export function shouldArmSilenceTimer(input: SilenceArmInput): boolean {
  if (input.move === null || input.speaking || !input.attended) return false;
  if (NEVER_ARMS.has(input.move.kind)) return false;
  return input.move.expects !== 'none';
}

/** How long to wait before calling it silence. Younger children get less dead air. */
export function silenceWindowMs(band: Band): number {
  if (band === 'early') return 12_000;
  if (band === 'middle') return 18_000;
  return 25_000;
}
