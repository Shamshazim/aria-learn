import type { ArrivalResponse } from '@aria/shared';

export type ArrivalState =
  | Readonly<{ status: 'loading'; checkIn: string | null }>
  | Readonly<{ status: 'ready'; data: ArrivalResponse; checkIn: string | null }>
  | Readonly<{ status: 'unavailable'; checkIn: string | null }>;

export type ArrivalAction =
  | Readonly<{ kind: 'RELOAD' }>
  | Readonly<{ kind: 'LOADED'; data: ArrivalResponse }>
  | Readonly<{ kind: 'FAILED' }>
  | Readonly<{ kind: 'CHECKED_IN'; value: string }>;

export const INITIAL_ARRIVAL_STATE: ArrivalState = { status: 'loading', checkIn: null };

export function reduceArrival(state: ArrivalState, action: ArrivalAction): ArrivalState {
  switch (action.kind) {
    case 'RELOAD':
      return state.status === 'loading' ? state : { status: 'loading', checkIn: state.checkIn };
    case 'LOADED':
      return { status: 'ready', data: action.data, checkIn: state.checkIn };
    case 'FAILED':
      return { status: 'unavailable', checkIn: state.checkIn };
    case 'CHECKED_IN':
      return { ...state, checkIn: action.value };
  }
}
