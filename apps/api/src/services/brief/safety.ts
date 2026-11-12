import type { QualityGate } from '@/quality';

/**
 * The P0-18 safety check, applied to a brief (P3-03). Only the safety check: the gate's other
 * checks — reading level, claims — are about text a child reads, and a brief is for a parent.
 */
export function briefIsSafe(gate: QualityGate, text: string): boolean {
  const verdict = gate({
    id: 'learner-brief',
    kind: 'text',
    band: 'senior',
    childText: text,
    factual: false,
    grounding: 'unsupported',
  });
  return verdict.checks.every((check) => check.check !== 'safety' || check.passed);
}
