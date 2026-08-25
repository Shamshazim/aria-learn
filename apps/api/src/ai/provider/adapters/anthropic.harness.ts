import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import { afterEach, beforeEach } from 'vitest';

import { createAnthropicProvider } from '@/ai/provider/adapters/anthropic';
import type { LlmProvider } from '@/ai/provider/types';

/**
 * A stub Anthropic endpoint shared by the adapter's test files.
 *
 * Calling `useAnthropicStub()` inside a suite registers the server's lifecycle hooks and hands
 * back live accessors, so each file gets its own isolated server on its own port.
 */
export const RESPONSE_BODY = JSON.stringify({
  content: [{ type: 'text', text: 'A clear answer.' }],
  stop_reason: 'end_turn',
  usage: { input_tokens: 120, output_tokens: 30 },
});

export const DEFAULT_REQUEST = {
  tier: 'TEACH',
  system: 'Teach clearly.',
  user: 'What is 2 + 2?',
} as const;

export type StubResponse = {
  status: number;
  body: string;
  delayMs?: number;
  headers?: Record<string, string>;
};

export type CapturedRequest = {
  url: string | undefined;
  method: string | undefined;
  apiKey: string | undefined;
  anthropicVersion: string | undefined;
};

export type AnthropicStub = Readonly<{
  requestBodies(): readonly string[];
  capturedRequests(): readonly CapturedRequest[];
  queue(...responses: readonly StubResponse[]): void;
  createProvider(
    options?: Readonly<{ model?: string; supportsTemperature?: boolean }>,
  ): LlmProvider;
}>;

export function useAnthropicStub(): AnthropicStub {
  let server: Server;
  let baseUrl: string;
  let requestBodies: string[] = [];
  let stubResponses: StubResponse[] = [];
  let capturedRequests: CapturedRequest[] = [];

  beforeEach(async () => {
    requestBodies = [];
    capturedRequests = [];
    stubResponses = [{ status: 200, body: RESPONSE_BODY }];
    server = createServer((request, response) => {
      collect(request, (body) => {
        requestBodies.push(body);
        capturedRequests.push(captureOf(request));
        respond(response, stubResponses.shift());
      });
    });
    baseUrl = await listen(server);
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error === undefined) resolve();
        else reject(error);
      });
    });
  });

  return {
    requestBodies: () => requestBodies,
    capturedRequests: () => capturedRequests,
    queue: (...responses) => {
      stubResponses = [...responses];
    },
    createProvider: (options = {}) =>
      createAnthropicProvider({
        endpointName: 'stub-anthropic',
        endpoint: {
          api: 'anthropic',
          'base-url': baseUrl,
          'api-key': 'test-api-key',
          model: options.model ?? 'stub-model',
          'max-tokens': 512,
          'timeout-seconds': 1,
          'cost-per-mtok-in': 2,
          'cost-per-mtok-out': 10,
          ...(options.supportsTemperature === undefined
            ? {}
            : { 'supports-temperature': options.supportsTemperature }),
        },
        fetch: globalThis.fetch,
        now: Date.now,
      }),
  };
}

function collect(request: IncomingMessage, done: (body: string) => void): void {
  request.setEncoding('utf8');
  let body = '';
  request.on('data', (chunk: string) => {
    body += chunk;
  });
  request.on('end', () => {
    done(body);
  });
}

function captureOf(request: IncomingMessage): CapturedRequest {
  return {
    url: request.url,
    method: request.method,
    apiKey: headerValue(request.headers['x-api-key']),
    anthropicVersion: headerValue(request.headers['anthropic-version']),
  };
}

function respond(response: ServerResponse, stub: StubResponse | undefined): void {
  if (stub === undefined) throw new Error('No stub response configured');
  setTimeout(() => {
    response.writeHead(stub.status, { 'content-type': 'application/json', ...stub.headers });
    response.end(stub.body);
  }, stub.delayMs ?? 0);
}

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('Stub server did not start');
  return `http://127.0.0.1:${String(address.port)}`;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
