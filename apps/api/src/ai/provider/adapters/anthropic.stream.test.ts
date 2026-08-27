import { describe, expect, it } from 'vitest';

import {
  DEFAULT_REQUEST,
  RESPONSE_BODY,
  useAnthropicStub,
} from '@/ai/provider/adapters/anthropic.harness';

const stub = useAnthropicStub();

describe('Anthropic stream', () => {
  it('yields text deltas and final usage from the Messages stream', async () => {
    stub.queue({
      status: 200,
      body: [
        'event: message_start',
        'data: {"type":"message_start","message":{"usage":{"input_tokens":120,"output_tokens":1}}}',
        '',
        'event: content_block_delta',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"hmm"}}',
        '',
        'event: content_block_delta',
        'data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"A clear "}}',
        '',
        'event: ping',
        'data: {"type":"ping"}',
        '',
        'event: content_block_delta',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"answer."}}',
        '',
        'event: message_delta',
        'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":30}}',
        '',
        'event: message_stop',
        'data: {"type":"message_stop"}',
        '',
      ].join('\n'),
    });

    const chunks = [];
    for await (const chunk of stub.createProvider().stream(DEFAULT_REQUEST)) chunks.push(chunk);

    expect(
      chunks
        .filter((chunk) => chunk.kind === 'text')
        .map((chunk) => chunk.text)
        .join(''),
    ).toBe('A clear answer.');
    expect(chunks.at(-1)).toMatchObject({
      kind: 'complete',
      response: {
        text: 'A clear answer.',
        tokensIn: 120,
        tokensOut: 30,
        costUsd: 0.000_54,
        finishReason: 'stop',
      },
    });
    expect(JSON.parse(stub.requestBodies()[0] ?? '')).toMatchObject({
      stream: true,
      max_tokens: 512,
    });
  });
});

describe('Anthropic failures', () => {
  it.each([
    [429, 'rate_limit'],
    [529, 'transport'],
    [401, 'auth'],
  ] as const)('maps HTTP %s to %s', async (status, category) => {
    stub.queue({ status, body: '{}' });

    await expect(stub.createProvider().complete(DEFAULT_REQUEST)).rejects.toMatchObject({
      name: 'AiError',
      category,
    });
  });

  it('preserves Retry-After for the routing layer', async () => {
    stub.queue({ status: 429, body: '{}', headers: { 'retry-after': '2' } });

    await expect(stub.createProvider().complete(DEFAULT_REQUEST)).rejects.toMatchObject({
      category: 'rate_limit',
      retryAfterMs: 2_000,
    });
  });

  it('maps an elapsed request deadline to timeout', async () => {
    stub.queue({ status: 200, body: RESPONSE_BODY, delayMs: 50 });

    await expect(
      stub.createProvider().complete({ ...DEFAULT_REQUEST, timeoutMs: 5 }),
    ).rejects.toMatchObject({ name: 'AiError', category: 'timeout' });
  });

  it('maps an in-stream overloaded event to transport', async () => {
    stub.queue({
      status: 200,
      body: [
        'event: error',
        'data: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}',
        '',
      ].join('\n'),
    });

    const consume = async (): Promise<void> => {
      for await (const _chunk of stub.createProvider().stream(DEFAULT_REQUEST)) {
        // Consumption is the behavior under test.
      }
    };
    await expect(consume()).rejects.toMatchObject({ category: 'transport' });
  });
});
