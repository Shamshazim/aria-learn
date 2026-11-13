export type ArithmeticSkillCode =
  | 'NUM.CNT.20'
  | 'NUM.CNT.SKIP5'
  | 'NUM.PV.TENS'
  | 'NUM.PV.HUNDREDS'
  | 'NUM.CMP.100'
  | 'NUM.RND.10'
  | 'ADD.FACT.10'
  | 'ADD.REGROUP.2D'
  | 'FRAC.EQUAL'
  | 'FRAC.COMPARE';

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

/** P3-07: "In 47, which digit is in the tens place?" */
export type DigitPlaceProblem = SkillProblem<'NUM.PV.TENS' | 'NUM.PV.HUNDREDS', 'place-value'> &
  Readonly<{ number: string; place: PlaceValueProblem['place'] }>;

/** P3-07: "Compare 47 and 52." The answer is `<`, `=` or `>`. */
export type WholeComparisonProblem = SkillProblem<'NUM.CMP.100', 'whole-comparison'> &
  Readonly<{ left: string; right: string }>;

/** P3-07: "Round 47 to the nearest ten." Halves round up, as the standard teaches it. */
export type RoundingProblem = SkillProblem<'NUM.RND.10', 'rounding'> &
  Readonly<{ number: string; to: '10' }>;

export type ArithmeticProblem =
  | SequenceProblem
  | AdditionProblem
  | FractionEqualityProblem
  | FractionComparisonProblem
  | DigitPlaceProblem
  | WholeComparisonProblem
  | RoundingProblem;

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
