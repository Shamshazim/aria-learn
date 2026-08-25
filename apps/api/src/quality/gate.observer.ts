import type { Band } from '@aria/shared';

import type { GateCheckName, GateInput, GateVerdict } from '@/quality/gate.types';

/**
 * One rejection, flattened for logging and metrics (P2H-02).
 *
 * It carries no child-facing text: a rejection log must be safe to ship to an aggregator, and
 * the text that failed is already in the generation log behind the privacy boundary.
 */
export type GateRejection = Readonly<{
  id: string;
  band: Band;
  inputKind: GateInput['kind'];
  check: GateCheckName;
  code: string;
  codes: readonly string[];
  message: string;
}>;

export type GateObserver = (rejection: GateRejection) => void;

export function rejectionOf(input: GateInput, verdict: GateVerdict): GateRejection | null {
  if (verdict.verdict === 'pass') return null;
  const first = verdict.reasons[0];
  if (first === undefined) return null;
  return {
    id: input.id,
    band: input.band,
    inputKind: input.kind,
    check: first.check,
    code: first.code,
    codes: verdict.reasons.map((reason) => reason.code),
    message: first.message,
  };
}
