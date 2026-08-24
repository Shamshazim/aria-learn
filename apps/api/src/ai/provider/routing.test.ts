import { expect, it } from 'vitest';

import {
  RESPONSE,
  configWithRoutes,
  dependencies,
  fakeProvider,
  providerFromComplete,
} from '@/ai/provider/__fixtures__/routing.fixtures';
import { AiError, AiExhaustionError } from '@/ai/provider/errors';
import { createRoutingLlmProvider } from '@/ai/provider/routing';

it('uses the endpoint selected for each tier by configuration', async () => {
  const calls: string[] = [];
  const providers = new Map([
    ['teach-endpoint', fakeProvider('teach-endpoint', calls)],
    ['fast-endpoint', fakeProvider('fast-endpoint', calls)],
  ]);
  const provider = createRoutingLlmProvider({
    config: configWithRoutes('teach-endpoint', 'fast-endpoint'),
    providers,
    ...dependencies(),
  });

  await provider.complete({ tier: 'TEACH', system: 'Teach.', user: 'Two plus two?' });
  await provider.complete({ tier: 'FAST', system: 'Classify.', user: 'Correct?' });

  expect(calls).toEqual(['teach-endpoint', 'fast-endpoint']);
});

it('retries availability failures at growing delays, at most three attempts', async () => {
  const attempts: number[] = [];
  const delays: number[] = [];
  const providers = new Map([
    [
      'teach-endpoint',
      providerFromComplete(() => {
        attempts.push(attempts.length + 1);
        if (attempts.length < 3) return Promise.reject(new AiError('rate_limit'));
        return Promise.resolve(RESPONSE);
      }),
    ],
  ]);
  const provider = createRoutingLlmProvider({
    config: configWithRoutes('teach-endpoint', 'teach-endpoint'),
    providers,
    ...dependencies({ delays }),
  });

  await expect(
    provider.complete({ tier: 'TEACH', system: 'Teach.', user: 'Try.' }),
  ).resolves.toMatchObject({ text: 'answer' });
  expect(attempts).toHaveLength(3);
  expect(delays).toEqual([250, 500]);
});

it('honours Retry-After and never retries a bad request', async () => {
  const retryDelays: number[] = [];
  let rateLimitAttempts = 0;
  const rateLimited = providerFromComplete(() => {
    rateLimitAttempts += 1;
    return rateLimitAttempts === 1
      ? Promise.reject(new AiError('rate_limit', 1_500))
      : Promise.resolve(RESPONSE);
  });
  const rateLimitedProvider = createRoutingLlmProvider({
    config: configWithRoutes('teach-endpoint', 'teach-endpoint'),
    providers: new Map([['teach-endpoint', rateLimited]]),
    ...dependencies({ delays: retryDelays }),
  });

  await rateLimitedProvider.complete({ tier: 'TEACH', system: 'Teach.', user: 'Try.' });

  let badRequestAttempts = 0;
  const badRequestProvider = createRoutingLlmProvider({
    config: configWithRoutes('teach-endpoint', 'teach-endpoint'),
    providers: new Map([
      [
        'teach-endpoint',
        providerFromComplete(() => {
          badRequestAttempts += 1;
          return Promise.reject(new AiError('bad_request'));
        }),
      ],
    ]),
    ...dependencies(),
  });

  await expect(
    badRequestProvider.complete({ tier: 'TEACH', system: 'Teach.', user: 'Try.' }),
  ).rejects.toMatchObject({ category: 'bad_request' });
  expect(retryDelays).toEqual([1_500]);
  expect(badRequestAttempts).toBe(1);
});

