import { useEffect, useReducer } from 'react';

import type { ArrivalApi } from '@/features/arrival/api/arrival.api';
import { INITIAL_ARRIVAL_STATE, reduceArrival } from '@/features/arrival/model/arrival.machine';
import type { ArrivalState } from '@/features/arrival/model/arrival.machine';

export type ArrivalViewModel = Readonly<{
  state: ArrivalState;
  checkIn(value: string): void;
}>;

export function useArrival(api: ArrivalApi): ArrivalViewModel {
  const [state, dispatch] = useReducer(reduceArrival, INITIAL_ARRIVAL_STATE);
  useEffect(() => {
    const controller = new AbortController();
    void api.arrive(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) dispatch({ kind: 'LOADED', data });
      },
      () => {
        if (!controller.signal.aborted) dispatch({ kind: 'FAILED' });
      },
    );
    return () => {
      controller.abort();
    };
  }, [api]);
  return {
    state,
    checkIn: (value: string) => {
      dispatch({ kind: 'CHECKED_IN', value });
    },
  };
}
