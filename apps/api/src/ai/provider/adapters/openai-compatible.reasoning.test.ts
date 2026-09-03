import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createOpenAiCompatibleProvider } from '@/ai/provider/adapters/openai-compatible';

const bodySchema = z.object({
  max_tokens: z.number().optional(),
  reasoning_effort: z.string().optional(),
});

/**
 * Groq's gpt-oss models think before they answer and the thinking is billed against
 * `max_tokens`. With the planner's 120-token budget the whole budget went on reasoning and the
 * answer came back empty, so every turn fell to the policy's canned move. An endpoint may
 * therefore name a reasoning effort and an allowance the answer's budget sits on top of.
 */
describe('a reasoning endpoint', () => {
  async function send(endpoint: Record<string, unknown>, maxTokens?: number): Promise<string> {
    const sent: string[] = [];
    const provider = createOpenAiCompatibleProvider({
      endpointName: 'groq',
      endpoint: {
        api: 'openai',
        'base-url': 'http://groq.test/v1',
        'api-key': 'k',
        model: 'openai/gpt-oss-120b',
        'max-tokens': 1_024,
        'timeout-seconds': 1,
        'cost-per-mtok-in': 0.1,
        'cost-per-mtok-out': 0.3,
        ...endpoint,
      },
      fetch: (_url, init) => {
        if (typeof init?.body === 'string') sent.push(init.body);
        return Promise.resolve(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: '{"kind":"PRAISE"}' }, finish_reason: 'stop' }],
              usage: { prompt_tokens: 10, completion_tokens: 5 },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        );
      },
      now: Date.now,
    });
    await provider.complete({
      tier: 'TEACH',
      system: 'Plan.',
      user: 'What next?',
      ...(maxTokens === undefined ? {} : { maxTokens }),
    });
    return sent[0] ?? '';
  }

  it('adds the reasoning allowance to the answer budget and names the effort', async () => {
    const body = bodySchema.parse(
      JSON.parse(await send({ 'reasoning-effort': 'low', 'reasoning-tokens': 256 }, 120)),
    );
    expect(body.max_tokens).toBe(376);
    expect(body.reasoning_effort).toBe('low');
  });

  it('sends the plain budget and no effort for an endpoint that does not reason', async () => {
    const body = bodySchema.parse(JSON.parse(await send({}, 120)));
    expect(body.max_tokens).toBe(120);
    expect(body.reasoning_effort).toBeUndefined();
  });
});
