import { solveAddition } from '@/quality/arithmetic/solvers/addition';
import {
  solveFractionComparison,
  solveSequence,
  solveWholeComparison,
} from '@/quality/arithmetic/solvers/comparison';
import {
  solveDecimalComparison,
  solveDecimalOperation,
  solveDecimalPlace,
  solvePercentOf,
} from '@/quality/arithmetic/solvers/decimals';
import {
  solveEquation,
  solveExpression,
  solveExpressionValue,
} from '@/quality/arithmetic/solvers/expressions';
import {
  solveFractionMissing,
  solveFractionOperation,
} from '@/quality/arithmetic/solvers/fraction-operations';
import { solveFractionEquality } from '@/quality/arithmetic/solvers/fractions';
import {
  solveAbsoluteValue,
  solveIntegerComparison,
  solveIntegerOperation,
} from '@/quality/arithmetic/solvers/integers';
import { solveMultiplication } from '@/quality/arithmetic/solvers/multiplication';
import { solvePlaceValue } from '@/quality/arithmetic/solvers/place-value';
import {
  solveProportion,
  solveRatioMissing,
  solveUnitRate,
} from '@/quality/arithmetic/solvers/ratios';
import { solveRounding } from '@/quality/arithmetic/solvers/rounding';
import { solveSubtraction } from '@/quality/arithmetic/solvers/subtraction';
import { solveWholeDivision } from '@/quality/arithmetic/solvers/whole-division';
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
  'NUM.PV.TENS': placeValueSolver,
  'NUM.PV.HUNDREDS': placeValueSolver,
  'NUM.CMP.100': wholeComparisonSolver,
  'NUM.RND.10': roundingSolver,
  'ADD.FACT.10': additionSolver,
  'ADD.FACT.20': additionSolver,
  'ADD.REGROUP.2D': additionSolver,
  'ADD.3D': additionSolver,
  'SUB.FACT.10': subtractionSolver,
  'SUB.REGROUP.2D': subtractionSolver,
  'MUL.FACT.10': multiplicationSolver,
  'MUL.2D1D': multiplicationSolver,
  'DIV.FACT.10': divisionSolver,
  'DIV.LONG': divisionSolver,
  'FRAC.EQUAL': fractionEqualitySolver,
  'FRAC.COMPARE': fractionComparisonSolver,
  'FRAC.EQUIV': fractionMissingSolver,
  'FRAC.ADD.LIKE': fractionOperationSolver,
  'FRAC.ADD.UNLIKE': fractionOperationSolver,
  'FRAC.MUL.WHOLE': fractionOperationSolver,
  'DEC.PV': decimalPlaceSolver,
  'DEC.CMP': decimalComparisonSolver,
  'DEC.ADD': decimalOperationSolver,
  'PCT.OF': percentOfSolver,
  'INT.CMP': integerComparisonSolver,
  'INT.ABS': absoluteValueSolver,
  'INT.ADD': integerOperationSolver,
  'INT.MUL': integerOperationSolver,
  'RAT.EQUIV': ratioMissingSolver,
  'RAT.UNIT': unitRateSolver,
  'RAT.PROP': proportionSolver,
  'FRAC.DIV': fractionOperationSolver,
  'EXP.ORDER': expressionSolver,
  'EXP.EVAL': expressionValueSolver,
  'EQN.ONE': equationSolver,
  'EQN.TWO': equationSolver,
};

/** P3-07: the skills a checker exists for — what the inventory is cross-checked against at boot. */
export const CHECKED_SKILL_CODES: ReadonlySet<string> = new Set(Object.keys(SKILL_SOLVERS));

export function solveRegistered(problem: ArithmeticProblem, candidate: string): CheckResult {
  return SKILL_SOLVERS[problem.skillCode](problem, candidate);
}

function sequenceSolver(problem: ArithmeticProblem, candidate: string): CheckResult {
  return problem.kind === 'sequence' ? solveSequence(problem, candidate) : mismatch(problem);
}

function additionSolver(problem: ArithmeticProblem, candidate: string): CheckResult {
  return problem.kind === 'addition' ? solveAddition(problem, candidate) : mismatch(problem);
}

function subtractionSolver(problem: ArithmeticProblem, candidate: string): CheckResult {
  return problem.kind === 'subtraction' ? solveSubtraction(problem, candidate) : mismatch(problem);
}

