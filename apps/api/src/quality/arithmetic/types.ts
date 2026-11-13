export type ArithmeticSkillCode =
  | 'NUM.CNT.20'
  | 'NUM.CNT.SKIP5'
  | 'NUM.PV.TENS'
  | 'NUM.PV.HUNDREDS'
  | 'NUM.CMP.100'
  | 'NUM.RND.10'
  | 'ADD.FACT.10'
  | 'ADD.FACT.20'
  | 'ADD.REGROUP.2D'
  | 'ADD.3D'
  | 'SUB.FACT.10'
  | 'SUB.REGROUP.2D'
  | 'MUL.FACT.10'
  | 'MUL.2D1D'
  | 'DIV.FACT.10'
  | 'DIV.LONG'
  | 'FRAC.EQUAL'
  | 'FRAC.COMPARE';

type SkillProblem<TCode extends ArithmeticSkillCode, TKind extends string> = Readonly<{
  skillCode: TCode;
  kind: TKind;
}>;

export type SequenceProblem = SkillProblem<'NUM.CNT.20' | 'NUM.CNT.SKIP5', 'sequence'> &
  Readonly<{ values: readonly string[]; step: string }>;

export type AdditionProblem = SkillProblem<
  'ADD.FACT.10' | 'ADD.FACT.20' | 'ADD.REGROUP.2D' | 'ADD.3D',
  'addition'
> &
  Readonly<{ left: string; right: string }>;

/** P3-07: "What is 52 take away 17?" Always `left >= right`: no negatives before grade 6. */
export type SubtractionProblem = SkillProblem<'SUB.FACT.10' | 'SUB.REGROUP.2D', 'subtraction'> &
  Readonly<{ left: string; right: string }>;

/** P3-07: "What is 6 times 7?" */
export type MultiplicationProblem = SkillProblem<'MUL.FACT.10' | 'MUL.2D1D', 'multiplication'> &
  Readonly<{ left: string; right: string }>;

/**
 * P3-07: "What is 157 divided by 4?" Whole-number division: the answer is a quotient, and a
 * remainder where there is one ("39 r 1"). A fraction or decimal is a different skill.
 */
export type DivisionProblem = SkillProblem<'DIV.FACT.10' | 'DIV.LONG', 'division'> &
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
  | SubtractionProblem
  | MultiplicationProblem
  | DivisionProblem
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
