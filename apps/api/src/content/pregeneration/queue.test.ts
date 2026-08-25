import { describe, expect, it, vi } from 'vitest';

import { createBoundedQueue, createPregenerateService } from '@/content';

describe('bounded pregeneration', () => {
  it('prepares at most the configured number of items and never blocks the turn', async () => {
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const prepare = vi.fn(() => held);
    const queue = createBoundedQueue({ capacity: 2, onError: vi.fn() });
    const service = createPregenerateService({ queue, prepare });

    expect(service.prepareNext('n+1')).toBe(true);
    expect(service.prepareNext('n+2')).toBe(true);
    expect(service.prepareNext('n+3')).toBe(false);
    expect(queue.pending()).toBe(2);
    release?.();
    await held;
  });

  it('contains background failures instead of surfacing them to the active caller', async () => {
    const onError = vi.fn();
    const queue = createBoundedQueue({ capacity: 1, onError });
    const service = createPregenerateService({
      queue,
      prepare: () => Promise.reject(new Error('provider down')),
    });

    expect(service.prepareNext('n+1')).toBe(true);
    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1);
    });
  });
});
