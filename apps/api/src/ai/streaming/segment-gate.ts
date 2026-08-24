import type { QualityGate } from '@/quality';
import type { GateFailureReason, GateInput } from '@/quality';

export type SegmentGateResult =
  | Readonly<{ passed: true; gateMs: number }>
  | Readonly<{ passed: false; gateMs: number; reasons: readonly GateFailureReason[] }>;

export function gateSegment(
  gate: QualityGate,
  input: GateInput,
  now: () => number,
): SegmentGateResult {
  const startedAt = now();
  const verdict = gate(input);
  const gateMs = Math.max(0, now() - startedAt);
  return verdict.verdict === 'pass'
    ? { passed: true, gateMs }
    : { passed: false, gateMs, reasons: verdict.reasons };
}
