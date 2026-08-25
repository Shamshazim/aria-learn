import type { Rational } from '@/quality/arithmetic/types';

const UNICODE_FRACTIONS: Readonly<Record<string, string>> = {
  '½': '1/2',
  '⅓': '1/3',
  '⅔': '2/3',
  '¼': '1/4',
  '¾': '3/4',
  '⅕': '1/5',
  '⅖': '2/5',
  '⅗': '3/5',
  '⅘': '4/5',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
};

export function normaliseAnswer(value: string): string {
  const trimmed = value.trim().replaceAll('−', '-').replace(/[.]$/u, '').trim();
  return UNICODE_FRACTIONS[trimmed] ?? trimmed;
}

export function parseInteger(value: string): bigint | null {
  const normalised = normaliseAnswer(value).replaceAll(',', '');
  return /^-?\d+$/u.test(normalised) ? BigInt(normalised) : null;
}

export function parseRational(value: string, allowDecimal: boolean): Rational | null {
  const normalised = normaliseAnswer(value);
  const mixed = /^(-?\d+)\s+(\d+)\/(\d+)$/u.exec(normalised);
  if (mixed !== null) return mixedNumber(mixed[1], mixed[2], mixed[3]);

  const fraction = /^(-?\d+)\/(\d+)$/u.exec(normalised);
  if (fraction !== null) return rationalFromParts(fraction[1], fraction[2]);
  if (allowDecimal && /^-?\d+(?:\.\d+)?$/u.test(normalised)) return decimalRational(normalised);
  return null;
}

export function rationalToString(value: Rational): string {
  return value.denominator === 1n
    ? value.numerator.toString()
    : `${value.numerator.toString()}/${value.denominator.toString()}`;
}

export function compareRationals(left: Rational, right: Rational): -1 | 0 | 1 {
  const difference = left.numerator * right.denominator - right.numerator * left.denominator;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

function mixedNumber(
  wholeText?: string,
  numeratorText?: string,
  denominatorText?: string,
): Rational | null {
  if (wholeText === undefined || numeratorText === undefined || denominatorText === undefined) {
    return null;
  }
  const whole = BigInt(wholeText);
  const numerator = BigInt(numeratorText);
  const denominator = BigInt(denominatorText);
  const signed = whole < 0n ? whole * denominator - numerator : whole * denominator + numerator;
  return reduce(signed, denominator);
}

function rationalFromParts(numeratorText?: string, denominatorText?: string): Rational | null {
  if (numeratorText === undefined || denominatorText === undefined) return null;
  return reduce(BigInt(numeratorText), BigInt(denominatorText));
}

function decimalRational(value: string): Rational {
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const [whole = '0', fractional = ''] = unsigned.split('.');
  const denominator = 10n ** BigInt(fractional.length);
  const numerator = BigInt(`${whole}${fractional}`) * (negative ? -1n : 1n);
  return reduce(numerator, denominator) ?? { numerator: 0n, denominator: 1n };
}

function reduce(numerator: bigint, denominator: bigint): Rational | null {
  if (denominator === 0n) return null;
  const sign = denominator < 0n ? -1n : 1n;
  const divisor = greatestCommonDivisor(abs(numerator), abs(denominator));
  return {
    numerator: (numerator / divisor) * sign,
    denominator: abs(denominator) / divisor,
  };
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left;
  let b = right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a === 0n ? 1n : a;
}

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}