function multiplicationSolver(problem: ArithmeticProblem, candidate: string): CheckResult {
  return problem.kind === 'multiplication'
    ? solveMultiplication(problem, candidate)
    : mismatch(problem);
}

function divisionSolver(problem: ArithmeticProblem, candidate: string): CheckResult {
  return problem.kind === 'division' ? solveWholeDivision(problem, candidate) : mismatch(problem);
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

function fractionMissingSolver(problem: ArithmeticProblem, candidate: string): CheckResult {
  return problem.kind === 'fraction-missing'
    ? solveFractionMissing(problem, candidate)
    : mismatch(problem);
}

function fractionOperationSolver(problem: ArithmeticProblem, candidate: string): CheckResult {
  return problem.kind === 'fraction-operation'
    ? solveFractionOperation(problem, candidate)
    : mismatch(problem);
}

function placeValueSolver(problem: ArithmeticProblem, candidate: string): CheckResult {
  return problem.kind === 'place-value' ? solvePlaceValue(problem, candidate) : mismatch(problem);
}

function wholeComparisonSolver(problem: ArithmeticProblem, candidate: string): CheckResult {
  return problem.kind === 'whole-comparison'
    ? solveWholeComparison(problem, candidate)
    : mismatch(problem);
}

function roundingSolver(problem: ArithmeticProblem, candidate: string): CheckResult {
  return problem.kind === 'rounding' ? solveRounding(problem, candidate) : mismatch(problem);
}

function decimalPlaceSolver(problem: ArithmeticProblem, candidate: string): CheckResult {
  return problem.kind === 'decimal-place'
    ? solveDecimalPlace(problem, candidate)
    : mismatch(problem);
}

function decimalComparisonSolver(problem: ArithmeticProblem, candidate: string): CheckResult {
  return problem.kind === 'decimal-comparison'
    ? solveDecimalComparison(problem, candidate)
    : mismatch(problem);
}

function decimalOperationSolver(problem: ArithmeticProblem, candidate: string): CheckResult {
  return problem.kind === 'decimal-operation'
    ? solveDecimalOperation(problem, candidate)
    : mismatch(problem);
}

function percentOfSolver(problem: ArithmeticProblem, candidate: string): CheckResult {
  return problem.kind === 'percent-of' ? solvePercentOf(problem, candidate) : mismatch(problem);
}

function integerComparisonSolver(problem: ArithmeticProblem, candidate: string): CheckResult {
  return problem.kind === 'integer-comparison'
    ? solveIntegerComparison(problem, candidate)
    : mismatch(problem);
}

function absoluteValueSolver(problem: ArithmeticProblem, candidate: string): CheckResult {
  return problem.kind === 'absolute-value'
    ? solveAbsoluteValue(problem, candidate)
    : mismatch(problem);
}

function integerOperationSolver(problem: ArithmeticProblem, candidate: string): CheckResult {
  return problem.kind === 'integer-operation'
    ? solveIntegerOperation(problem, candidate)
    : mismatch(problem);
}

function ratioMissingSolver(problem: ArithmeticProblem, candidate: string): CheckResult {
  return problem.kind === 'ratio-missing'
    ? solveRatioMissing(problem, candidate)
    : mismatch(problem);
}

function unitRateSolver(problem: ArithmeticProblem, candidate: string): CheckResult {
  return problem.kind === 'unit-rate' ? solveUnitRate(problem, candidate) : mismatch(problem);
}

function proportionSolver(problem: ArithmeticProblem, candidate: string): CheckResult {
  return problem.kind === 'proportion' ? solveProportion(problem, candidate) : mismatch(problem);
}

function expressionSolver(problem: ArithmeticProblem, candidate: string): CheckResult {
  return problem.kind === 'expression' ? solveExpression(problem, candidate) : mismatch(problem);
}

function expressionValueSolver(problem: ArithmeticProblem, candidate: string): CheckResult {
  return problem.kind === 'expression-value'
    ? solveExpressionValue(problem, candidate)
    : mismatch(problem);
}

function equationSolver(problem: ArithmeticProblem, candidate: string): CheckResult {
  return problem.kind === 'equation' ? solveEquation(problem, candidate) : mismatch(problem);
}

function mismatch(problem: ArithmeticProblem): CheckResult {
  return {
    verdict: 'undecidable',
    reason: `Problem kind ${problem.kind} is not valid for skill ${problem.skillCode}.`,
  };
}
