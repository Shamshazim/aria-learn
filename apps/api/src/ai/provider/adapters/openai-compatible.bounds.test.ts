import { describe, expect, it } from 'vitest';

import { createOpenAiCompatibleProvider } from '@/ai/provider/adapters/openai-compatible';

describe('OpenAI-compatible response bounds', () => {
  it('rejects an oversized completion response', async () => {
    const body = JSON.stringify({
      choices: [{ message: { content: 'x'.repeat(70_000) }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });
    const provider = createProvider(new Response(body));

    await expect(provider.complete(defaultRequest())).rejects.toMatchObject({
      category: 'content',
    });
  });

  it('rejects an oversized streaming response', async () => {
    const event = `data: ${JSON.stringify({
      choices: [{ delta: { content: 'x'.repeat(70_000) }, finish_reason: null }],
      usage: null,
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

function createProvider(response: Response): ReturnType<typeof createOpenAiCompatibleProvider> {
  return createOpenAiCompatibleProvider({
    endpointName: 'bounded-endpoint',
    endpoint: {
      api: 'openai',
      'base-url': 'https://provider.invalid/v1',
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
