import { parseInteger, parseRational } from '@/quality/arithmetic/normalise';
import type { Rational } from '@/quality/arithmetic/types';

/**
 * A fraction as a child is taught to write it (P3-07): lowest terms, and above one as a mixed
 * number — "1 1/5", not "6/5". The checker accepts either and any equivalent; this is only how
 * the key and the predicted wrong answers are written down.
 */
export function formatFraction(value: Rational): string {
  const { numerator, denominator } = lowest(value);
  if (denominator === 1n) return numerator.toString();
  const whole = numerator / denominator;
  const part = numerator % denominator;
  const fraction = `${part.toString()}/${denominator.toString()}`;
  return whole === 0n ? fraction : `${whole.toString()} ${fraction}`;
}

/** Any written fraction, mixed number, decimal, whole number or number word. */
export function readFraction(text: string): Rational | null {
  const parsed = parseRational(text, true);
  if (parsed !== null) return parsed;
  const whole = parseInteger(text);
  return whole === null ? null : { numerator: whole, denominator: 1n };
}

/**
 * A fraction exactly as written, not reduced: "2/8" stays two eighths. The wrong ideas are
 * about the written fraction — adding the tops of 3/8 and 2/8 gives 5, not 3 + 1 — so they
 * need this rather than the value. A whole number is itself over one.
 */
export function readWrittenFraction(text: string): Rational | null {
  const match = /^\s*(\d+)\s*\/\s*(\d+)\s*$/u.exec(text);
  if (match !== null)
    return { numerator: BigInt(match[1] ?? '0'), denominator: BigInt(match[2] ?? '1') };
  const whole = parseInteger(text);
  return whole === null ? null : { numerator: whole, denominator: 1n };
}

export function lowest(value: Rational): Rational {
  const divisor = gcd(value.numerator < 0n ? -value.numerator : value.numerator, value.denominator);
  return divisor === 0n
    ? value
    : { numerator: value.numerator / divisor, denominator: value.denominator / divisor };
}

export function gcd(left: bigint, right: bigint): bigint {
  return right === 0n ? left : gcd(right, left % right);
}
