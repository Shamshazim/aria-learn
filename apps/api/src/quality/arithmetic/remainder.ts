import { normaliseAnswer, parseInteger } from '@/quality/arithmetic/normalise';

export type QuotientWithRemainder = Readonly<{ quotient: bigint; remainder: bigint }>;

/**
 * A whole-number division answer, however a child writes it (P3-07): "39 r 1", "39 R1",
 * "39r1", "39 rem 1", "39 remainder 1", or a plain "39" for no remainder. Words work too,
 * because the quotient and remainder go through the same reader as any whole number.
 */
export function parseQuotientWithRemainder(value: string): QuotientWithRemainder | null {
  const text = normaliseAnswer(value).toLowerCase();
  // The r-word stands alone: after a digit or a space and before one, so the r in "thirty" or
  // the start of "remainder" is never taken for it.
  const match = /^(.+?)\s*(?<=[\d\s])(?:remainder|rem|r)(?=[\s\d])\s*(.+)$/u.exec(text);
  if (match === null) {
    const whole = parseInteger(text);
    return whole === null ? null : { quotient: whole, remainder: 0n };
  }
  const quotient = parseInteger(match[1] ?? '');
  const remainder = parseInteger(match[2] ?? '');
  return quotient === null || remainder === null ? null : { quotient, remainder };
}

/** How the answer key is written: "39 r 1", or just "39" when nothing is left over. */
export function formatQuotientWithRemainder(answer: QuotientWithRemainder): string {
  return answer.remainder === 0n
    ? answer.quotient.toString()
    : `${answer.quotient.toString()} r ${answer.remainder.toString()}`;
}
