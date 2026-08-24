import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAnthropicProvider } from '@/ai/provider/adapters/anthropic';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Anthropic privacy', () => {
  it('writes no key, prompt body, or child name to process logs', async () => {
    const provider = createAnthropicProvider({
      endpointName: 'private-endpoint',
      endpoint: {
        api: 'anthropic',
        'base-url': 'https://provider.invalid',
        'api-key': 'test-api-key',
        model: 'test-model',
        'max-tokens': 100,
        'timeout-seconds': 1,
        'cost-per-mtok-in': 1,
        'cost-per-mtok-out': 1,
      },
      fetch: () => Promise.resolve(new Response('{}', { status: 401 })),
      now: Date.now,
    });
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await expect(
      provider.complete({
        tier: 'TEACH',
        system: 'Secret prompt body for child Priya.',
        user: 'Private child answer.',
      }),
    ).rejects.toMatchObject({ category: 'auth' });

    const captured = [...stdout.mock.calls, ...stderr.mock.calls].flat().join(' ');
    expect(captured).not.toContain('test-api-key');
    expect(captured).not.toContain('Secret prompt body');
    expect(captured).not.toContain('Priya');
  });
});
