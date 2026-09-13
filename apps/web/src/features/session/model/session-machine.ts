import type { MoveSegment, TutorMove } from '@aria/shared';

import type { SessionState, TutorStatus } from '@/features/session/model/session-state';

export type UiAction =
  | Readonly<{ kind: 'SOURCE_PENDING' }>
  | Readonly<{ kind: 'SOURCE_SETTLED' }>
  | Readonly<{ kind: 'STOP_ACTIVE' }>
  /** The voice said whether Aria is talking; the status line follows her, not the last move. */
  | Readonly<{ kind: 'VOICE_STATE'; state: 'listening' | 'thinking' | 'speaking' }>
  /** No voice is playing this move, so "Aria is explaining" ends the moment it is on screen. */
  | Readonly<{ kind: 'SPEECH_SETTLED' }>;

export function reduceSession(
  state: SessionState,
  input: TutorMove | MoveSegment | UiAction,
): SessionState {
  if (input.kind === 'MOVE_SEGMENT') return receiveSegment(state, input);
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

const UI_ACTIONS: ReadonlySet<UiAction['kind']> = new Set([
  'SOURCE_PENDING',
  'SOURCE_SETTLED',
  'STOP_ACTIVE',
  'VOICE_STATE',
  'SPEECH_SETTLED',
]);

function isUiAction(input: TutorMove | UiAction): input is UiAction {
  return (UI_ACTIONS as ReadonlySet<string>).has(input.kind);
}

function reduceUiAction(state: SessionState, input: UiAction): SessionState {
  if (input.kind === 'STOP_ACTIVE') return stopActive(state);
  if (input.kind === 'SOURCE_PENDING') return { ...state, status: 'thinking' };
  if (input.kind === 'VOICE_STATE') return voiceState(state, input.state);
  if (input.kind === 'SPEECH_SETTLED') {
    return state.status === 'speaking' ? { ...state, status: 'waiting' } : state;
  }
  return state.status === 'thinking' ? { ...state, status: 'waiting' } : state;
}

/**
 * The voice is the authority on whether Aria is talking. Before this the status said
 * "explaining" from the moment a spoken move arrived until the next tap, whatever the voice
 * was doing, so the screen and the voice disagreed for most of every turn.
 */
function voiceState(
  state: SessionState,
  voice: 'listening' | 'thinking' | 'speaking',
): SessionState {
  if (state.ended) return state;
  if (voice === 'speaking')
    return state.status === 'speaking' ? state : { ...state, status: 'speaking' };
  if (voice === 'thinking')
    return state.status === 'thinking' ? state : { ...state, status: 'thinking' };
  if (state.status !== 'speaking' && state.status !== 'thinking') return state;
  return { ...state, status: state.currentMove === null ? 'listening' : 'waiting' };
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
      return closeQuestion(receive(state, input));
    case 'PRAISE':
      return closeQuestion(receive(state, input));
    case 'SWITCH':
      return { ...closeQuestion(receive(state, input)), paused: false };
    case 'BREAK':
      return { ...closeQuestion(receive(state, input)), paused: true };
    case 'END':
      return { ...closeQuestion(receive(state, input, 'waiting')), ended: true, paused: true };
    /* v8 ignore next -- the default is a compile-time exhaustiveness guard. */
    default:
      return assertNever(input);
  }
}

/**
 * P2H-07: a sentence Aria has already said, before the move carrying it has arrived.
 *
 * It grows the visible text and nothing else. What the child is asked to *do* comes from the
 * move — a half-written answer has no input control, no answer key and no expectation — so the
 * status says speaking and the input surface waits for the move that closes the turn.
 */
function receiveSegment(state: SessionState, segment: MoveSegment): SessionState {
  const growing = state.streaming;
  const text =
    growing?.moveId === segment.moveId ? `${growing.text} ${segment.text}`.trim() : segment.text;
  return {
    ...state,
    currentMove: null,
    streaming: { moveId: segment.moveId, text },
    status: 'speaking',
  };
}

function receive(state: SessionState, move: TutorMove, forcedStatus?: TutorStatus): SessionState {
  // A re-sync sends the question the child is already looking at. It becomes current again
  // without being spoken twice or written into the transcript twice.
  const seen = state.moves.some((known) => known.id === move.id);
  return {
    ...state,
    currentMove: move,
    // A question stays open across whatever comes after it until something closes it: the
    // next question, a verdict on the answer, or the end. See `screen-composition.ts`.
    openQuestion: move.kind === 'ASK' ? move : state.openQuestion,
    // The move is the whole of what the sentences were a prefix of; it replaces them.
    streaming: null,
    moves: seen ? state.moves : [...state.moves, move],
    status: seen ? 'waiting' : (forcedStatus ?? (move.speech === null ? 'waiting' : 'speaking')),
  };
}

/** The answer was judged, or the lesson moved on: nothing is waiting for an answer now. */
function closeQuestion(state: SessionState): SessionState {
  return state.openQuestion === null ? state : { ...state, openQuestion: null };
}

function stopActive(state: SessionState): SessionState {
  const active = state.currentMove;
  if (active === null) return state;
  return {
    ...state,
    currentMove: null,
    streaming: null,
    stoppedMoveIds: [...state.stoppedMoveIds, active.id],
    status: 'listening',
  };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled move: ${String(value)}`);
}
