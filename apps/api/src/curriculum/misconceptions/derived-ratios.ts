import type { ArithmeticRule } from '@/curriculum/misconceptions/signature.types';
import { parseInteger } from '@/quality/arithmetic/normalise';
import type {
  ProportionProblem,
  RatioMissingProblem,
  UnitRateProblem,
} from '@/quality/arithmetic/types';

type RatioProblem = RatioMissingProblem | UnitRateProblem | ProportionProblem;

/**
 * What the ratio wrong ideas predict (P3-07). Nearly every one is the same mistake in a
 * different coat: thinking about a ratio by adding, where it scales by multiplying. Same
 * contract as `derived-arithmetic.ts`: never a right answer.
 */
export function ratioError(rule: ArithmeticRule, problem: RatioProblem): readonly string[] {
  switch (problem.kind) {
    case 'ratio-missing':
      return missingError(rule, problem);
    case 'unit-rate':
      return unitError(rule, problem);
    case 'proportion':
      return proportionError(rule, problem);
  }
}

function missingError(rule: ArithmeticRule, problem: RatioMissingProblem): readonly string[] {
  const [first, second, scaled] = [problem.first, problem.second, problem.scaledFirst].map(
    parseInteger,
  );
  if (first == null || second == null || scaled == null || first === 0n) return [];
  const truth = (scaled * second) / first;
  const predicted = ((): bigint[] => {
    switch (rule) {
      // 2 : 3 = 8 : 9, because 8 is 6 more than 2.
      case 'additive-ratio':
        return [second + (scaled - first)];
      case 'kept-second-term':
        return [second];
      // 2 : 3 = 8 : 4: found the times four and stopped.
      case 'answered-the-scale':
        return scaled % first === 0n ? [scaled / first] : [];
      default:
        return [];
    }
  })();
  return wrongOnly(predicted, truth);
}

function unitError(rule: ArithmeticRule, problem: UnitRateProblem): readonly string[] {
  const amount = parseInteger(problem.amount);
  const per = parseInteger(problem.per);
  if (amount === null || per === null || per === 0n || amount % per !== 0n) return [];
  const truth = amount / per;
  const predicted = ((): bigint[] => {
    switch (rule) {
      case 'multiplied-instead':
        return [amount * per];
      case 'subtracted-instead':
        return [amount - per];
      // 48 km in 4 hours, so 44 km in 1 hour: one hour fewer, the same distance fewer.
      case 'additive-ratio':
        return [amount - (per - 1n)];
      default:
        return [];
    }
  })();
  return wrongOnly(predicted, truth);
}

function proportionError(rule: ArithmeticRule, problem: ProportionProblem): readonly string[] {
  const [count, total, asked] = [problem.count, problem.total, problem.asked].map(parseInteger);
  if (count == null || total == null || asked == null || count === 0n) return [];
  const truth = (total * asked) / count;
  const predicted = ((): bigint[] => {
    switch (rule) {
      // 3 pens cost $12, so 5 pens cost $14: two more pens, two more dollars.
      case 'additive-ratio':
        return [total + (asked - count)];
      case 'kept-total':
        return [total];
      // 3 pens cost $12, so 5 pens cost $60: the price multiplied by the new count.
      case 'multiplied-total':
        return [total * asked];
      default:
        return [];
    }
  })();
  return wrongOnly(predicted, truth);
}

function wrongOnly(predicted: readonly bigint[], truth: bigint): readonly string[] {
  return [...new Set(predicted.filter((value) => value !== truth && value >= 0n).map(String))];
}
