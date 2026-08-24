import { checkCorrectness } from '@/quality/checks/correctness.check';
import { checkLevel } from '@/quality/checks/level.check';
import { checkSafety } from '@/quality/checks/safety.check';
import { checkStructural } from '@/quality/checks/structural.check';
import {
  GATE_PASS_BRAND,
  type GateCheckResult,
  type GateInput,
  type GateVerdict,
  type SafetyChecker,
} from '@/quality/gate.types';

export type QualityGate = (input: GateInput) => GateVerdict;

/** Builds the single ordered gate every child-facing content path must call. */
export function createQualityGate(safetyChecker: SafetyChecker): QualityGate {
  return (input) => runChecks(input, safetyChecker);
}

function runChecks(input: GateInput, safetyChecker: SafetyChecker): GateVerdict {
  const checks: readonly ((value: GateInput) => GateCheckResult)[] = [
    checkStructural,
    checkCorrectness,
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
