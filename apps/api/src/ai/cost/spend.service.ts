import type { AiAccounting, GenerationLogEntry, SpendReport } from '@/ai/cost/cost.types';
import { SpendCapExceededError } from '@/errors';
import type { Clock } from '@/lib/clock';
import type { AiGenerationLogRepository } from '@/repositories/ai-generation-log.repository';

export type SpendAlert = (
  event: Readonly<{
    kind: 'student_daily_cap';
    studentId: string;
    spendUsd: number;
    capUsd: number;
  }>,
) => void;

export type SpendService = AiAccounting & Readonly<{ report(): Promise<SpendReport> }>;

export function createSpendService(dependencies: {
  repository: AiGenerationLogRepository;
  clock: Clock;
  capUsd: number;
  alert: SpendAlert;
}): SpendService {
  return {
    assertWithinCap: (studentId) => assertWithinCap(dependencies, studentId),
    record: (entry) => dependencies.repository.insert(entry),
    recordCachedHit: (input) => dependencies.repository.insert(cachedEntry(input)),
    report: () => dependencies.repository.report(dependencies.clock.now(), dependencies.capUsd),
  };
}

async function assertWithinCap(
  dependencies: Parameters<typeof createSpendService>[0],
  studentId: string | undefined,
): Promise<void> {
  if (studentId === undefined) return;
  const spendUsd = await dependencies.repository.daySpend(studentId, dependencies.clock.now());
  if (spendUsd < dependencies.capUsd) return;
  dependencies.alert({
    kind: 'student_daily_cap',
    studentId,
    spendUsd,
    capUsd: dependencies.capUsd,
  });
  throw new SpendCapExceededError(studentId);
}

function cachedEntry(input: Parameters<AiAccounting['recordCachedHit']>[0]): GenerationLogEntry {
  return {
    studentId: input.studentId,
    endpointName: 'verified-cache',
    model: 'none',
    tier: input.tier,
    promptName: input.promptName ?? null,
    promptVersion: input.promptVersion ?? null,
    tokensIn: 0,
    tokensOut: 0,
    latencyMs: 0,
    costUsd: 0,
    cached: true,
    ok: true,
  };
}
