export function matchMisconception(
  input: Readonly<{
    skillCode: string | null;
    question: string | null;
    expectedAnswer: string | null;
    learnerAnswer: string;
  }>,
): string | null {
  const answer = normalise(input.learnerAnswer);
  if (input.skillCode === 'FRAC.COMPARE' && answer.replaceAll(/\s/gu, '') === '1/8') {
    return 'misconception-frac-compare-denominator';
  }
  if (input.skillCode === 'PH.SILENT_E' && silentEWasDropped(answer, input.expectedAnswer)) {
    return 'misconception-ph-silent-e-short-vowel';
  }
  if (input.skillCode === 'ADD.REGROUP.2D' && leavesOnesUnregrouped(answer, input.question)) {
    return 'misconception-add-regroup-no-carry';
  }
  return null;
}

function silentEWasDropped(answer: string, expected: string | null): boolean {
  if (expected === null) return false;
  const word = normalise(expected);
  return word.endsWith('e') && answer === word.slice(0, -1);
}

function leavesOnesUnregrouped(answer: string, question: string | null): boolean {
  if (question === null) return false;
  const numbers = [...question.matchAll(/\b\d{2}\b/gu)].map((match) => Number(match[0]));
  const [left, right] = numbers;
  if (left === undefined || right === undefined) return false;
  const ones = (left % 10) + (right % 10);
  if (ones < 10) return false;
  const independent = `${String(Math.floor(left / 10) + Math.floor(right / 10))}${String(ones)}`;
  return answer === independent;
}

function normalise(value: string): string {
  return value.trim().toLocaleLowerCase().replaceAll(/\s+/gu, ' ');
}
