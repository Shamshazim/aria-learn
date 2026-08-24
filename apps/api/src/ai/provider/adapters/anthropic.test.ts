import { createServer, type Server } from 'node:http';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createAnthropicProvider } from '@/ai/provider/adapters/anthropic';
import type { LlmProvider } from '@/ai/provider/types';

const RESPONSE_BODY = JSON.stringify({
  content: [{ type: 'text', text: 'A clear answer.' }],
  stop_reason: 'end_turn',
  usage: { input_tokens: 120, output_tokens: 30 },
});

type StubResponse = {
  status: number;
  body: string;
  delayMs?: number;
  headers?: Record<string, string>;
};

type CapturedRequest = {
  url: string | undefined;
  method: string | undefined;
  apiKey: string | undefined;
  anthropicVersion: string | undefined;
};

let server: Server;
let baseUrl: string;
let requestBodies: string[];
let stubResponses: StubResponse[];
let capturedRequests: CapturedRequest[];

beforeEach(async () => {
  requestBodies = [];
  capturedRequests = [];
  stubResponses = [{ status: 200, body: RESPONSE_BODY }];
  server = createServer((request, response) => {
    request.setEncoding('utf8');
    let body = '';
    request.on('data', (chunk: string) => {
      body += chunk;
    });
    request.on('end', () => {
      requestBodies.push(body);
      capturedRequests.push({
        url: request.url,
        method: request.method,
        apiKey: headerValue(request.headers['x-api-key']),
        anthropicVersion: headerValue(request.headers['anthropic-version']),
      });
      const stub = stubResponses.shift();
      if (stub === undefined) throw new Error('No stub response configured');
      setTimeout(() => {
        response.writeHead(stub.status, {
          'content-type': 'application/json',
          ...stub.headers,
        });
        response.end(stub.body);
      }, stub.delayMs ?? 0);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('Stub server did not start');
  baseUrl = `http://127.0.0.1:${String(address.port)}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) resolve();
      else reject(error);
    });
  });
});

describe('Anthropic complete', () => {
  it('uses the Messages wire contract and returns a populated response', async () => {
    const response = await createProvider().complete({
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
    expect(capturedRequests[0]).toEqual({
      url: '/v1/messages',
      method: 'POST',
      apiKey: 'test-api-key',
      anthropicVersion: '2023-06-01',
    });
    expect(JSON.parse(requestBodies[0] ?? '')).toEqual({
      model: 'stub-model',
      system: 'Teach clearly.',
      messages: [{ role: 'user', content: 'What is 2 + 2?' }],
      max_tokens: 512,
    });
  });

  it('requests and extracts one JSON object from surrounding model prose', async () => {
    stubResponses = [
      {
        status: 200,
        body: JSON.stringify({
          content: [{ type: 'text', text: 'Result:\n```json\n{"answer":4}\n```' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      },
    ];

    const response = await createProvider().complete({
      tier: 'TEACH',
      system: 'Teach clearly.',
      user: 'What is 2 + 2?',
      jsonMode: true,
    });

    expect(JSON.parse(requestBodies[0] ?? '')).toMatchObject({
      system: 'Teach clearly.\n\nReturn exactly one JSON object and no other text.',
      messages: [{ role: 'user', content: 'What is 2 + 2?' }],
    });
    expect(response.text).toBe('{"answer":4}');
  });
});

describe('Anthropic stream', () => {
  it('yields text deltas and final usage from the Messages stream', async () => {
    stubResponses = [
      {
        status: 200,
        body: [
          'event: message_start',
          'data: {"type":"message_start","message":{"usage":{"input_tokens":120,"output_tokens":1}}}',
          '',
          'event: content_block_delta',
          'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"A clear "}}',
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
      },
    ];

    const chunks = [];
    for await (const chunk of createProvider().stream(DEFAULT_REQUEST)) chunks.push(chunk);

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
    expect(JSON.parse(requestBodies[0] ?? '')).toMatchObject({ stream: true, max_tokens: 512 });
  });
});

describe('Anthropic failures', () => {
  it.each([
    [429, 'rate_limit'],
    [529, 'transport'],
    [401, 'auth'],
  ] as const)('maps HTTP %s to %s', async (status, category) => {
    stubResponses = [{ status, body: '{}' }];

    await expect(createProvider().complete(DEFAULT_REQUEST)).rejects.toMatchObject({
      name: 'AiError',
      category,
    });
  });

  it('preserves Retry-After for the routing layer', async () => {
    stubResponses = [{ status: 429, body: '{}', headers: { 'retry-after': '2' } }];

    await expect(createProvider().complete(DEFAULT_REQUEST)).rejects.toMatchObject({
      category: 'rate_limit',
      retryAfterMs: 2_000,
    });
  });

  it('maps an elapsed request deadline to timeout', async () => {
    stubResponses = [{ status: 200, body: RESPONSE_BODY, delayMs: 50 }];

    await expect(
      createProvider().complete({ ...DEFAULT_REQUEST, timeoutMs: 5 }),
    ).rejects.toMatchObject({ name: 'AiError', category: 'timeout' });
  });

  it('maps an in-stream overloaded event to transport', async () => {
    stubResponses = [
      {
        status: 200,
        body: [
          'event: error',
          'data: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}',
          '',
        ].join('\n'),
      },
    ];

    const consume = async (): Promise<void> => {
      for await (const _chunk of createProvider().stream(DEFAULT_REQUEST)) {
        // Consumption is the behavior under test.
      }
    };
    await expect(consume()).rejects.toMatchObject({ category: 'transport' });
  });
});

function createProvider(): LlmProvider {
  return createAnthropicProvider({
    endpointName: 'stub-anthropic',
    endpoint: {
      api: 'anthropic',
      'base-url': baseUrl,
      'api-key': 'test-api-key',
      model: 'stub-model',
      'max-tokens': 512,
      'timeout-seconds': 1,
      'cost-per-mtok-in': 2,
      'cost-per-mtok-out': 10,
    },
    fetch: globalThis.fetch,
    now: Date.now,
  });
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const DEFAULT_REQUEST = {
  tier: 'TEACH',
  system: 'Teach clearly.',
  user: 'What is 2 + 2?',
} as const;
