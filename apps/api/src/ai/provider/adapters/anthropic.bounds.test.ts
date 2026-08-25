import { describe, expect, it } from 'vitest';

import { createAnthropicProvider } from '@/ai/provider/adapters/anthropic';

describe('Anthropic response bounds', () => {
  it('rejects an oversized completion response', async () => {
    const body = JSON.stringify({
      content: [{ type: 'text', text: 'x'.repeat(70_000) }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    const provider = createProvider(new Response(body));

    await expect(provider.complete(defaultRequest())).rejects.toMatchObject({
      category: 'content',
    });
  });

  it('rejects an oversized streaming response', async () => {
    const event = `data: ${JSON.stringify({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: 'x'.repeat(70_000) },
    })}\n\n`;
    const provider = createProvider(
      new Response(event, { headers: { 'content-type': 'text/event-stream' } }),
    );

    const consume = async (): Promise<void> => {
      for await (const _chunk of provider.stream(defaultRequest())) {
        // Consumption is the behavior under test.
      }
    };
    await expect(consume()).rejects.toMatchObject({ category: 'content' });
  });
});

function createProvider(response: Response): ReturnType<typeof createAnthropicProvider> {
  return createAnthropicProvider({
    endpointName: 'bounded-endpoint',
    endpoint: {
      api: 'anthropic',
      'base-url': 'https://provider.invalid',
      'api-key': 'test-key',
      model: 'test-model',
      'max-tokens': 1,
      'timeout-seconds': 1,
      'cost-per-mtok-in': 1,
      'cost-per-mtok-out': 1,
    },
    fetch: () => Promise.resolve(response),
    now: Date.now,
  });
}

function defaultRequest(): { tier: 'TEACH'; system: string; user: string } {
  return { tier: 'TEACH', system: 'Teach.', user: 'Answer.' };
}
