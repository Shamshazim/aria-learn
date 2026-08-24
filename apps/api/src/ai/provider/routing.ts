/** Selects configured primary/fallback endpoints behind the shared LLM provider interface. */
import type { AiConfig } from '@/ai/provider/config.schema';
import { AiError, AiExhaustionError } from '@/ai/provider/errors';
import { createEndpointProviders, type EndpointProviderDependencies } from '@/ai/provider/factory';
import {
  createEndpointRunner,
  type EndpointRunner,
  type EndpointRunnerOptions,
} from '@/ai/provider/resilience/endpoint-runner';
import { isAvailabilityCategory } from '@/ai/provider/resilience/policy';
import type { LlmProvider, LlmRequest, LlmResponse, StreamChunk } from '@/ai/provider/types';

export type RoutingProviderOptions = { config: AiConfig } & EndpointRunnerOptions;

export type RoutedProviderDependencies = EndpointProviderDependencies &
  Omit<RoutingProviderOptions, 'config' | 'providers'>;

type Route = AiConfig['app']['ai']['routing']['TEACH'];
type FallbackRoute = { endpoint: string; fallback: string };
type RoutingRuntime = {
  config: AiConfig;
  endpointRunner: EndpointRunner;
  now: () => number;
  logger: EndpointRunnerOptions['logger'];
};

/** Boot-time composition: callers receive routing, never a raw vendor adapter. */
export function createRoutedLlmProvider(
  config: AiConfig,
  dependencies: RoutedProviderDependencies,
): LlmProvider {
  const providers = createEndpointProviders(config, {
    fetch: dependencies.fetch,
    now: dependencies.now,
  });
  return createRoutingLlmProvider({ config, providers, ...dependencies });
}

/** Creates the routed provider used by callers; endpoint choice remains entirely in config. */
export function createRoutingLlmProvider(options: RoutingProviderOptions): LlmProvider {
  const runtime: RoutingRuntime = {
    config: options.config,
    endpointRunner: createEndpointRunner(options),
    now: options.now,
    logger: options.logger,
  };
  return {
    complete: (request) => complete(runtime, request),
    stream: (request) => stream(runtime, request),
  };
}

async function complete(options: RoutingRuntime, request: LlmRequest): Promise<LlmResponse> {
  const route = routeFor(options, request);
  const startedAt = options.now();
  try {
    return await options.endpointRunner.complete(route.endpoint, request);
  } catch (error) {
    if (isAborted(request) || !isAvailabilityError(error)) throw error;
    if (route.fallback === undefined) throw new AiExhaustionError(error);
    logFallback(options, { endpoint: route.endpoint, fallback: route.fallback }, error, startedAt);
    try {
      return await options.endpointRunner.complete(route.fallback, request);
    } catch (fallbackError) {
      if (isAborted(request) || !isAvailabilityError(fallbackError)) throw fallbackError;
      throw new AiExhaustionError(fallbackError);
    }
  }
}

async function* stream(options: RoutingRuntime, request: LlmRequest): AsyncIterable<StreamChunk> {
  const route = routeFor(options, request);
  const startedAt = options.now();
  let emitted = false;
  try {
    for await (const chunk of options.endpointRunner.stream(route.endpoint, request)) {
      emitted = true;
      yield chunk;
    }
    return;
  } catch (error) {
    const failure = availabilityStreamFailure(request, error);
    if (emitted || route.fallback === undefined) throw new AiExhaustionError(failure);
    logFallback(
      options,
      { endpoint: route.endpoint, fallback: route.fallback },
      failure,
      startedAt,
    );
  }

  try {
    for await (const chunk of options.endpointRunner.stream(route.fallback, request)) {
      yield chunk;
    }
  } catch (error) {
    throw new AiExhaustionError(availabilityStreamFailure(request, error));
  }
}

function routeFor(options: RoutingRuntime, request: LlmRequest): Route {
  return options.config.app.ai.routing[request.tier];
}

function isAvailabilityError(error: unknown): error is AiError {
  return error instanceof AiError && isAvailabilityCategory(error.category);
}

function isAborted(request: LlmRequest): boolean {
  return request.signal?.aborted === true;
}

function availabilityStreamFailure(request: LlmRequest, error: unknown): AiError {
  if (isAborted(request) || !isAvailabilityError(error)) throw error;
  return error;
}

function logFallback(
  options: RoutingRuntime,
  route: FallbackRoute,
  error: AiError,
  startedAt: number,
): void {
  options.logger.warn(
    {
      event: 'ai.endpoint.fallback',
      endpointName: route.fallback,
      fromEndpointName: route.endpoint,
      category: error.category,
      latencyMs: options.now() - startedAt,
    },
    'Switching AI endpoint',
  );
}
