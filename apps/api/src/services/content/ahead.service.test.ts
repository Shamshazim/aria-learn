import { describe, expect, it, vi } from 'vitest';

import { createAheadService } from '@/services/content/ahead.service';

describe('ahead content', () => {
  it('starts preparing the next item without blocking the current turn', async () => {
    let release: (() => void) | undefined;
    const prepare = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const ahead = createAheadService({ prepare, onError: vi.fn() });

    ahead.schedule('session-1', { item: 2 });
    expect(prepare).toHaveBeenCalledOnce();
    release?.();
    await Promise.resolve();
  });

  it('aborts pending preparation when the session ends', () => {
    let signal: AbortSignal | undefined;
    const ahead = createAheadService({
      prepare: (_request: unknown, nextSignal) => {
        signal = nextSignal;
        return new Promise(() => undefined);
      },
      onError: vi.fn(),
    });
    ahead.schedule('session-1', {});
    ahead.cancel('session-1');
    expect(signal?.aborted).toBe(true);
  });
});
