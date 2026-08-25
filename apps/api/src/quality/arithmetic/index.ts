import { solveRegistered } from '@/quality/arithmetic/registry';
import type { ArithmeticProblem, CheckResult } from '@/quality/arithmetic/types';

/** Checks a candidate answer by solving the structured problem independently. */
export function checkArithmetic(problem: ArithmeticProblem, candidate: string): CheckResult {
  return solveRegistered(problem, candidate);
}

/** Only a proven correct result may pass the deterministic gate. */
export function isArithmeticPass(result: CheckResult): boolean {
  return result.verdict === 'correct';
}

export { arithmeticProblemSchema } from '@/quality/arithmetic/schema';

export type {
  ArithmeticProblem,
  ArithmeticSkillCode,
  CheckResult,
} from '@/quality/arithmetic/types';
