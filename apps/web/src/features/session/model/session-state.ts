import type { Band, TutorMove } from '@aria/shared';

export type TutorStatus = 'thinking' | 'speaking' | 'listening' | 'waiting';

export type SessionState = Readonly<{
  band: Band;
  currentMove: TutorMove | null;
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
    moves: [],
    stoppedMoveIds: [],
    status: 'thinking',
    paused: false,
    ended: false,
  };
}

export function silenceWindowMs(band: Band): number {
  if (band === 'early') return 12_000;
  if (band === 'middle') return 18_000;
  return 25_000;
}
