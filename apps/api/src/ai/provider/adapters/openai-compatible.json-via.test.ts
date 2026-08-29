import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createOpenAiCompatibleProvider } from '@/ai/provider/adapters/openai-compatible';

const bodySchema = z.object({
  messages: z.array(z.object({ role: z.string(), content: z.string() })),
  response_format: z.unknown().optional(),
});

/**
 * Groq fails a generation outright under `response_format` (`json_validate_failed`, empty
 * output) where OpenAI would shape it. An endpoint may therefore ask for JSON by prompt: one
 * request, no `response_format`, the object extracted from the text.
 */
describe('asking for JSON by prompt', () => {
  it('sends one request without response_format and extracts the object', async () => {
    const sent: string[] = [];
    const provider = createOpenAiCompatibleProvider({
      endpointName: 'groq',
      endpoint: {
        api: 'openai',
        'base-url': 'http://groq.test/v1',
        'api-key': 'k',
        model: 'openai/gpt-oss-20b',
        'max-tokens': 256,
        'timeout-seconds': 1,
        'cost-per-mtok-in': 0.1,
        'cost-per-mtok-out': 0.3,
        'json-via': 'prompt',
      },
      fetch: (_url, init) => {
        if (typeof init?.body === 'string') sent.push(init.body);
        return Promise.resolve(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: 'Sure: {"verdict":"correct"} done' }, finish_reason: 'stop' }],
              usage: { prompt_tokens: 10, completion_tokens: 5 },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        );
      },
      now: Date.now,
    });

    const response = await provider.complete({
      tier: 'FAST',
      system: 'Grade fairly.',
      user: 'Is 470 right?',
      jsonMode: true,
    });

    expect(sent).toHaveLength(1);
    const body = bodySchema.parse(JSON.parse(sent[0] ?? ''));
    expect(body.response_format).toBeUndefined();
    expect(body.messages[0]?.content).toContain('Return exactly one JSON object');
    expect(response.text).toBe('{"verdict":"correct"}');
  });
});
