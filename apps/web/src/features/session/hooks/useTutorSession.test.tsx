import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TutorMove } from '@aria/shared';

import { useTutorSession } from '@/features/session/hooks/useTutorSession';
import { TurnRejectedError, type TutorSource } from '@/features/session/model/tutor-source';

const NO_STARTUP_EVENTS = [] as const;
const NO_MOVES: readonly TutorMove[] = [];

describe('useTutorSession transport sequencing', () => {
  it('serializes source calls and exposes thinking while one is pending', async () => {
    const pending: (() => void)[] = [];
    let active = 0;
    let maxActive = 0;
    const source: TutorSource = {
      send: async function* () {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise<void>((resolve) => pending.push(resolve));
        active -= 1;
        yield* NO_MOVES;
      },
      close: () => undefined,
    };
    const createSource = (): TutorSource => source;
    const { result } = renderHook(() =>
      useTutorSession({
        band: 'middle',
        grade: '4',
        subjectId: 'math',
        createSource,
        startupEvents: NO_STARTUP_EVENTS,
      }),
    );

    let first = Promise.resolve();
    let second = Promise.resolve();
    act(() => {
      first = result.current.answer('ask-1', '6');
      second = result.current.answer('ask-2', '7');
    });
    await waitFor(() => {
      expect(pending).toHaveLength(1);
    });
    expect(result.current.state.status).toBe('thinking');
    expect(maxActive).toBe(1);

    act(() => {
      pending.shift()?.();
    });
    await waitFor(() => {
      expect(pending).toHaveLength(1);
    });
    expect(maxActive).toBe(1);
    act(() => {
      pending.shift()?.();
    });
    await act(async () => {
      await Promise.all([first, second]);
    });

    expect(active).toBe(0);
    await waitFor(() => {
      expect(result.current.state.status).toBe('waiting');
    });
  });
});

describe('useTutorSession when the API refuses a turn', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('surfaces the failure, settles the status and resends on retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const sent: string[] = [];
    let refuse = true;
    const source: TutorSource = {
      // eslint-disable-next-line require-yield -- the refused turn produces no move.
      send: async function* (event) {
        sent.push(event.kind);
        await Promise.resolve();
        if (refuse) throw new TurnRejectedError('VALIDATION_ERROR');
      },
      close: () => undefined,
    };
    const createSource = (): TutorSource => source;
    const { result } = renderHook(() =>
      useTutorSession({
        band: 'middle',
        grade: '4',
        subjectId: 'math',
        createSource,
        startupEvents: NO_STARTUP_EVENTS,
      }),
    );

    await act(async () => {
      await result.current.answer('ask-1', '7');
    });

    expect(result.current.retryFailed).not.toBeNull();
    expect(result.current.state.status).toBe('waiting');
    // eslint-disable-next-line no-console -- asserting the one console line the app writes.
    expect(console.error).toHaveBeenCalledTimes(1);

    refuse = false;
    await act(async () => {
      await result.current.retryFailed?.();
    });

    expect(sent).toEqual(['ANSWER', 'ANSWER']);
    expect(result.current.retryFailed).toBeNull();
  });
});
