import type { GateCheckName, GateCheckResult, GateFailureReason } from '@/quality/gate.types';

export function passed(check: GateCheckName): GateCheckResult {
  return { check, passed: true, reasons: [] };
}

export function failed(check: GateCheckName, code: string, message: string): GateCheckResult {
  const reason: GateFailureReason = { check, code, message };
  return { check, passed: false, reasons: [reason] };
}

export function failedMany(
  check: GateCheckName,
  reasons: readonly Omit<GateFailureReason, 'check'>[],
): GateCheckResult {
  return { check, passed: false, reasons: reasons.map((reason) => ({ check, ...reason })) };
}
