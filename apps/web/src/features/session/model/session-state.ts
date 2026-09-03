import type { Band, TutorMove } from '@aria/shared';

export type TutorStatus = 'thinking' | 'speaking' | 'listening' | 'waiting';

/** P2H-07: the sentences of a move that is still being written, in the order they arrived. */
export type StreamedMove = Readonly<{ moveId: string; text: string }>;

export type SessionState = Readonly<{
  band: Band;
  currentMove: TutorMove | null;
  /**
   * The question the child is answering. It owns the answer control on the screen from the
   * moment it is asked until it is answered, ended or switched away from — a hint, a picture
   * or something Aria put up to read appears beside it, never in place of it.
   */
  openQuestion: TutorMove | null;
  /** What Aria is saying right now, before the move carrying it has finished (P2H-07). */
  streaming: StreamedMove | null;
  moves: readonly TutorMove[];
  stoppedMoveIds: readonly string[];
  status: TutorStatus;
  paused: boolean;
  ended: boolean;
}>;

export function initialSessionState(band: Band): SessionState {
  return {
    band,
    currentMove: null,
    openQuestion: null,
    streaming: null,
    moves: [],
    stoppedMoveIds: [],
    status: 'thinking',
    paused: false,
    ended: false,
  };
}
