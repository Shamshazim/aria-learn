import type { TutorMove } from '@aria/shared';

import type { SessionState, TutorStatus } from '@/features/session/model/session-state';

export type UiAction =
  | Readonly<{ kind: 'DRAFT_CHANGED'; value: string }>
  | Readonly<{ kind: 'DELIVERY_FINISHED'; moveId: string }>
  | Readonly<{ kind: 'STOP_ACTIVE' }>;

export function reduceSession(state: SessionState, input: TutorMove | UiAction): SessionState {
  if (isUiAction(input)) return reduceUiAction(state, input);
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
      return receive(state, input);
    case 'BREAK':
      return { ...receive(state, input), paused: true };
    case 'END':
      return { ...receive(state, input, 'waiting'), ended: true };
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
    draft: '',
  };
}

function reduceUiAction(state: SessionState, action: UiAction): SessionState {
  if (action.kind === 'DRAFT_CHANGED') return { ...state, draft: action.value };
  if (action.kind === 'DELIVERY_FINISHED') {
    return state.currentMove?.id === action.moveId ? { ...state, status: 'waiting' } : state;
  }
  const active = state.currentMove;
  if (active === null) return state;
  return {
    ...state,
    currentMove: null,
    stoppedMoveIds: [...state.stoppedMoveIds, active.id],
    status: 'listening',
  };
}

function isUiAction(input: TutorMove | UiAction): input is UiAction {
  return ['DRAFT_CHANGED', 'DELIVERY_FINISHED', 'STOP_ACTIVE'].includes(input.kind);
}

function assertNever(value: never): never {
  throw new Error(`Unhandled move: ${String(value)}`);
}
