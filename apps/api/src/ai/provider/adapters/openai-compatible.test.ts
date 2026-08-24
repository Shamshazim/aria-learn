import { createServer, type Server } from 'node:http';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createOpenAiCompatibleProvider } from '@/ai/provider/adapters/openai-compatible';
import type { LlmProvider } from '@/ai/provider/types';

const RESPONSE_BODY = JSON.stringify({
  choices: [{ message: { content: 'A clear answer.' }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 120, completion_tokens: 30 },
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
  authorization: string | undefined;
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
        authorization: request.headers.authorization,
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

describe('OpenAI-compatible complete', () => {
  it('returns a populated response from the configured endpoint', async () => {
    const provider = createProvider();

    const response = await provider.complete({
      tier: 'TEACH',
      system: 'Teach clearly.',
      user: 'What is 2 + 2?',
    });

    expect(response).toMatchObject({
      text: 'A clear answer.',
      endpointName: 'stub-openai',
      model: 'stub-model',
      tokensIn: 120,
      tokensOut: 30,
      costUsd: 0.000_54,
      finishReason: 'stop',
    });
    expect(response.latencyMs).toBeGreaterThanOrEqual(0);
    expect(capturedRequests[0]).toEqual({
      url: '/chat/completions',
      method: 'POST',
      authorization: 'Bearer test-api-key',
    });
    expect(JSON.parse(requestBodies[0] ?? '')).toMatchObject({
      model: 'stub-model',
      messages: [
        { role: 'system', content: 'Teach clearly.' },
        { role: 'user', content: 'What is 2 + 2?' },
      ],
      temperature: 0,
      max_tokens: 512,
    });
  });

  it('uses reasoning-model token fields and omits temperature', async () => {
    const provider = createProvider(true);

    await provider.complete({
      tier: 'TEACH',
      system: 'Teach clearly.',
      user: 'What is 2 + 2?',
      maxTokens: 321,
      temperature: 0.5,
    });

    const requestBody: unknown = JSON.parse(requestBodies[0] ?? '');
    expect(requestBody).toMatchObject({ max_completion_tokens: 321 });
    expect(requestBody).not.toHaveProperty('max_tokens');
    expect(requestBody).not.toHaveProperty('temperature');
  });
});

describe('OpenAI-compatible JSON fallback', () => {
  it('uses prompt-only JSON when response_format is rejected', async () => {
    stubResponses = [
      {
        status: 400,
        body: '{"error":{"message":"response_format is unsupported"}}',
      },
      {
        status: 200,
        body: JSON.stringify({
          choices: [
            { message: { content: 'Result:\n```json\n{"answer":4}\n```' }, finish_reason: 'stop' },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      },
    ];
    const provider = createProvider();

    const response = await provider.complete({
      tier: 'TEACH',
      system: 'Teach clearly.',
      user: 'What is 2 + 2?',
      jsonMode: true,
    });

    const firstRequest: unknown = JSON.parse(requestBodies[0] ?? '');
    const fallbackRequest: unknown = JSON.parse(requestBodies[1] ?? '');
    expect(firstRequest).toHaveProperty('response_format.type', 'json_object');
    expect(fallbackRequest).not.toHaveProperty('response_format');
    expect(fallbackRequest).toHaveProperty(
      'messages.0.content',
      'Teach clearly.\n\nReturn exactly one JSON object and no other text.',
    );
    expect(response.text).toBe('{"answer":4}');
  });

  it('does not treat an unrelated JSON-mode 400 as a format rejection', async () => {
    stubResponses = [
      {
        status: 400,
        body: '{"error":{"message":"model not found"}}',
      },
    ];

    await expect(
      createProvider().complete({ ...DEFAULT_REQUEST, jsonMode: true }),
    ).rejects.toMatchObject({ category: 'bad_request' });
    expect(requestBodies).toHaveLength(1);
  });
});

describe('OpenAI-compatible stream', () => {
  it('yields text chunks followed by final usage matching complete()', async () => {
    const streamBody = [
      'data: {"choices":[{"delta":{"content":null},"finish_reason":null}],"usage":null}',
      'data: {"choices":[{"delta":{"content":"A clear "},"finish_reason":null}],"usage":null}',
      'data: {"choices":[{"delta":{"content":"answer."},"finish_reason":null}],"usage":null}',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":null}',
      'data: {"choices":[],"usage":{"prompt_tokens":120,"completion_tokens":30}}',
      'data: [DONE]',
      '',
    ].join('\n\n');
    stubResponses = [
      { status: 200, body: RESPONSE_BODY },
      { status: 200, body: streamBody },
    ];
    const provider = createProvider();
    const request = { tier: 'TEACH', system: 'Teach clearly.', user: 'What is 2 + 2?' } as const;

    const completed = await provider.complete(request);
    const chunks = [];
    for await (const chunk of provider.stream(request)) chunks.push(chunk);

    const streamedText = chunks
      .filter((chunk) => chunk.kind === 'text')
      .map((chunk) => chunk.text)
      .join('');
    const finalChunk = chunks.find((chunk) => chunk.kind === 'complete');
    expect(streamedText).toBe(completed.text);
    expect(finalChunk).toMatchObject({
      kind: 'complete',
      response: {
        text: completed.text,
        tokensIn: 120,
        tokensOut: 30,
        costUsd: completed.costUsd,
        finishReason: 'stop',
      },
    });
    expect(JSON.parse(requestBodies[1] ?? '')).toMatchObject({
      stream: true,
      stream_options: { include_usage: true },
    });
  });
});

describe('OpenAI-compatible failures', () => {
  it.each([
    [429, 'rate_limit'],
    [500, 'transport'],
    [401, 'auth'],
  ] as const)('maps HTTP %s to %s', async (status, category) => {
    stubResponses = [{ status, body: '{}' }];

    await expect(createProvider().complete(DEFAULT_REQUEST)).rejects.toMatchObject({
      name: 'AiError',
      category,
    });
  });

  it('maps an elapsed request deadline to timeout', async () => {
    stubResponses = [{ status: 200, body: RESPONSE_BODY, delayMs: 50 }];

    await expect(
      createProvider().complete({ ...DEFAULT_REQUEST, timeoutMs: 5 }),
    ).rejects.toMatchObject({ name: 'AiError', category: 'timeout' });
  });

  it('preserves Retry-After for the routing layer', async () => {
    stubResponses = [
      {
        status: 429,
        body: '{}',
        headers: { 'retry-after': '2' },
      },
    ];

    await expect(createProvider().complete(DEFAULT_REQUEST)).rejects.toMatchObject({
      category: 'rate_limit',
      retryAfterMs: 2_000,
    });
  });

  it('maps a malformed provider response to content', async () => {
    stubResponses = [{ status: 200, body: 'not-json' }];

    await expect(createProvider().complete(DEFAULT_REQUEST)).rejects.toMatchObject({
      category: 'content',
    });
  });
});

function createProvider(reasoning = false): LlmProvider {
  return createOpenAiCompatibleProvider({
    endpointName: 'stub-openai',
    endpoint: {
      api: 'openai',
      'base-url': baseUrl,
      'api-key': 'test-api-key',
      model: 'stub-model',
      'max-tokens': 512,
      'timeout-seconds': 1,
      'cost-per-mtok-in': 2,
      'cost-per-mtok-out': 10,
      ...(reasoning ? { reasoning: true } : {}),
    },
    fetch: globalThis.fetch,
    now: Date.now,
  });
}

const DEFAULT_REQUEST = {
  tier: 'TEACH',
  system: 'Teach clearly.',
  user: 'What is 2 + 2?',
} as const;
