import { expect, it } from 'vitest';

import {
  RESPONSE,
  configWithRoutes,
  dependencies,
  providerFromComplete,
} from '@/ai/provider/__fixtures__/routing.fixtures';
import { AiError } from '@/ai/provider/errors';
import { createRoutingLlmProvider } from '@/ai/provider/routing';

it('logs attempts and retries with safe operational fields only', async () => {
  let attempts = 0;
  const logs: Record<string, unknown>[] = [];
  const provider = createRoutingLlmProvider({
    config: configWithRoutes('teach-endpoint', 'teach-endpoint'),
    providers: new Map([
      [
        'teach-endpoint',
        providerFromComplete(() => {
          attempts += 1;
          return attempts === 1
            ? Promise.reject(new AiError('rate_limit'))
            : Promise.resolve(RESPONSE);
        }),
      ],
    ]),
    ...dependencies({ logs }),
  });

  await provider.complete({
    tier: 'TEACH',
    system: 'Private system prompt for Priya.',
    user: 'Private child answer.',
  });

  expect(logs.map((entry) => entry.event)).toEqual([
    'ai.endpoint.attempt',
    'ai.endpoint.retry',
    'ai.endpoint.attempt',
  ]);
  expect(logs.every((entry) => 'endpointName' in entry && 'latencyMs' in entry)).toBe(true);
  expect(JSON.stringify(logs)).not.toMatch(/Priya|Private child answer|Private system prompt/);
});

it('does not retry or fall back after the caller aborts', async () => {
  const controller = new AbortController();
  controller.abort();
  let primaryCalls = 0;
  let fallbackCalls = 0;
  const provider = createRoutingLlmProvider({
    config: configWithRoutes('teach-endpoint', 'fast-endpoint', 'fast-endpoint'),
    providers: new Map([
      [
        'teach-endpoint',
        providerFromComplete(() => {
          primaryCalls += 1;
          return Promise.reject(new AiError('transport'));
        }),
      ],
      [
        'fast-endpoint',
        providerFromComplete(() => {
          fallbackCalls += 1;
          return Promise.resolve(RESPONSE);
        }),
      ],
    ]),
    ...dependencies(),
  });

  await expect(
    provider.complete({
      tier: 'TEACH',
      system: 'Teach.',
      user: 'Try.',
      signal: controller.signal,
    }),
  ).rejects.toMatchObject({ category: 'transport' });
  expect(primaryCalls).toBe(1);
  expect(fallbackCalls).toBe(0);
});

it('does not close a half-open breaker when its probe is aborted', async () => {
  let nowMs = 0;
  let primaryCalls = 0;
  const unavailable = providerFromComplete(() => {
    primaryCalls += 1;
    return Promise.reject(new AiError('transport'));
  });
  const fallback = providerFromComplete(() =>
    Promise.resolve({ ...RESPONSE, endpointName: 'fast-endpoint' }),
  );
  const provider = createRoutingLlmProvider({
    config: configWithRoutes('teach-endpoint', 'fast-endpoint', 'fast-endpoint'),
    providers: new Map([
      ['teach-endpoint', unavailable],
      ['fast-endpoint', fallback],
    ]),
    ...dependencies({ now: () => nowMs }),
  });
  const request = { tier: 'TEACH' as const, system: 'Teach.', user: 'Try.' };

  await provider.complete(request);
  await provider.complete(request);
  expect(primaryCalls).toBe(6);

  nowMs = 1_000;
  const controller = new AbortController();
  controller.abort();
  await expect(provider.complete({ ...request, signal: controller.signal })).rejects.toMatchObject({
    category: 'transport',
  });
  expect(primaryCalls).toBe(7);

  await expect(provider.complete(request)).resolves.toMatchObject({
    endpointName: 'fast-endpoint',
  });
  expect(primaryCalls).toBe(7);
});

it('does not close a half-open breaker after an indeterminate probe failure', async () => {
  let nowMs = 0;
  let primaryCalls = 0;
  let failIndeterminately = false;
  const primary = providerFromComplete(() => {
    primaryCalls += 1;
    return Promise.reject(
      failIndeterminately ? new Error('Unexpected provider failure') : new AiError('transport'),
    );
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
    ...dependencies({ now: () => nowMs }),
  });
  const request = { tier: 'TEACH' as const, system: 'Teach.', user: 'Try.' };

  await provider.complete(request);
  await provider.complete(request);
  expect(primaryCalls).toBe(6);

  nowMs = 1_000;
  failIndeterminately = true;
  await expect(provider.complete(request)).rejects.toThrow('Unexpected provider failure');
  expect(primaryCalls).toBe(7);

  failIndeterminately = false;
  await expect(provider.complete(request)).resolves.toMatchObject({
    endpointName: 'fast-endpoint',
  });
  expect(primaryCalls).toBe(7);
});