it('falls back after primary retries are exhausted and logs the switch', async () => {
  let primaryAttempts = 0;
  let fallbackAttempts = 0;
  const logs: Record<string, unknown>[] = [];
  const provider = createRoutingLlmProvider({
    config: configWithRoutes('teach-endpoint', 'fast-endpoint', 'fast-endpoint'),
    providers: new Map([
      [
        'teach-endpoint',
        providerFromComplete(() => {
          primaryAttempts += 1;
          return Promise.reject(new AiError('transport'));
        }),
      ],
      [
        'fast-endpoint',
        providerFromComplete(() => {
          fallbackAttempts += 1;
          return Promise.resolve({ ...RESPONSE, endpointName: 'fast-endpoint' });
        }),
      ],
    ]),
    ...dependencies({ logs }),
  });

  await expect(
    provider.complete({ tier: 'TEACH', system: 'Teach.', user: 'Try.' }),
  ).resolves.toMatchObject({ endpointName: 'fast-endpoint' });
  expect(primaryAttempts).toBe(3);
  expect(fallbackAttempts).toBe(1);
  expect(logs).toContainEqual(
    expect.objectContaining({
      event: 'ai.endpoint.fallback',
      endpointName: 'fast-endpoint',
      category: 'transport',
    }),
  );
});

it('does not retry or fall back after a content error', async () => {
  let primaryAttempts = 0;
  let fallbackAttempts = 0;
  const provider = createRoutingLlmProvider({
    config: configWithRoutes('teach-endpoint', 'fast-endpoint', 'fast-endpoint'),
    providers: new Map([
      [
        'teach-endpoint',
        providerFromComplete(() => {
          primaryAttempts += 1;
          return Promise.reject(new AiError('content'));
        }),
      ],
      [
        'fast-endpoint',
        providerFromComplete(() => {
          fallbackAttempts += 1;
          return Promise.resolve(RESPONSE);
        }),
      ],
    ]),
    ...dependencies(),
  });

  await expect(
    provider.complete({ tier: 'TEACH', system: 'Teach.', user: 'Try.' }),
  ).rejects.toMatchObject({ category: 'content' });
  expect(primaryAttempts).toBe(1);
  expect(fallbackAttempts).toBe(0);
});

it('raises a vendor-neutral exhaustion error when all configured endpoints are unavailable', async () => {
  const unavailable = providerFromComplete(() => Promise.reject(new AiError('transport')));
  const provider = createRoutingLlmProvider({
    config: configWithRoutes('teach-endpoint', 'fast-endpoint', 'fast-endpoint'),
    providers: new Map([
      ['teach-endpoint', unavailable],
      ['fast-endpoint', unavailable],
    ]),
    ...dependencies(),
  });

  const result = provider.complete({ tier: 'TEACH', system: 'Teach.', user: 'Try.' });

  await expect(result).rejects.toBeInstanceOf(AiExhaustionError);
  await expect(result).rejects.toMatchObject({
    safeMessage: 'Temporarily unavailable.',
    status: 503,
  });
  await expect(result).rejects.not.toThrow(/anthropic|openai|vendor/i);
});

it('opens after configured failures, skips calls, then closes after a successful probe', async () => {
  let nowMs = 0;
  let primaryCalls = 0;
  let primaryAvailable = false;
  const logs: Record<string, unknown>[] = [];
  const primary = providerFromComplete(() => {
    primaryCalls += 1;
    return primaryAvailable ? Promise.resolve(RESPONSE) : Promise.reject(new AiError('transport'));
  });
  const fallback = providerFromComplete(() =>
    Promise.resolve({ ...RESPONSE, endpointName: 'fast-endpoint' }),
  );
  const provider = createRoutingLlmProvider({
    config: configWithRoutes('teach-endpoint', 'fast-endpoint', 'fast-endpoint'),
    providers: new Map([
      ['teach-endpoint', primary],
      ['fast-endpoint', fallback],
    ]),
    ...dependencies({ logs, now: () => nowMs }),
  });
  const request = { tier: 'TEACH' as const, system: 'Teach.', user: 'Try.' };

  await provider.complete(request);
  await provider.complete(request);
  expect(primaryCalls).toBe(6);

  await expect(provider.complete(request)).resolves.toMatchObject({
    endpointName: 'fast-endpoint',
  });
  expect(primaryCalls).toBe(6);

  nowMs = 1_000;
  primaryAvailable = true;
  await expect(provider.complete(request)).resolves.toMatchObject({
    endpointName: 'teach-endpoint',
  });
  await provider.complete(request);
  expect(primaryCalls).toBe(8);
  expect(logs).toContainEqual(
    expect.objectContaining({
      event: 'ai.endpoint.breaker',
      from: 'closed',
      to: 'open',
      category: 'transport',
      latencyMs: 0,
    }),
  );
});
