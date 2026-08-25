import type { ModelTier } from '@/ai/provider';

export type GenerationLogEntry = Readonly<{
  studentId: string | null;
  endpointName: string;
  model: string;
  tier: ModelTier;
  promptName: string | null;
  promptVersion: string | null;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  costUsd: number;
  cached: boolean;
  ok: boolean;
}>;

export type SpendSummary = Readonly<{
  studentId: string;
  dayUsd: number;
  monthUsd: number;
}>;

export type AiAccounting = Readonly<{
  assertWithinCap(studentId: string | undefined): Promise<void>;
  record(entry: GenerationLogEntry): Promise<void>;
  recordCachedHit(
    input: Readonly<{
      studentId: string;
      tier: ModelTier;
      promptName?: string;
      promptVersion?: string;
    }>,
  ): Promise<void>;
}>;

export type SpendReport = Readonly<{
  totalTodayUsd: number;
  studentsAtCap: number;
  students: readonly SpendSummary[];
}>;
