import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useEngagementSignals } from '@/features/session/hooks/useEngagementSignals';

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useEngagementSignals (P3-05)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setHidden(false);
  });
  afterEach(() => {
    vi.useRealTimers();
    setHidden(false);
  });

  function mount() {
    const send = vi.fn(() => Promise.resolve());
    renderHook(() => {
      useEngagementSignals(send);
    });
    return send;
  }

  it('emits idle once the tab has been hidden for thirty seconds, and nothing more on return', () => {
    const send = mount();
    setHidden(true);
    vi.advanceTimersByTime(29_999);
    expect(send).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(send).toHaveBeenCalledExactlyOnceWith({
      kind: 'ENGAGEMENT_SIGNAL',
      signal: 'idle',
      hiddenMs: 30_000,
    });
    vi.advanceTimersByTime(60_000);
    setHidden(false);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('reports a shorter absence as tab_hidden on return', () => {
    const send = mount();
    setHidden(true);
    vi.advanceTimersByTime(8_000);
    setHidden(false);
    expect(send).toHaveBeenCalledExactlyOnceWith({
      kind: 'ENGAGEMENT_SIGNAL',
      signal: 'tab_hidden',
      hiddenMs: 8_000,
    });
  });

  it('ignores a notification banner under three seconds', () => {
    const send = mount();
    setHidden(true);
    vi.advanceTimersByTime(2_000);
    setHidden(false);
    expect(send).not.toHaveBeenCalled();
  });
});
