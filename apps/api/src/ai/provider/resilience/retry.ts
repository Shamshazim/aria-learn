/** Three-attempt retry policy with injected time, sleep and randomness. */
import { AiError } from '@/ai/provider/errors';
import { isAvailabilityCategory, type ResilienceLogger } from '@/ai/provider/resilience/policy';

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 250;

export type RetryOptions = {
  endpointName: string;
  now: () => number;
  random: () => number;
  sleep: (delayMs: number) => Promise<void>;
  logger: ResilienceLogger;
  signal?: AbortSignal;
};

/** Runs one endpoint operation and retries only availability failures. */
export async function withRetry<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const startedAt = options.now();
    try {
      const value = await operation();
      options.logger.info(
        attemptLog(options.endpointName, 'success', options.now() - startedAt, attempt),
        'AI endpoint attempt succeeded',
      );
      return value;
    } catch (error) {
      const latencyMs = options.now() - startedAt;
      logFailedAttempt(options, error, latencyMs, attempt);
      if (!shouldRetry(error, attempt, options.signal)) throw error;
      const delayMs = retryDelay(error, attempt, options.random());
      options.logger.warn(
        {
          ...attemptLog(options.endpointName, error.category, latencyMs, attempt),
          event: 'ai.endpoint.retry',
          delayMs,
        },
        'Retrying AI endpoint',
      );
      await options.sleep(delayMs);
    }
  }
  throw new Error('Retry loop ended unexpectedly');
}

function logFailedAttempt(
  options: RetryOptions,
  error: unknown,
  latencyMs: number,
  attempt: number,
): void {
  options.logger.warn(
    attemptLog(
      options.endpointName,
      error instanceof AiError ? error.category : 'unknown',
      latencyMs,
      attempt,
    ),
    'AI endpoint attempt failed',
  );
}

function shouldRetry(
  error: unknown,
  attempt: number,
  signal: AbortSignal | undefined,
): error is AiError {
  return (
    attempt < MAX_ATTEMPTS &&
    signal?.aborted !== true &&
    error instanceof AiError &&
    isAvailabilityCategory(error.category)
  );
}

function retryDelay(error: AiError, attempt: number, random: number): number {
  const jitter = 0.5 + Math.min(1, Math.max(0, random)) * 0.5;
  const backoffMs = BASE_DELAY_MS * 2 ** (attempt - 1) * jitter;
  return Math.max(Math.round(backoffMs), error.retryAfterMs ?? 0);
}

function attemptLog(
  endpointName: string,
  category: string,
  latencyMs: number,
  attempt: number,
): Record<string, unknown> {
  return { event: 'ai.endpoint.attempt', endpointName, category, latencyMs, attempt };
}
