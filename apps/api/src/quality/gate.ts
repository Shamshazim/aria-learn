import { checkClaims } from '@/quality/checks/claims.check';
import { checkCorrectness } from '@/quality/checks/correctness.check';
import { checkLevel } from '@/quality/checks/level.check';
import { checkSafety } from '@/quality/checks/safety.check';
import { checkStructural } from '@/quality/checks/structural.check';
import { rejectionOf, type GateObserver } from '@/quality/gate.observer';
import {
  GATE_PASS_BRAND,
  type GateCheckResult,
  type GateInput,
  type GateVerdict,
  type SafetyChecker,
} from '@/quality/gate.types';

export type QualityGate = (input: GateInput) => GateVerdict;

/**
 * Builds the single ordered gate every child-facing content path must call.
 *
 * `observe` is called exactly once per rejection (P2H-02) so there is one structured log and
 * one `gate_rejections_total` increment per piece of content the gate refuses — never one per
 * failing reason, which would over-count a single bad sentence.
 */
export function createQualityGate(
  safetyChecker: SafetyChecker,
  observe?: GateObserver,
): QualityGate {
  return (input) => {
    const verdict = runChecks(input, safetyChecker);
    const rejection = rejectionOf(input, verdict);
    if (rejection !== null) observe?.(rejection);
    return verdict;
  };
}

function runChecks(input: GateInput, safetyChecker: SafetyChecker): GateVerdict {
  const checks: readonly ((value: GateInput) => GateCheckResult)[] = [
    checkStructural,
    checkCorrectness,
    checkClaims,
    checkLevel,
    (value) => checkSafety(value, safetyChecker),
  ];
  const completed: GateCheckResult[] = [];

  for (const check of checks) {
    const result = check(input);
    completed.push(result);
    if (!result.passed) {
      return { verdict: 'fail', reasons: result.reasons, checks: completed };
    }
  }
  return { verdict: 'pass', pass: { verdict: 'pass', [GATE_PASS_BRAND]: true }, checks: completed };
}
