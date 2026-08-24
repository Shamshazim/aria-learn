import type { AiAccounting, GenerationLogEntry } from '@/ai/cost';
import type { AiConfig } from '@/ai/provider/config.schema';
import { createEndpointProviders, routedEndpointNames } from '@/ai/provider/factory';
import {
  createRoutingLlmProvider,
  type RoutedLlmProvider,
  type RoutedProviderDependencies,
} from '@/ai/provider/routing';
import type { LlmProvider, LlmResponse } from '@/ai/provider/types';

export type EndpointProbe = Readonly<{
  reachable: boolean;
  lastProbeLatencyMs: number;
}>;

export type EndpointHealthReader = Readonly<{
  get(endpointName: string): EndpointProbe | undefined;
}>;

export type EndpointHealthMonitor = EndpointHealthReader &
  Readonly<{
    record(endpointName: string, probe: EndpointProbe): void;
  }>;

type ProbeLogger = Readonly<{
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
}>;

export class EndpointHealthError extends Error {
  constructor(readonly endpointNames: readonly string[]) {
    super(`AI endpoint health probe failed: ${endpointNames.join(', ')}`);
    this.name = 'EndpointHealthError';
  }
}

export function createEndpointHealthMonitor(): EndpointHealthMonitor {
  const probes = new Map<string, EndpointProbe>();
  return {
    get: (endpointName) => probes.get(endpointName),
    record: (endpointName, probe) => {
      probes.set(endpointName, probe);
    },
  };
}

export async function bootstrapRoutedProvider(
  config: AiConfig,
  dependencies: RoutedProviderDependencies &
    Readonly<{ accounting: AiAccounting; isProduction: boolean }>,
): Promise<
  Readonly<{
    provider: RoutedLlmProvider;
    health: EndpointHealthReader;
    endpointNames: readonly string[];
  }>
> {
  const providers = createEndpointProviders(config, {
    fetch: dependencies.fetch,
    now: dependencies.now,
  });
  const provider = createRoutingLlmProvider({ config, providers, ...dependencies });
  const health = createEndpointHealthMonitor();
  await probeRoutedEndpoints({
    config,
    providers,
    accounting: dependencies.accounting,
    monitor: health,
    now: dependencies.now,
    logger: dependencies.logger,
    isProduction: dependencies.isProduction,
  });
  return { provider, health, endpointNames: [...routedEndpointNames(config)] };
}

export async function probeRoutedEndpoints(dependencies: {
  config: AiConfig;
  providers: ReadonlyMap<string, LlmProvider>;
  accounting: AiAccounting;
  monitor: EndpointHealthMonitor;
  now: () => number;
  logger: ProbeLogger;
  isProduction: boolean;
}): Promise<void> {
  const failed: string[] = [];
  for (const endpointName of routedEndpointNames(dependencies.config)) {
    const reachable = await probeEndpoint(endpointName, dependencies);
    if (!reachable) failed.push(endpointName);
  }
  if (dependencies.isProduction && failed.length > 0) throw new EndpointHealthError(failed);
}

async function probeEndpoint(
  endpointName: string,
  dependencies: Parameters<typeof probeRoutedEndpoints>[0],
): Promise<boolean> {
  const startedAt = dependencies.now();
  try {
    const provider = dependencies.providers.get(endpointName);
    if (provider === undefined) throw new Error('Routed endpoint provider is missing');
    const response = await provider.complete({
      tier: 'FAST',
      system: 'Return only OK.',
      user: 'Health check.',
      maxTokens: 1,
      temperature: 0,
    });
    const latencyMs = Math.max(0, dependencies.now() - startedAt);
    dependencies.monitor.record(endpointName, { reachable: true, lastProbeLatencyMs: latencyMs });
    await dependencies.accounting.record(probeEntry(response, latencyMs, true));
    dependencies.logger.info(
      { event: 'ai.endpoint.probe', endpointName, reachable: true, latencyMs },
      'AI endpoint reachable',
    );
    return true;
  } catch {
    const latencyMs = Math.max(0, dependencies.now() - startedAt);
    dependencies.monitor.record(endpointName, { reachable: false, lastProbeLatencyMs: latencyMs });
    await dependencies.accounting.record(failedProbeEntry(endpointName, latencyMs));
    dependencies.logger.warn(
      { event: 'ai.endpoint.probe', endpointName, reachable: false, latencyMs },
      'AI endpoint health probe failed',
    );
    return false;
  }
}

function probeEntry(response: LlmResponse, latencyMs: number, ok: boolean): GenerationLogEntry {
  return {
    studentId: null,
    endpointName: response.endpointName,
    model: response.model,
    tier: 'FAST',
    promptName: 'startup-health',
    promptVersion: '1',
    tokensIn: response.tokensIn,
    tokensOut: response.tokensOut,
    latencyMs,
    costUsd: response.costUsd,
    cached: false,
    ok,
  };
}

function failedProbeEntry(endpointName: string, latencyMs: number): GenerationLogEntry {
  return {
    studentId: null,
    endpointName,
    model: 'unavailable',
    tier: 'FAST',
    promptName: 'startup-health',
    promptVersion: '1',
    tokensIn: 0,
    tokensOut: 0,
    latencyMs,
    costUsd: 0,
    cached: false,
    ok: false,
  };
}
