import type { TutorMove } from '@aria/shared';

import type { SessionState, TutorStatus } from '@/features/session/model/session-state';

export type UiAction =
  | Readonly<{ kind: 'SOURCE_PENDING' }>
  | Readonly<{ kind: 'SOURCE_SETTLED' }>
  | Readonly<{ kind: 'STOP_ACTIVE' }>;

export function reduceSession(state: SessionState, input: TutorMove | UiAction): SessionState {
  if (input.kind === 'STOP_ACTIVE') return stopActive(state);
  if (input.kind === 'SOURCE_PENDING') return { ...state, status: 'thinking' };
  if (input.kind === 'SOURCE_SETTLED') {
    return state.status === 'thinking' ? { ...state, status: 'waiting' } : state;
  }
  switch (input.kind) {
    case 'WELCOME':
      return receive(state, input);
    case 'CHECK_IN':
      return receive(state, input);
    case 'RECOMMEND':
      return receive(state, input);
    case 'SAY':
      return receive(state, input);
    case 'SHOW':
      return receive(state, input);
    case 'ASK':
      return receive(state, input);
    case 'LISTEN':
      return receive(state, input, 'listening');
    default:
      return reduceResponseOrSession(state, input);
  }
}

type ResponseOrSessionMove = Exclude<
  TutorMove,
  { kind: 'WELCOME' | 'CHECK_IN' | 'RECOMMEND' | 'SAY' | 'SHOW' | 'ASK' | 'LISTEN' }
>;

function reduceResponseOrSession(state: SessionState, input: ResponseOrSessionMove): SessionState {
  switch (input.kind) {
    case 'HINT':
      return receive(state, input);
    case 'RETEACH':
      return receive(state, input);
    case 'REVEAL':
      return receive(state, input);
    case 'PRAISE':
      return receive(state, input);
    case 'SWITCH':
      return { ...receive(state, input), paused: false };
    case 'BREAK':
      return { ...receive(state, input), paused: true };
    case 'END':
      return { ...receive(state, input, 'waiting'), ended: true, paused: true };
    /* v8 ignore next -- the default is a compile-time exhaustiveness guard. */
    default:
      return assertNever(input);
  }
}

function receive(state: SessionState, move: TutorMove, forcedStatus?: TutorStatus): SessionState {
  return {
    ...state,
    currentMove: move,
    moves: [...state.moves, move],
    status: forcedStatus ?? (move.speech === null ? 'waiting' : 'speaking'),
  };
}

function stopActive(state: SessionState): SessionState {
  const active = state.currentMove;
  if (active === null) return state;
  return {
    ...state,
    currentMove: null,
    stoppedMoveIds: [...state.stoppedMoveIds, active.id],
    status: 'listening',
  };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled move: ${String(value)}`);
}
