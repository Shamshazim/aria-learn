import { columnAdditionSteps, type ProcedureStep } from '@/quality/arithmetic/column-steps';
import type { DecimalOperationProblem } from '@/quality/arithmetic/types';

/** Decimal columns from the right, once both numbers are written to hundredths. */
const DECIMAL_PLACES = ['hundredths', 'tenths', 'ones', 'tens', 'hundreds'] as const;

/**
 * P3-07: adding and taking away decimals. First the points are lined up — the number in tenths
 * gets a zero in its hundredths — and then it is column work, as for whole numbers. The first
 * step is the lining up, because that is the step the wrong ideas skip.
 */
export function decimalSteps(problem: DecimalOperationProblem): readonly ProcedureStep[] {
  const left = hundredths(problem.left);
  const right = hundredths(problem.right);
  if (left === null || right === null) return [];
  const short = [problem.left, problem.right].find((text) => places(text) === 1);
  const lineUp: ProcedureStep[] =
    short === undefined
      ? []
      : [{ prompt: `Line up the points. How many hundredths does ${short} have?`, answer: '0' }];
  const columns =
    problem.operation === 'add'
      ? columnAdditionSteps(left, right, DECIMAL_PLACES)
      : columnSubtractionSteps(left, right);
  return [...lineUp, ...columns];
}

/** Column subtraction from the right, breaking one from the next place when a column is short. */
function columnSubtractionSteps(left: bigint, right: bigint): readonly ProcedureStep[] {
  if (left < right) return [];
  const steps: ProcedureStep[] = [];
  let borrow = 0n;
  for (let place = 0, top = left, bottom = right; top > 0n || bottom > 0n; place += 1) {
    const have = (top % 10n) - borrow;
    const take = bottom % 10n;
    const name = DECIMAL_PLACES[place] ?? 'next';
    const short = have < take;
    steps.push({
      prompt: short
        ? `The ${name}: ${have.toString()} is less than ${take.toString()}, so break one from the next place. What is ${(have + 10n).toString()} take away ${take.toString()}?`
        : `The ${name}: ${have.toString()} take away ${take.toString()}.`,
      answer: (short ? have + 10n - take : have - take).toString(),
    });
    borrow = short ? 1n : 0n;
    top /= 10n;
    bottom /= 10n;
  }
  return steps;
}

/** "3.4" as 340 hundredths, "1.25" as 125; `null` for anything with more than two places. */
function hundredths(text: string): bigint | null {
  const match = /^\s*(\d+)(?:\.(\d{1,2}))?\s*$/u.exec(text);
  if (match === null) return null;
  return BigInt(match[1] ?? '0') * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
}

function places(text: string): number {
  return text.split('.')[1]?.length ?? 0;
}
