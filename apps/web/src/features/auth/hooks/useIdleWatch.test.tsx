import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useIdleWatch } from '@/features/auth/hooks/useIdleWatch';
import { IDLE_WARNING_MS, KEEP_ALIVE_GAP_MS } from '@/features/auth/model/idle-timer';

const NOW = new Date('2026-08-25T10:00:00.000Z');

let clock = NOW;
const now = (): Date => clock;

beforeEach(() => {
  clock = NOW;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const advance = async (ms: number): Promise<void> => {
  clock = new Date(clock.getTime() + ms);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe('watching for an idle device', () => {
  it('says nothing while there is plenty of time left', async () => {
    const deadline = new Date(NOW.getTime() + 30 * 60_000);
    const { result } = renderHook(() => useIdleWatch(deadline, () => Promise.resolve(), now));

    await advance(60_000);

    expect(result.current).toBe('active');
  });

  it('warns in the last two minutes', async () => {
    const deadline = new Date(NOW.getTime() + IDLE_WARNING_MS + 30_000);
    const { result } = renderHook(() => useIdleWatch(deadline, () => Promise.resolve(), now));

    await advance(60_000);

    expect(result.current).toBe('warning');
  });

  /** Past the deadline the server has already ended it; asking is how the device learns. */
  it('asks the server once the deadline has passed', async () => {
    const keepAlive = vi.fn(() => Promise.resolve());
    const deadline = new Date(NOW.getTime() + 30_000);
    renderHook(() => useIdleWatch(deadline, keepAlive, now));

    await advance(60_000);

    expect(keepAlive).toHaveBeenCalled();
  });

  it('tells the server the device is in use, but not on every tap', async () => {
    const keepAlive = vi.fn(() => Promise.resolve());
    const deadline = new Date(NOW.getTime() + 30 * 60_000);
    renderHook(() => useIdleWatch(deadline, keepAlive, now));

    act(() => {
      window.dispatchEvent(new Event('pointerdown'));
      window.dispatchEvent(new Event('keydown'));
    });
    expect(keepAlive).toHaveBeenCalledTimes(1);

    await advance(KEEP_ALIVE_GAP_MS);
    act(() => {
      window.dispatchEvent(new Event('pointerdown'));
    });

    expect(keepAlive).toHaveBeenCalledTimes(2);
  });

  it('does nothing at all when there is no session to watch', async () => {
    const keepAlive = vi.fn(() => Promise.resolve());
    const { result } = renderHook(() => useIdleWatch(null, keepAlive, now));

    act(() => {
      window.dispatchEvent(new Event('pointerdown'));
    });
    await advance(60 * 60_000);

    expect(result.current).toBe('active');
    expect(keepAlive).not.toHaveBeenCalled();
  });
});
