import { expect, it } from 'vitest';

import {
  RESPONSE,
  configWithRoutes,
  dependencies,
} from '@/ai/provider/__fixtures__/routing.fixtures';
import { AiError, AiExhaustionError } from '@/ai/provider/errors';
import { createRoutingLlmProvider } from '@/ai/provider/routing';
import type { LlmProvider, StreamChunk } from '@/ai/provider/types';

it('retries a stream that fails before output, then falls back', async () => {
  let primaryAttempts = 0;
  const primary: LlmProvider = {
    complete: () => Promise.resolve(RESPONSE),
    stream: () => ({
      [Symbol.asyncIterator]: () => ({
        next: async () => {
          await Promise.resolve();
          primaryAttempts += 1;
          throw new AiError('transport');
        },
      }),
    }),
  };
  const fallback: LlmProvider = {
    complete: () => Promise.resolve(RESPONSE),
    stream: async function* () {
      await Promise.resolve();
      yield { kind: 'text', text: 'fallback' };
      yield { kind: 'complete', response: { ...RESPONSE, endpointName: 'fast-endpoint' } };
    },
  };
  const provider = createRoutingLlmProvider({
    config: configWithRoutes('teach-endpoint', 'fast-endpoint', 'fast-endpoint'),
    providers: new Map([
      ['teach-endpoint', primary],
      ['fast-endpoint', fallback],
    ]),
    ...dependencies(),
  });

  const chunks = await collect(provider.stream({ tier: 'TEACH', system: 'Teach.', user: 'Try.' }));

  expect(primaryAttempts).toBe(3);
  expect(chunks).toEqual([
    { kind: 'text', text: 'fallback' },
    { kind: 'complete', response: { ...RESPONSE, endpointName: 'fast-endpoint' } },
  ]);
});

it('does not retry or fall back after stream output has been emitted', async () => {
  let fallbackCalls = 0;
  const primary: LlmProvider = {
    complete: () => Promise.resolve(RESPONSE),
    stream: async function* () {
      await Promise.resolve();
      yield { kind: 'text', text: 'partial' };
      throw new AiError('transport');
    },
  };
  const fallback: LlmProvider = {
    complete: () => Promise.resolve(RESPONSE),
    stream: async function* () {
      await Promise.resolve();
      fallbackCalls += 1;
      yield { kind: 'complete', response: RESPONSE };
    },
  };
  const provider = createRoutingLlmProvider({
    config: configWithRoutes('teach-endpoint', 'fast-endpoint', 'fast-endpoint'),
    providers: new Map([
      ['teach-endpoint', primary],
      ['fast-endpoint', fallback],
    ]),
    ...dependencies(),
  });
  const emitted: StreamChunk[] = [];

  const consume = async (): Promise<void> => {
    for await (const chunk of provider.stream({
      tier: 'TEACH',
      system: 'Teach.',
      user: 'Try.',
    })) {
      emitted.push(chunk);
    }
  };

  await expect(consume()).rejects.toBeInstanceOf(AiExhaustionError);
  expect(emitted).toEqual([{ kind: 'text', text: 'partial' }]);
  expect(fallbackCalls).toBe(0);
});

it('raises exhaustion when a fallback stream fails after output', async () => {
  const primary: LlmProvider = {
    complete: () => Promise.resolve(RESPONSE),
    stream: () => failingStream(),
  };
  const fallback: LlmProvider = {
    complete: () => Promise.resolve(RESPONSE),
    stream: async function* () {
      await Promise.resolve();
      yield { kind: 'text', text: 'partial fallback' };
      throw new AiError('timeout');
    },
  };
  const provider = createRoutingLlmProvider({
    config: configWithRoutes('teach-endpoint', 'fast-endpoint', 'fast-endpoint'),
    providers: new Map([
      ['teach-endpoint', primary],
      ['fast-endpoint', fallback],
    ]),
    ...dependencies(),
  });
  const emitted: StreamChunk[] = [];
  const consume = async (): Promise<void> => {
    for await (const chunk of provider.stream({
      tier: 'TEACH',
      system: 'Teach.',
      user: 'Try.',
    })) {
      emitted.push(chunk);
    }
  };

  await expect(consume()).rejects.toBeInstanceOf(AiExhaustionError);
  expect(emitted).toEqual([{ kind: 'text', text: 'partial fallback' }]);
});

async function collect(stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

function failingStream(): AsyncIterable<StreamChunk> {
  return {
    [Symbol.asyncIterator]: () => ({
      next: () => Promise.reject(new AiError('transport')),
    }),
  };
}
