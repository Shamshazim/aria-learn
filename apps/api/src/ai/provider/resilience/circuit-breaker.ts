/** Per-endpoint closed/open/half-open state machine with an injected clock. */
import type { AiErrorCategory } from '@/ai/provider/errors';
import type { CircuitBreakerConfig } from '@/ai/provider/resilience/policy';

const MAX_FAILURE_THRESHOLD = 100;
const MAX_COOLDOWN_MS = 24 * 60 * 60 * 1_000;

type CircuitState =
  { kind: 'closed'; failures: number } | { kind: 'open'; openedAt: number } | { kind: 'half-open' };

export type CircuitTransition = {
  endpointName: string;
  from: CircuitState['kind'];
  to: CircuitState['kind'];
  category: AiErrorCategory | 'cancelled' | 'probe' | 'success' | 'unknown';
  latencyMs: number;
};

export type CircuitObservation = Pick<CircuitTransition, 'category' | 'latencyMs'>;

export type CircuitBreaker = {
  tryAcquire: (endpointName: string) => boolean;
  recordSuccess: (endpointName: string, latencyMs: number) => void;
  recordFailure: (endpointName: string, observation: CircuitObservation) => void;
  recordIndeterminate: (endpointName: string, observation: CircuitObservation) => void;
};

export type CircuitBreakerDependencies = {
  now: () => number;
  onTransition: (transition: CircuitTransition) => void;
};

type CircuitContext = {
  states: Map<string, CircuitState>;
  config: CircuitBreakerConfig;
  dependencies: CircuitBreakerDependencies;
};

export function createCircuitBreaker(
  config: CircuitBreakerConfig,
  dependencies: CircuitBreakerDependencies,
): CircuitBreaker {
  validateConfig(config);
  const context: CircuitContext = { states: new Map(), config, dependencies };

  return {
    tryAcquire: (endpointName) => tryAcquire(endpointName, context),
    recordSuccess: (endpointName, latencyMs) => {
      recordSuccess(endpointName, latencyMs, context);
    },
    recordFailure: (endpointName, observation) => {
      recordFailure(endpointName, observation, context);
    },
    recordIndeterminate: (endpointName, observation) => {
      recordIndeterminate(endpointName, observation, context);
    },
  };
}

function tryAcquire(endpointName: string, context: CircuitContext): boolean {
  const state = context.states.get(endpointName) ?? { kind: 'closed', failures: 0 };
  if (state.kind === 'closed') return true;
  if (state.kind === 'half-open') return false;
  if (context.dependencies.now() - state.openedAt < context.config.cooldownMs) return false;
  transition(
    endpointName,
    { from: state, to: { kind: 'half-open' } },
    { category: 'probe', latencyMs: 0 },
    context,
  );
  return true;
}

function recordSuccess(endpointName: string, latencyMs: number, context: CircuitContext): void {
  const state = context.states.get(endpointName);
  const closed: CircuitState = { kind: 'closed', failures: 0 };
  if (state?.kind === 'half-open') {
    transition(
      endpointName,
      { from: state, to: closed },
      { category: 'success', latencyMs },
      context,
    );
  } else context.states.set(endpointName, closed);
}

function recordFailure(
  endpointName: string,
  observation: CircuitObservation,
  context: CircuitContext,
): void {
  const state = context.states.get(endpointName) ?? { kind: 'closed', failures: 0 };
  if (state.kind === 'open') return;
  if (state.kind === 'half-open') {
    transition(endpointName, { from: state, to: openState(context) }, observation, context);
    return;
  }
  const failures = state.failures + 1;
  if (failures < context.config.failureThreshold) {
    context.states.set(endpointName, { kind: 'closed', failures });
    return;
  }
  transition(endpointName, { from: state, to: openState(context) }, observation, context);
}

function recordIndeterminate(
  endpointName: string,
  observation: CircuitObservation,
  context: CircuitContext,
): void {
  const state = context.states.get(endpointName);
  if (state?.kind !== 'half-open') return;
  transition(endpointName, { from: state, to: openState(context) }, observation, context);
}

function openState(context: CircuitContext): CircuitState {
  return { kind: 'open', openedAt: context.dependencies.now() };
}

function transition(
  endpointName: string,
  change: { from: CircuitState; to: CircuitState },
  observation: CircuitObservation,
  context: CircuitContext,
): void {
  context.states.set(endpointName, change.to);
  context.dependencies.onTransition({
    endpointName,
    from: change.from.kind,
    to: change.to.kind,
    ...observation,
  });
}

function validateConfig(config: CircuitBreakerConfig): void {
  const validThreshold =
    Number.isSafeInteger(config.failureThreshold) &&
    config.failureThreshold > 0 &&
    config.failureThreshold <= MAX_FAILURE_THRESHOLD;
  const validCooldown =
    Number.isSafeInteger(config.cooldownMs) &&
    config.cooldownMs >= 0 &&
    config.cooldownMs <= MAX_COOLDOWN_MS;
  if (!validThreshold || !validCooldown) {
    throw new Error('Invalid AI circuit breaker configuration');
  }
}
