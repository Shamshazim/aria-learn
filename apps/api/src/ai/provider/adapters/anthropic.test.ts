import { describe, expect, it } from 'vitest';

import { useAnthropicStub } from '@/ai/provider/adapters/anthropic.harness';

const stub = useAnthropicStub();

describe('Anthropic complete', () => {
  it('uses the Messages wire contract and returns a populated response', async () => {
    const response = await stub.createProvider().complete({
      tier: 'TEACH',
      system: 'Teach clearly.',
      user: 'What is 2 + 2?',
    });

    expect(response).toMatchObject({
      text: 'A clear answer.',
      endpointName: 'stub-anthropic',
      model: 'stub-model',
      tokensIn: 120,
      tokensOut: 30,
      costUsd: 0.000_54,
      finishReason: 'stop',
    });
    expect(response.latencyMs).toBeGreaterThanOrEqual(0);
    expect(stub.capturedRequests()[0]).toEqual({
      url: '/v1/messages',
      method: 'POST',
      apiKey: 'test-api-key',
      anthropicVersion: '2023-06-01',
    });
    expect(JSON.parse(stub.requestBodies()[0] ?? '')).toEqual({
      model: 'stub-model',
      system: 'Teach clearly.',
      messages: [{ role: 'user', content: 'What is 2 + 2?' }],
      max_tokens: 512,
    });
  });

  it('requests and extracts one JSON object from surrounding model prose', async () => {
    stub.queue(
      ...[
        {
          status: 200,
          body: JSON.stringify({
            content: [{ type: 'text', text: 'Result:\n```json\n{"answer":4}\n```' }],
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
        },
      ],
    );

    const response = await stub.createProvider().complete({
      tier: 'TEACH',
      system: 'Teach clearly.',
      user: 'What is 2 + 2?',
      jsonMode: true,
    });

    expect(JSON.parse(stub.requestBodies()[0] ?? '')).toMatchObject({
      system: 'Teach clearly.\n\nReturn exactly one JSON object and no other text.',
      messages: [{ role: 'user', content: 'What is 2 + 2?' }],
    });
    expect(response.text).toBe('{"answer":4}');
  });

  it('reads the text block when a reasoning model emits a thinking block first', async () => {
    stub.queue(
      ...[
        {
          status: 200,
          body: JSON.stringify({
            content: [
              { type: 'thinking', thinking: '', signature: 'abc' },
              { type: 'text', text: '{"answer":4}' },
            ],
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
        },
      ],
    );

    const response = await stub.createProvider().complete({
      tier: 'TEACH',
      system: 'Teach clearly.',
      user: 'What is 2 + 2?',
      jsonMode: true,
    });
    expect(response.text).toBe('{"answer":4}');
  });

  it('omits temperature when the endpoint disables it', async () => {
    await stub.createProvider({ supportsTemperature: false }).complete({
      tier: 'FAST',
      system: 'Return only OK.',
      user: 'Health check.',
      temperature: 0,
    });

    expect(JSON.parse(stub.requestBodies()[0] ?? '')).not.toHaveProperty('temperature');
  });
});
