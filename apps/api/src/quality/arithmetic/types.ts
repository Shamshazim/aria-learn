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
  | 'FRAC.COMPARE'
  | 'FRAC.EQUIV'
  | 'FRAC.ADD.LIKE'
  | 'FRAC.ADD.UNLIKE'
  | 'FRAC.MUL.WHOLE'
  | 'DEC.PV'
  | 'DEC.CMP'
  | 'DEC.ADD'
  | 'PCT.OF'
  | 'INT.CMP'
  | 'INT.ABS'
  | 'INT.ADD'
  | 'INT.MUL'
  | 'RAT.EQUIV'
  | 'RAT.UNIT'
  | 'RAT.PROP'
  | 'FRAC.DIV'
  | 'EXP.ORDER'
  | 'EXP.EVAL'
  | 'EQN.ONE'
  | 'EQN.TWO';

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

/** P3-07: "2/3 = ?/12". The answer is the missing numerator. */
export type FractionMissingProblem = SkillProblem<'FRAC.EQUIV', 'fraction-missing'> &
  Readonly<{ left: string; denominator: string }>;

/**
 * P3-07: "What is 3/8 add 2/8?", "What is 3 times 2/5?". Exact on rationals; a whole number is
 * a fraction over one. Subtraction never goes below zero.
 */
export type FractionOperationProblem = SkillProblem<
  'FRAC.ADD.LIKE' | 'FRAC.ADD.UNLIKE' | 'FRAC.MUL.WHOLE' | 'FRAC.DIV',
  'fraction-operation'
> &
  Readonly<{ operation: FractionOperation; left: string; right: string }>;

export type FractionOperation = 'add' | 'subtract' | 'multiply' | 'divide';

/** P3-07: "In 3.47, which digit is in the tenths place?" */
export type DecimalPlaceProblem = SkillProblem<'DEC.PV', 'decimal-place'> &
  Readonly<{ number: string; place: 'tenths' | 'hundredths' }>;

/** P3-07: "Compare 0.3 and 0.25." The answer is `<`, `=` or `>`. */
export type DecimalComparisonProblem = SkillProblem<'DEC.CMP', 'decimal-comparison'> &
  Readonly<{ left: string; right: string }>;

/** P3-07: "What is 3.4 add 1.25?" Exact on rationals; taking away never goes below zero. */
export type DecimalOperationProblem = SkillProblem<'DEC.ADD', 'decimal-operation'> &
  Readonly<{ operation: 'add' | 'subtract'; left: string; right: string }>;

/** P3-07: "What is 25% of 80?" */
export type PercentOfProblem = SkillProblem<'PCT.OF', 'percent-of'> &
  Readonly<{ percent: string; whole: string }>;

/** P3-07: "Compare -7 and -3." The answer is `<`, `=` or `>`. */
export type IntegerComparisonProblem = SkillProblem<'INT.CMP', 'integer-comparison'> &
  Readonly<{ left: string; right: string }>;

/** P3-07: "What is the absolute value of -7?" */
export type AbsoluteValueProblem = SkillProblem<'INT.ABS', 'absolute-value'> &
  Readonly<{ number: string }>;

/**
 * P3-07: "What is -5 add 3?", "What is -6 times -4?". Integers, exact; a division always
 * comes out whole, because remainders with negatives are not taught at this level.
 */
export type IntegerOperationProblem = SkillProblem<'INT.ADD' | 'INT.MUL', 'integer-operation'> &
  Readonly<{ operation: IntegerOperation; left: string; right: string }>;

export type IntegerOperation = 'add' | 'subtract' | 'multiply' | 'divide';

/** P3-07: "2 : 3 = 8 : ?". The answer is the missing second term. */
export type RatioMissingProblem = SkillProblem<'RAT.EQUIV', 'ratio-missing'> &
  Readonly<{ first: string; second: string; scaledFirst: string }>;

/** P3-07: "48 km in 4 hours. How many km in 1 hour?" The units are for the reader only. */
export type UnitRateProblem = SkillProblem<'RAT.UNIT', 'unit-rate'> &
  Readonly<{ amount: string; per: string; amountUnit: string; perUnit: string }>;

/** P3-07: "3 pens cost $12. How much do 5 pens cost?" Always a whole number of dollars. */
export type ProportionProblem = SkillProblem<'RAT.PROP', 'proportion'> &
  Readonly<{ count: string; total: string; asked: string; thing: string }>;

/** P3-07: "What is 3 + 4 × 2?" Whole numbers, + − × ÷ and brackets; never an ambiguous ÷ chain. */
export type ExpressionProblem = SkillProblem<'EXP.ORDER', 'expression'> &
  Readonly<{ expression: string }>;

/** P3-07: "What is 3n + 4 when n = 5?" */
export type ExpressionValueProblem = SkillProblem<'EXP.EVAL', 'expression-value'> &
  Readonly<{ expression: string; variable: string; value: string }>;

/** P3-07: "Solve x + 7 = 15." Checked by putting the answer back in, not by solving. */
export type EquationProblem = SkillProblem<'EQN.ONE' | 'EQN.TWO', 'equation'> &
  Readonly<{ left: string; right: string; variable: string }>;

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
  | FractionMissingProblem
  | FractionOperationProblem
  | DecimalPlaceProblem
  | DecimalComparisonProblem
  | DecimalOperationProblem
  | PercentOfProblem
  | IntegerComparisonProblem
  | AbsoluteValueProblem
  | IntegerOperationProblem
  | RatioMissingProblem
  | UnitRateProblem
  | ProportionProblem
  | ExpressionProblem
  | ExpressionValueProblem
  | EquationProblem
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
