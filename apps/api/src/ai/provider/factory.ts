/** Builds exactly one adapter for each endpoint referenced by routing configuration. */
import { createAnthropicProvider } from '@/ai/provider/adapters/anthropic';
import { createOpenAiCompatibleProvider } from '@/ai/provider/adapters/openai-compatible';
import { AiConfigError } from '@/ai/provider/config';
import type { AiConfig } from '@/ai/provider/config.schema';
import type { LlmProvider } from '@/ai/provider/types';

type ConfiguredEndpoint = NonNullable<AiConfig['app']['ai']['endpoints'][string]>;
type ResolvedEndpoint = Omit<ConfiguredEndpoint, 'api-key'> & { 'api-key': string };

export type EndpointProviderDependencies = {
  fetch: typeof globalThis.fetch;
  now: () => number;
};

type AdapterFactory = (
  endpointName: string,
  endpoint: ResolvedEndpoint,
  dependencies: EndpointProviderDependencies,
) => LlmProvider;

const ADAPTER_FACTORIES: Record<ConfiguredEndpoint['api'], AdapterFactory> = {
  anthropic: (endpointName, endpoint, dependencies) =>
    createAnthropicProvider({
      endpointName,
      endpoint: { ...endpoint, api: 'anthropic' },
      ...dependencies,
    }),
  openai: (endpointName, endpoint, dependencies) =>
    createOpenAiCompatibleProvider({
      endpointName,
      endpoint: { ...endpoint, api: 'openai' },
      ...dependencies,
    }),
};

export function createEndpointProviders(
  config: AiConfig,
  dependencies: EndpointProviderDependencies,
): ReadonlyMap<string, LlmProvider> {
  const providers = new Map<string, LlmProvider>();
  for (const endpointName of routedEndpointNames(config)) {
    const endpoint = resolvedEndpoint(config, endpointName);
    providers.set(
      endpointName,
      ADAPTER_FACTORIES[endpoint.api](endpointName, endpoint, dependencies),
    );
  }
  return providers;
}

function routedEndpointNames(config: AiConfig): Set<string> {
  const names = new Set<string>();
  for (const route of Object.values(config.app.ai.routing)) {
    names.add(route.endpoint);
    if (route.fallback !== undefined) names.add(route.fallback);
  }
  return names;
}

function resolvedEndpoint(config: AiConfig, endpointName: string): ResolvedEndpoint {
  const endpoint = config.app.ai.endpoints[endpointName];
  if (endpoint === undefined) {
    throw new AiConfigError(`AI endpoint "${endpointName}" is routed but not configured`);
  }
  if (endpoint['api-key'] === undefined) {
    throw new AiConfigError(`AI endpoint "${endpointName}" is routed but has no resolved api-key`);
  }
  return { ...endpoint, 'api-key': endpoint['api-key'] };
}
