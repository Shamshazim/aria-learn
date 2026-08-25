import type { AiConfig } from '@/ai/provider/config.schema';
import type { RoutingProviderOptions } from '@/ai/provider/routing';
import type { LlmProvider, LlmResponse } from '@/ai/provider/types';

export const RESPONSE: LlmResponse = {
  text: 'answer',
  endpointName: 'teach-endpoint',
  model: 'test-model',
  tokensIn: 1,
  tokensOut: 1,
  costUsd: 0,
  latencyMs: 1,
  finishReason: 'stop',
};

export function fakeProvider(endpointName: string, calls: string[]): LlmProvider {
  return {
    complete: () => {
      calls.push(endpointName);
      return Promise.resolve({ ...RESPONSE, endpointName });
    },
    stream: async function* () {
      await Promise.resolve();
      yield { kind: 'complete', response: { ...RESPONSE, endpointName } };
    },
  };
}

export function providerFromComplete(complete: LlmProvider['complete']): LlmProvider {
  return {
    complete,
    stream: async function* () {
      await Promise.resolve();
      yield { kind: 'complete', response: RESPONSE };
    },
  };
}

export function configWithRoutes(teach: string, fast: string, teachFallback?: string): AiConfig {
  const endpoint = {
    api: 'anthropic' as const,
    'base-url': 'https://provider.invalid',
    'api-key': 'test-key',
    model: 'test-model',
    'max-tokens': 100,
    'timeout-seconds': 1,
    'cost-per-mtok-in': 1,
    'cost-per-mtok-out': 1,
  };
  return {
    app: {
      ai: {
        routing: {
          TEACH: {
            endpoint: teach,
            ...(teachFallback === undefined ? {} : { fallback: teachFallback }),
          },
          FAST: { endpoint: fast },
        },
        endpoints: { 'teach-endpoint': endpoint, 'fast-endpoint': endpoint },
      },
    },
  };
}

type DependencyOverrides = {
  delays?: number[];
  logs?: Record<string, unknown>[];
  now?: () => number;
};

export function dependencies(
  options: DependencyOverrides = {},
): Omit<RoutingProviderOptions, 'config' | 'providers'> {
  return {
    breaker: { failureThreshold: 2, cooldownMs: 1_000 },
    now: options.now ?? (() => 0),
    random: () => 1,
    sleep: (delayMs) => {
      options.delays?.push(delayMs);
      return Promise.resolve();
    },
    logger: {
      info: (fields) => options.logs?.push(fields),
      warn: (fields) => options.logs?.push(fields),
    },
  };
}
