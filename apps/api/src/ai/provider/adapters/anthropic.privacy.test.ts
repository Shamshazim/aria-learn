import { afterEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { createAnthropicProvider } from '@/ai/provider/adapters/anthropic';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Anthropic privacy', () => {
  it('writes no key, prompt body, or child name to process logs', async () => {
    const provider = createProvider(() => Promise.resolve(new Response('{}', { status: 401 })));
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await expect(
      provider.complete({
        tier: 'TEACH',
        system: 'Secret prompt body for child Priya.',
        user: 'Private child answer.',
      }),
    ).rejects.toMatchObject({ category: 'auth' });

    expectNothingLeaked(stdout, stderr);
  });

  it('writes nothing to process logs when a stream carries model text and then fails', async () => {
    const body = [
      'data: {"type":"message_start","message":{"usage":{"input_tokens":1,"output_tokens":1}}}',
      '',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Priya said"}}',
      '',
      'data: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}',
      '',
    ].join('\n');
    const provider = createProvider(() => Promise.resolve(new Response(body, { status: 200 })));
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    const consume = async (): Promise<void> => {
      for await (const _chunk of provider.stream({
        tier: 'TEACH',
        system: 'Secret prompt body for child Priya.',
        user: 'Private child answer.',
      })) {
        // Consumption is the behavior under test.
      }
    };
    await expect(consume()).rejects.toMatchObject({ category: 'transport' });

    expectNothingLeaked(stdout, stderr);
  });
});

function expectNothingLeaked(stdout: MockInstance, stderr: MockInstance): void {
  const captured = [...stdout.mock.calls, ...stderr.mock.calls].flat().join(' ');
  expect(captured).not.toContain('test-api-key');
  expect(captured).not.toContain('Secret prompt body');
  expect(captured).not.toContain('Priya');
}

function createProvider(
  fetch: typeof globalThis.fetch,
): ReturnType<typeof createAnthropicProvider> {
  return createAnthropicProvider({
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
    fetch,
    now: Date.now,
  });
}
