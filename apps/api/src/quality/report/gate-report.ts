import type { GateFailureReason, GateVerdict } from '@/quality/gate.types';

export type GateReport = Readonly<{
  passed: number;
  failed: number;
  failuresByCheck: Readonly<Record<string, number>>;
  reasons: readonly GateFailureReason[];
}>;

/** Aggregates structured gate failures for the P0-21 content harness. */
export function buildGateReport(verdicts: readonly GateVerdict[]): GateReport {
  const reasons = verdicts.flatMap((verdict) =>
    verdict.verdict === 'fail' ? verdict.reasons : [],
  );
  const failuresByCheck: Record<string, number> = {};
  for (const reason of reasons) {
    failuresByCheck[reason.check] = (failuresByCheck[reason.check] ?? 0) + 1;
  }
  return {
    passed: verdicts.filter((verdict) => verdict.verdict === 'pass').length,
    failed: verdicts.filter((verdict) => verdict.verdict === 'fail').length,
    failuresByCheck,
    reasons,
  };
}
