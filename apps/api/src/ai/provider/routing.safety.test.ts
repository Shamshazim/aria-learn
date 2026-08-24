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
