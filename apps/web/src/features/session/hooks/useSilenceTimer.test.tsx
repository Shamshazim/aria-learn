import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TutorMove } from '@aria/shared';
import { silenceWindowMs } from '@aria/tutor';

import { useSilenceTimer } from '@/features/session/hooks/useSilenceTimer';

const EARLY_WINDOW = silenceWindowMs('early');

function move(kind: TutorMove['kind'], expects: TutorMove['expects'], id = 'move-1'): TutorMove {
  return {
    id,
    at: '2026-08-25T10:00:00.000Z',
    protocolVersion: '1.1.0',
    kind,
    speech: { text: 'What is four plus three?' },
    display: [],
    expects,
  } as TutorMove;
}

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

function render(overrides: Partial<Parameters<typeof useSilenceTimer>[0]> = {}) {
  const onSilence = vi.fn();
  const view = renderHook(
    (props: Parameters<typeof useSilenceTimer>[0]) => useSilenceTimer(props),
    {
      initialProps: {
        move: move('ASK', 'text'),
        band: 'early' as const,
        speaking: false,
        onSilence,
        ...overrides,
      },
    },
  );
  return { ...view, onSilence };
}

describe('useSilenceTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setHidden(false);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports silence after the band window with the move it followed', () => {
    const { onSilence } = render();

    act(() => {
      vi.advanceTimersByTime(EARLY_WINDOW);
    });

    expect(onSilence).toHaveBeenCalledExactlyOnceWith({
      waitedMs: EARLY_WINDOW,
      afterMoveId: 'move-1',
    });
  });

  it('never arms on a LISTEN move', () => {
    const { onSilence } = render({ move: move('LISTEN', 'speech') });

    act(() => {
      vi.advanceTimersByTime(EARLY_WINDOW * 3);
    });

    expect(onSilence).not.toHaveBeenCalled();
  });

  it('does not run while Aria is speaking, and starts once she stops', () => {
    const { onSilence, rerender } = render({ speaking: true });

    act(() => {
      vi.advanceTimersByTime(EARLY_WINDOW * 2);
    });
    expect(onSilence).not.toHaveBeenCalled();

    rerender({ move: move('ASK', 'text'), band: 'early', speaking: false, onSilence });
    act(() => {
      vi.advanceTimersByTime(EARLY_WINDOW);
    });
    expect(onSilence).toHaveBeenCalledOnce();
  });

  it('does not run while the tab is hidden', () => {
    const { onSilence } = render();

    act(() => {
      setHidden(true);
    });
    act(() => {
      vi.advanceTimersByTime(EARLY_WINDOW * 2);
    });
    expect(onSilence).not.toHaveBeenCalled();

    act(() => {
      setHidden(false);
    });
    act(() => {
      vi.advanceTimersByTime(EARLY_WINDOW);
    });
    expect(onSilence).toHaveBeenCalledOnce();
  });

  it('a backchannel cancels the countdown without answering for the child', () => {
    const { result, onSilence } = render();

    act(() => {
      vi.advanceTimersByTime(EARLY_WINDOW / 2);
      result.current.backchannel();
    });
    act(() => {
      vi.advanceTimersByTime(EARLY_WINDOW * 3);
    });

    expect(onSilence).not.toHaveBeenCalled();
  });

  it('a partial transcript restarts the full window', () => {
    const { result, onSilence } = render();

    act(() => {
      vi.advanceTimersByTime(EARLY_WINDOW - 1_000);
      result.current.speechPartial();
    });
    act(() => {
      vi.advanceTimersByTime(EARLY_WINDOW - 1_000);
    });
    expect(onSilence).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(onSilence).toHaveBeenCalledOnce();
  });

  it('a partial transcript revives a countdown a backchannel cancelled', () => {
    const { result, onSilence } = render();

    act(() => {
      result.current.backchannel();
    });
    act(() => {
      result.current.speechPartial();
    });
    act(() => {
      vi.advanceTimersByTime(EARLY_WINDOW);
    });

    expect(onSilence).toHaveBeenCalledOnce();
  });

  it('a new move restarts the countdown a backchannel had cancelled', () => {
    const { result, rerender, onSilence } = render();

    act(() => {
      result.current.backchannel();
    });
    rerender({
      move: move('ASK', 'text', 'move-2'),
      band: 'early',
      speaking: false,
      onSilence,
    });
    act(() => {
      vi.advanceTimersByTime(EARLY_WINDOW);
    });

    expect(onSilence).toHaveBeenCalledExactlyOnceWith({
      waitedMs: EARLY_WINDOW,
      afterMoveId: 'move-2',
    });
  });
});
