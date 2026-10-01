import { useEffect, useReducer } from 'react';

import type { Grade } from '@aria/shared';

import type { ArrivalApi } from '@/features/arrival/api/arrival.api';
import { INITIAL_ARRIVAL_STATE, reduceArrival } from '@/features/arrival/model/arrival.machine';
import type { ArrivalState } from '@/features/arrival/model/arrival.machine';
import type { TurnTimingReporter } from '@/lib/observability/timing';

export type ArrivalViewModel = Readonly<{
  state: ArrivalState;
  checkIn(value: string): void;
}>;

/**
 * The arrival, fetched once — and again whenever a developer picks another grade to look at,
 * because the classes on the picker are the API's answer for a grade, not the browser's.
 *
 * X-04: it is also where `arrival_visible` is measured. The clock starts when the request goes
 * out and stops when the welcome has been committed to the DOM — which is the honest client
 * number for the §11 visible-welcome bar, and strictly larger than the server's `arrival_ms`
 * because it includes the network and the render the child actually waited through. It stops
 * just before the browser paints rather than just after: measuring the paint would mean a
 * `requestAnimationFrame` whose own scheduling is the thing being measured.
 */
export function useArrival(
  api: ArrivalApi,
  grade?: Grade,
  timings?: TurnTimingReporter,
): ArrivalViewModel {
  const [state, dispatch] = useReducer(reduceArrival, INITIAL_ARRIVAL_STATE);
  useEffect(() => {
    const controller = new AbortController();
    dispatch({ kind: 'RELOAD' });
    timings?.start('arrival_visible');
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
      // A child who navigated away mid-arrival did not wait for a welcome, so there is nothing
      // to report. Left running, the measurement would be closed by the next arrival's render
      // and land in the histogram as one enormous sample.
      timings?.cancel('arrival_visible');
    };
  }, [api, grade, timings]);
  // Separate from the fetch, so the clock stops after React has committed the welcome rather
  // than when the response arrived. The gap between the two is the render, which the child
  // waited through as surely as they waited for the network.
  useEffect(() => {
    if (state.status === 'ready') timings?.stop('arrival_visible');
  }, [state.status, timings]);
  return {
    state,
    checkIn: (value: string) => {
      dispatch({ kind: 'CHECKED_IN', value });
    },
  };
}
