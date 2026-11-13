import { parseInteger } from '@/quality/arithmetic/normalise';
import type { ArithmeticProblem } from '@/quality/arithmetic/types';

/** One step of a written method: what to work out, and what it comes to. */
export type ProcedureStep = Readonly<{ prompt: string; answer: string }>;

/**
 * The steps of a `procedure` skill's written method, in order (P3-07, the `steps[]` answer
 * key). Derived from the problem, never stored, so the generator, the tutor and the hint text
 * cannot disagree about what step two is. A skill with no written method — a fact, a number
 * sense skill — has no steps, and an empty list is how that is said.
 *
 * The prompts are for Aria, not the child: they say which piece of the work to point at. No
 * prompt contains the final answer; the last step's answer is one digit of it at most, or, for
 * division, what is left over.
 */
export function procedureSteps(problem: ArithmeticProblem): readonly ProcedureStep[] {
  switch (problem.skillCode) {
    case 'ADD.REGROUP.2D':
    case 'ADD.3D':
      return additionSteps(problem.left, problem.right);
    case 'SUB.REGROUP.2D':
      return subtractionSteps(problem.left, problem.right);
    case 'MUL.2D1D':
      return multiplicationSteps(problem.left, problem.right);
    case 'DIV.LONG':
      return longDivisionSteps(problem.left, problem.right);
    default:
      return [];
  }
}

const PLACES = ['ones', 'tens', 'hundreds', 'thousands'] as const;

/** Column by column from the ones, carrying into the next. */
function additionSteps(leftText: string, rightText: string): readonly ProcedureStep[] {
  const left = parseInteger(leftText);
  const right = parseInteger(rightText);
  if (left === null || right === null) return [];
  const steps: ProcedureStep[] = [];
  let carry = 0n;
  for (let place = 0, top = left, bottom = right; top > 0n || bottom > 0n; place += 1) {
    const sum = (top % 10n) + (bottom % 10n) + carry;
    const carried = carry > 0n ? ` and the carried ${carry.toString()}` : '';
    steps.push({
      prompt: `Add the ${PLACES[place] ?? 'next'} column: ${(top % 10n).toString()} and ${(bottom % 10n).toString()}${carried}.`,
      answer: sum.toString(),
    });
    carry = sum / 10n;
    top /= 10n;
    bottom /= 10n;
  }
  return steps;
}

/** Two-digit subtraction with one trade: break a ten, take the ones, then the tens. */
function subtractionSteps(leftText: string, rightText: string): readonly ProcedureStep[] {
  const left = parseInteger(leftText);
  const right = parseInteger(rightText);
  if (left === null || right === null || left < right) return [];
  const [topOnes, bottomOnes] = [left % 10n, right % 10n];
  const [topTens, bottomTens] = [left / 10n, right / 10n];
  const trade = topOnes < bottomOnes;
  const ones = trade ? topOnes + 10n : topOnes;
  const tens = trade ? topTens - 1n : topTens;
  return [
    ...(trade
      ? [
          {
            prompt: `There are only ${topOnes.toString()} ones. Break a ten: how many ones are there now?`,
            answer: ones.toString(),
          },
        ]
      : []),
    {
      prompt: `Ones column: ${ones.toString()} take away ${bottomOnes.toString()}.`,
      answer: (ones - bottomOnes).toString(),
    },
    {
      prompt: `Tens column: ${tens.toString()} tens take away ${bottomTens.toString()} tens.`,
      answer: (tens - bottomTens).toString(),
    },
  ];
}

/** A two-digit number times a one-digit number: the ones, then the tens with the carry. */
function multiplicationSteps(leftText: string, rightText: string): readonly ProcedureStep[] {
  const left = parseInteger(leftText);
  const right = parseInteger(rightText);
  if (left === null || right === null) return [];
  const ones = (left % 10n) * right;
  const tens = (left / 10n) * right;
  return [
    {
      prompt: `Multiply the ones: ${right.toString()} times ${(left % 10n).toString()}.`,
      answer: ones.toString(),
    },
    {
      prompt: `Multiply the tens: ${right.toString()} times ${(left / 10n).toString()} tens.`,
      answer: tens.toString(),
    },
    {
      prompt: `Add the ${(ones / 10n).toString()} carried tens to the ${tens.toString()} tens.`,
      answer: (tens + ones / 10n).toString(),
    },
  ];
}

/**
 * Long division, one digit of the dividend at a time: how many groups, then what is left, then
 * bring the next digit down. A leading digit smaller than the divisor is joined to the next one
 * before the first step, as it is written on paper.
 */
function longDivisionSteps(leftText: string, rightText: string): readonly ProcedureStep[] {
  const dividend = parseInteger(leftText);
  const divisor = parseInteger(rightText);
  if (dividend === null || divisor === null || divisor <= 0n) return [];
  const digits = dividend.toString().split('').map(BigInt);
  const steps: ProcedureStep[] = [];
  let current = 0n;
  let started = false;
  for (const [index, digit] of digits.entries()) {
    current = current * 10n + digit;
    const last = index === digits.length - 1;
    if (!started && current < divisor && !last) continue;
    const lead = started ? `Bring down the ${digit.toString()}. ` : '';
    started = true;
    const groups = current / divisor;
    const name = divisor.toString();
    steps.push(
      {
        prompt: `${lead}How many ${name}s go into ${current.toString()}?`,
        answer: groups.toString(),
      },
      {
        prompt: `${current.toString()} take away ${(groups * divisor).toString()}.`,
        answer: (current - groups * divisor).toString(),
      },
    );
    current -= groups * divisor;
  }
  return steps;
}
