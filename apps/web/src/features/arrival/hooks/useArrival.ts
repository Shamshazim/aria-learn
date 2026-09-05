import { useEffect, useReducer } from 'react';

import type { Grade } from '@aria/shared';

import type { ArrivalApi } from '@/features/arrival/api/arrival.api';
import { INITIAL_ARRIVAL_STATE, reduceArrival } from '@/features/arrival/model/arrival.machine';
import type { ArrivalState } from '@/features/arrival/model/arrival.machine';

export type ArrivalViewModel = Readonly<{
  state: ArrivalState;
  checkIn(value: string): void;
}>;

/**
 * The arrival, fetched once — and again whenever a developer picks another grade to look at,
 * because the classes on the picker are the API's answer for a grade, not the browser's.
 */
export function useArrival(api: ArrivalApi, grade?: Grade): ArrivalViewModel {
  const [state, dispatch] = useReducer(reduceArrival, INITIAL_ARRIVAL_STATE);
  useEffect(() => {
    const controller = new AbortController();
    dispatch({ kind: 'RELOAD' });
    void api.arrive(controller.signal, grade).then(
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
  }, [api, grade]);
  return {
    state,
    checkIn: (value: string) => {
      dispatch({ kind: 'CHECKED_IN', value });
    },
  };
}
