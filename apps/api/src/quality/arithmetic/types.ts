export type ArithmeticSkillCode =
  'NUM.CNT.20' | 'NUM.CNT.SKIP5' | 'ADD.FACT.10' | 'ADD.REGROUP.2D' | 'FRAC.EQUAL' | 'FRAC.COMPARE';

type SkillProblem<TCode extends ArithmeticSkillCode, TKind extends string> = Readonly<{
  skillCode: TCode;
  kind: TKind;
}>;

export type SequenceProblem = SkillProblem<'NUM.CNT.20' | 'NUM.CNT.SKIP5', 'sequence'> &
  Readonly<{ values: readonly string[]; step: string }>;

export type AdditionProblem = SkillProblem<'ADD.FACT.10' | 'ADD.REGROUP.2D', 'addition'> &
  Readonly<{ left: string; right: string }>;

export type FractionEqualityProblem = SkillProblem<'FRAC.EQUAL', 'fraction-equality'> &
  Readonly<{ left: string; right: string }>;

export type FractionComparisonProblem = SkillProblem<'FRAC.COMPARE', 'fraction-comparison'> &
  Readonly<{ left: string; right: string }>;

export type ArithmeticProblem =
  SequenceProblem | AdditionProblem | FractionEqualityProblem | FractionComparisonProblem;

export type CheckResult =
  | Readonly<{ verdict: 'correct'; expected: string; reason: string }>
  | Readonly<{ verdict: 'incorrect'; expected: string; reason: string }>
  | Readonly<{ verdict: 'undecidable'; reason: string }>;

export type Rational = Readonly<{ numerator: bigint; denominator: bigint }>;
export type Solver<TProblem extends ArithmeticProblem = ArithmeticProblem> = (
  problem: TProblem,
  candidate: string,
) => CheckResult;

export type BinaryOperationProblem = Readonly<{ left: string; right: string }>;
export type PlaceValueProblem = Readonly<{
  number: string;
  place: 'ones' | 'tens' | 'hundreds' | 'thousands';
}>;
