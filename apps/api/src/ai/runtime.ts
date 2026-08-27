import { createAiClient } from '@/ai/client/ai-client';
import type { AiClient } from '@/ai/client/ai-client.types';
import { createSpendService, type SpendService } from '@/ai/cost';
import { bootstrapRoutedProvider, type AiConfig } from '@/ai/provider';
import { createGatedStreamer, type GatedStreamer } from '@/ai/streaming';
import type { AppConfig } from '@/config';
import type { Queryable } from '@/db';
import type { Clock } from '@/lib/clock';
import type { IdGenerator } from '@/lib/ids';
import type { Logger } from '@/lib/logger';
import type { QualityGate } from '@/quality';
import { createAiGenerationLogRepository } from '@/repositories/ai-generation-log.repository';
import { createStatusService, type StatusService } from '@/services/status.service';

export type AiRuntime = Readonly<{
  client: AiClient;
  spend: SpendService;
  status: StatusService;
  /**
   * P2H-07: a sentence-at-a-time streamer, once someone brings the gate it must pass.
   *
   * The routed provider is private to this module, and the quality gate is built where the
   * content services are. Handing back a factory is what lets the two meet without either one
   * reaching into the other.
   */
  gatedStreamer(gate: QualityGate): GatedStreamer;
}>;

const BREAKER_FAILURES = 3;
const BREAKER_COOLDOWN_MS = 30_000;

export async function createAiRuntime(dependencies: {
  aiConfig: AiConfig;
  appConfig: AppConfig;
  db: Queryable;
  ids: IdGenerator;
  clock: Clock;
  logger: Logger;
  fetch: typeof globalThis.fetch;
}): Promise<AiRuntime> {
  const repository = createAiGenerationLogRepository({
    db: dependencies.db,
    ids: dependencies.ids,
  });
  const spend = createSpendService({
    repository,
    clock: dependencies.clock,
    capUsd: dependencies.appConfig.aiDailySpendCapUsd,
    alert: (event) => {
      dependencies.logger.warn(event, 'Student daily AI spend cap reached');
    },
  });
  const now = (): number => dependencies.clock.now().getTime();
  const routed = await bootstrapRoutedProvider(dependencies.aiConfig, {
    fetch: dependencies.fetch,
    breaker: { failureThreshold: BREAKER_FAILURES, cooldownMs: BREAKER_COOLDOWN_MS },
    now,
    random: Math.random,
    sleep: (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
    logger: dependencies.logger,
    accounting: spend,
    isProduction: dependencies.appConfig.isProduction,
  });
  return {
    client: createAiClient({ provider: routed.provider, accounting: spend, now }),
    gatedStreamer: (gate) =>
      createGatedStreamer({
        provider: routed.provider,
        gate,
        now,
        callNow: now,
        accounting: spend,
      }),
    spend,
    status: createStatusService({
      endpointNames: routed.endpointNames,
      health: routed.health,
      breakers: { get: (endpointName) => routed.provider.endpointStatus(endpointName) },
      spend,
    }),
  };
}
