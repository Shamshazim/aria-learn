/** Executes one named endpoint with retry and circuit-breaker policy. */
import { AiError } from '@/ai/provider/errors';
import {
  createCircuitBreaker,
  type CircuitBreaker,
} from '@/ai/provider/resilience/circuit-breaker';
import {
  isAvailabilityCategory,
  type CircuitBreakerConfig,
  type ResilienceLogger,
} from '@/ai/provider/resilience/policy';
import { withRetry } from '@/ai/provider/resilience/retry';
import type { LlmProvider, LlmRequest, LlmResponse, StreamChunk } from '@/ai/provider/types';

export type EndpointRunnerOptions = {
  providers: ReadonlyMap<string, LlmProvider>;
  breaker: CircuitBreakerConfig;
  now: () => number;
  random: () => number;
  sleep: (delayMs: number) => Promise<void>;
  logger: ResilienceLogger;
};

export type EndpointRunner = {
  complete: (endpointName: string, request: LlmRequest) => Promise<LlmResponse>;
  stream: (endpointName: string, request: LlmRequest) => AsyncIterable<StreamChunk>;
};

type RunnerRuntime = EndpointRunnerOptions & { circuitBreaker: CircuitBreaker };
type StartedStream = {
  iterator: AsyncIterator<StreamChunk>;
  first: IteratorResult<StreamChunk>;
};

export function createEndpointRunner(options: EndpointRunnerOptions): EndpointRunner {
  const runtime: RunnerRuntime = {
    ...options,
    circuitBreaker: createCircuitBreaker(options.breaker, {
      now: options.now,
      onTransition: (transition) => {
        options.logger.info(
          { event: 'ai.endpoint.breaker', ...transition },
          'AI endpoint circuit changed state',
        );
      },
    }),
  };
  return {
    complete: (endpointName, request) => complete(runtime, endpointName, request),
    stream: (endpointName, request) => stream(runtime, endpointName, request),
  };
}

function complete(
  options: RunnerRuntime,
  endpointName: string,
  request: LlmRequest,
): Promise<LlmResponse> {
  const startedAt = options.now();
  if (!acquireEndpoint(options, endpointName)) return Promise.reject(new AiError('transport'));
  const provider = endpointFor(options, endpointName);
  return withRetry(
    () => provider.complete(request),
    retryOptions(options, endpointName, request.signal),
  ).then(
    (response) => {
      options.circuitBreaker.recordSuccess(endpointName, options.now() - startedAt);
      return response;
    },
    (error: unknown) => {
      recordEndpointError(options, endpointName, error, {
        signal: request.signal,
        latencyMs: options.now() - startedAt,
      });
      throw error;
    },
  );
}

async function* stream(
  options: RunnerRuntime,
  endpointName: string,
  request: LlmRequest,
): AsyncIterable<StreamChunk> {
  const startedAt = options.now();
  if (!acquireEndpoint(options, endpointName)) throw new AiError('transport');
  const provider = endpointFor(options, endpointName);
  let outcomeRecorded = false;
  try {
    const started = await withRetry(
      () => startStream(provider, request),
      retryOptions(options, endpointName, request.signal),
    );
    let next = started.first;
    while (!next.done) {
      yield next.value;
      next = await started.iterator.next();
    }
  } catch (error) {
    recordEndpointError(options, endpointName, error, {
      signal: request.signal,
      latencyMs: options.now() - startedAt,
    });
    outcomeRecorded = true;
    throw error;
  } finally {
    if (!outcomeRecorded) {
      options.circuitBreaker.recordSuccess(endpointName, options.now() - startedAt);
    }
  }
}

async function startStream(provider: LlmProvider, request: LlmRequest): Promise<StartedStream> {
  const iterator = provider.stream(request)[Symbol.asyncIterator]();
  return { iterator, first: await iterator.next() };
}

function endpointFor(options: RunnerRuntime, endpointName: string): LlmProvider {
  const provider = options.providers.get(endpointName);
  if (provider === undefined) throw new Error('Routed AI endpoint was not constructed');
  return provider;
}

function acquireEndpoint(options: RunnerRuntime, endpointName: string): boolean {
  if (options.circuitBreaker.tryAcquire(endpointName)) return true;
  options.logger.warn(
    {
      event: 'ai.endpoint.breaker-skip',
      endpointName,
      category: 'transport',
      latencyMs: 0,
    },
    'Skipping unavailable AI endpoint',
  );
  return false;
}

function recordEndpointError(
  options: RunnerRuntime,
  endpointName: string,
  error: unknown,
  outcome: { signal: AbortSignal | undefined; latencyMs: number },
): void {
  if (outcome.signal?.aborted === true) {
    options.circuitBreaker.recordIndeterminate(endpointName, {
      category: 'cancelled',
      latencyMs: outcome.latencyMs,
    });
  } else if (error instanceof AiError && isAvailabilityCategory(error.category)) {
    options.circuitBreaker.recordFailure(endpointName, {
      category: error.category,
      latencyMs: outcome.latencyMs,
    });
  } else if (error instanceof AiError) {
    options.circuitBreaker.recordSuccess(endpointName, outcome.latencyMs);
  } else {
    options.circuitBreaker.recordIndeterminate(endpointName, {
      category: 'unknown',
      latencyMs: outcome.latencyMs,
    });
  }
}

function retryOptions(
  options: EndpointRunnerOptions,
  endpointName: string,
  signal: AbortSignal | undefined,
) {
  return {
    endpointName,
    now: options.now,
    random: options.random,
    sleep: options.sleep,
    logger: options.logger,
    ...(signal === undefined ? {} : { signal }),
  };
}
