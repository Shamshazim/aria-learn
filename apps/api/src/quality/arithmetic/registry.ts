import { solveAddition } from '@/quality/arithmetic/solvers/addition';
import { solveFractionComparison, solveSequence } from '@/quality/arithmetic/solvers/comparison';
import { solveFractionEquality } from '@/quality/arithmetic/solvers/fractions';
import type {
  ArithmeticProblem,
  ArithmeticSkillCode,
  CheckResult,
  Solver,
} from '@/quality/arithmetic/types';

/** Adding an arithmetic skill requires a solver and golden cases before release. */
const SKILL_SOLVERS: Readonly<Record<ArithmeticSkillCode, Solver>> = {
  'NUM.CNT.20': sequenceSolver,
  'NUM.CNT.SKIP5': sequenceSolver,
  'ADD.FACT.10': additionSolver,
  'ADD.REGROUP.2D': additionSolver,
  'FRAC.EQUAL': fractionEqualitySolver,
  'FRAC.COMPARE': fractionComparisonSolver,
};

export function solveRegistered(problem: ArithmeticProblem, candidate: string): CheckResult {
  return SKILL_SOLVERS[problem.skillCode](problem, candidate);
}

function sequenceSolver(problem: ArithmeticProblem, candidate: string): CheckResult {
  return problem.kind === 'sequence' ? solveSequence(problem, candidate) : mismatch(problem);
}

function additionSolver(problem: ArithmeticProblem, candidate: string): CheckResult {
  return problem.kind === 'addition' ? solveAddition(problem, candidate) : mismatch(problem);
}

function fractionEqualitySolver(problem: ArithmeticProblem, candidate: string): CheckResult {
  return problem.kind === 'fraction-equality'
    ? solveFractionEquality(problem, candidate)
    : mismatch(problem);
}

function fractionComparisonSolver(problem: ArithmeticProblem, candidate: string): CheckResult {
  return problem.kind === 'fraction-comparison'
    ? solveFractionComparison(problem, candidate)
    : mismatch(problem);
}

function mismatch(problem: ArithmeticProblem): CheckResult {
  return {
    verdict: 'undecidable',
    reason: `Problem kind ${problem.kind} is not valid for skill ${problem.skillCode}.`,
  };
}
