import { registerFailures } from '@/quality/checks/level/register';
import type { QualityGate } from '@/quality/gate';
import type { GateCheckResult, GateInput, GateVerdict } from '@/quality/gate.types';

/**
 * The gate a sentence has to pass on its way out of a stream (P2H-07).
 *
 * It is the child-facing gate plus the register rules (P2H-03). Buffered generation gets to
 * look at a whole answer before anyone hears it and applies register there; a streamed sentence
 * has no later moment, so the two checks happen together or the register rule does not happen
 * at all. Only model prose goes through here — a reviewed sentence is deliberately allowed to
 * be longer or warmer than the register would permit.
 */
export function speakableGate(gate: QualityGate): QualityGate {
  return (input: GateInput) => {
    const verdict = gate(input);
    return verdict.verdict === 'pass' ? withRegister(verdict, input) : verdict;
  };
}

function withRegister(
  verdict: Extract<GateVerdict, { verdict: 'pass' }>,
  input: GateInput,
): GateVerdict {
  const reasons = registerFailures(input.childText, input.band).map((failure) => ({
    check: 'level' as const,
    ...failure,
  }));
  if (reasons.length === 0) return verdict;
  const checks: readonly GateCheckResult[] = [
    ...verdict.checks.filter((check) => check.check !== 'level'),
    { check: 'level', passed: false, reasons },
  ];
  return { verdict: 'fail', reasons, checks };
}
