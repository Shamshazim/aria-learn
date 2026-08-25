import type { Band, TutorMove } from '@aria/shared';

export type TutorStatus = 'thinking' | 'speaking' | 'listening' | 'waiting';

/** P2H-07: the sentences of a move that is still being written, in the order they arrived. */
export type StreamedMove = Readonly<{ moveId: string; text: string }>;

export type SessionState = Readonly<{
  band: Band;
  currentMove: TutorMove | null;
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
    streaming: null,
    moves: [],
    stoppedMoveIds: [],
    status: 'thinking',
    paused: false,
    ended: false,
  };
}
