import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ArrivalResponse } from '@aria/shared';

import type { ArrivalApi } from '@/features/arrival/api/arrival.api';
import { useArrival } from '@/features/arrival/hooks/useArrival';
import type { TurnTimingReporter } from '@/lib/observability/timing';

/**
 * X-04 part 2: the arrival is where `arrival_visible` is measured.
 *
 * The clock has to stop on the render that puts the welcome on screen, not on the response
 * that made it possible — the gap between the two is a render the child waited through. And it
 * must not stop at all for an arrival the child navigated away from, because a measurement
 * left running would be closed by the next one and land as a single enormous sample.
 */
describe('measuring the arrival a child waited for', () => {
  it('runs the clock from the request to the welcome being on screen', async () => {
    const { timings, result } = render();

    expect(timings.start).toHaveBeenCalledWith('arrival_visible');
    expect(timings.stop).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(result.current.state.status).toBe('ready');
    });
    expect(timings.stop).toHaveBeenCalledWith('arrival_visible');
  });

  it('abandons the measurement when the child leaves before the welcome arrives', () => {
    const { timings, unmount } = render();

    unmount();

    expect(timings.cancel).toHaveBeenCalledWith('arrival_visible');
    expect(timings.stop).not.toHaveBeenCalled();
  });

  it('reports nothing for an arrival that failed', async () => {
    const { timings, result } = render({ fail: true });

    await waitFor(() => {
      expect(result.current.state.status).toBe('unavailable');
    });
    expect(timings.stop).not.toHaveBeenCalled();
  });

  it('works without a reporter, so a page that does not measure still arrives', async () => {
    const view = renderHook(() => useArrival(api(false)));

    await waitFor(() => {
      expect(view.result.current.state.status).toBe('ready');
    });
  });
});

function render(options: Readonly<{ fail?: boolean }> = {}) {
  const timings = {
    start: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
    bind: vi.fn(),
    flush: vi.fn(() => Promise.resolve()),
  };
  const reporter: TurnTimingReporter = timings;
  const view = renderHook(() => useArrival(api(options.fail === true), undefined, reporter));
  return { ...view, timings };
}

function api(fail: boolean): ArrivalApi {
  return {
    arrive: () => (fail ? Promise.reject(new Error('offline')) : Promise.resolve(response())),
  };
}

function response(): ArrivalResponse {
  return {
    arrivalId: '00000000-0000-4000-8000-000000000001',
    recommendedSubject: null,
    student: { grade: '4', band: 'middle' },
    classes: [{ subjectId: 'mathematics', name: 'Mathematics', grade: '4' }],
    moves: [welcome('WELCOME'), welcome('CHECK_IN')],
  };
}

function welcome(kind: 'WELCOME' | 'CHECK_IN'): ArrivalResponse['moves'][number] {
  return {
    id: `move-${kind}`,
    at: '2026-09-30T09:00:00.000Z',
    protocolVersion: '1.1.0',
    kind,
    speech: { text: 'Hi Sam.' },
    display: [],
    expects: 'none',
    ...(kind === 'WELCOME' ? { basedOn: [] } : { about: 'difficulty' }),
  } as ArrivalResponse['moves'][number];
}
